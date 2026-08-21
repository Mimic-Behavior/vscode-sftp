import path from 'node:path'
import pLimit from 'p-limit'
import * as vscode from 'vscode'

import { collectFiles, createClient, createUploader, createUploadTasks, ensureDirectories } from '~/core'
import {
    createProgressReporter,
    promptTargets,
    rememberSecrets,
    resolveAuth,
    toAbortSignal,
    withProgress,
} from '~/platform'
import { type Auth, CancelledError, type File, type Target } from '~/shared'

const EXTENSION_KEY = 'sftp'
const FILE_CONCURRENCY = 8
const MAX_FILE_CONCURRENCY = 64
const MIN_FILE_CONCURRENCY = 1

type Deployment = {
    auth: Auth
    target: Target
}

type UploadTask = {
    remoteDirectoryPath: string
    remoteFilePath: string
    sourceFilePath: string
}

function getLogger() {
    // lazy singleton — пока platform/services/logger пустой
    const channel = vscode.window.createOutputChannel(EXTENSION_KEY, { log: true })
    return { value: channel }
}

function progressTitle(deployments: Deployment[]) {
    return deployments.length === 1
        ? `Uploading to ${deployments[0].target.name}`
        : `Uploading to ${deployments.length} targets`
}

function rememberSecretsQuietly(context: vscode.ExtensionContext, target: Target, auth: Auth) {
    return rememberSecrets(context, target, auth).catch((error) => {
        getLogger().value.appendLine(`Could not store credentials for ${target.name}: ${error}`)
    })
}

async function resolveDeployments(
    context: vscode.ExtensionContext,
    targets: Target[],
): Promise<Deployment[] | undefined> {
    const deployments: Deployment[] = []

    try {
        for (const target of targets) {
            deployments.push({ auth: await resolveAuth(context, target), target })
        }
    } catch (error) {
        if (error instanceof CancelledError) {
            return undefined
        }

        showFailure('Could not resolve credentials', error)
        return undefined
    }

    return deployments
}

function resolveWorkspaceFolder(uris: vscode.Uri[]) {
    return vscode.workspace.getWorkspaceFolder(uris[0])
}

function showFailure(summary: string, error: unknown) {
    const logger = getLogger()
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)

    logger.value.appendLine(`${summary}: ${detail}`)

    if (error instanceof Error && error.cause !== undefined) {
        logger.value.appendLine(`Caused by: ${error.cause}`)
    }

    vscode.window.showErrorMessage(summary, 'Show log').then((choice) => {
        if (choice !== undefined) {
            logger.value.show()
        }
    })
}

async function upload(uris: undefined | vscode.Uri[], context: vscode.ExtensionContext) {
    if (!uris?.length) {
        vscode.window.showInformationMessage('No files or directories selected')
        return
    }

    const workspaceFolder = resolveWorkspaceFolder(uris)
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Selected files are not in a workspace folder')
        return
    }

    const targets = vscode.workspace.getConfiguration(EXTENSION_KEY).get<Target[]>('targets')
    if (!targets?.length) {
        vscode.window.showInformationMessage('No targets found in the extension configuration')
        return
    }

    const targetsSelected = await promptTargets(targets)
    if (!targetsSelected?.length) {
        vscode.window.showInformationMessage('No targets selected')
        return
    }

    const files = await collectFiles(uris.map((uri) => uri.fsPath))
    if (!files.length) {
        vscode.window.showInformationMessage('No files to upload')
        return
    }

    const deployments = await resolveDeployments(context, targetsSelected)
    if (!deployments?.length) {
        return
    }

    const logger = getLogger()
    logger.value.appendLine(`Uploading ${files.length} file(s) to ${deployments.length} target(s)`)

    const results = await withProgress(
        (progress, token) => {
            const report = createProgressReporter(progress, files.length * deployments.length)

            return Promise.allSettled(
                deployments.map(({ auth, target }) =>
                    uploadToTarget({
                        auth,
                        files,
                        onConnected: () => rememberSecretsQuietly(context, target, auth),
                        onUpload: (task) => report(`${target.name}: ${path.posix.basename(task.remoteFilePath)}`),
                        target,
                        token,
                        workspaceFolder,
                    }),
                ),
            )
        },
        {
            cancellable: true,
            title: progressTitle(deployments),
        },
    )

    for (const [index, result] of results.entries()) {
        if (result.status === 'rejected' && !(result.reason instanceof CancelledError)) {
            showFailure(`Upload to ${deployments[index].target.name} failed`, result.reason)
        }
    }
}

async function uploadToTarget({
    auth,
    files,
    onConnected,
    onUpload,
    target,
    token,
    workspaceFolder,
}: {
    auth: Auth
    files: File[]
    onConnected: () => Promise<void>
    onUpload: (task: UploadTask) => void
    target: Target
    token: vscode.CancellationToken
    workspaceFolder: vscode.WorkspaceFolder
}) {
    const client = await createClient({
        auth,
        signal: toAbortSignal(token),
        target,
    })

    try {
        await onConnected()

        const remoteRootPath = await client.realpath('.')
        const tasks = createUploadTasks({
            files,
            remoteRootPath,
            sourceRootPath: workspaceFolder.uri.fsPath,
            target: {
                ...target,
                mappings: target.mappings?.filter((mapping) =>
                    mapping.condition?.workspaceFolderName
                        ? workspaceFolder.name === mapping.condition.workspaceFolderName
                        : true,
                ),
            },
        })

        if (tasks.length === 0) {
            return
        }

        await ensureDirectories(
            client,
            remoteRootPath,
            tasks.map((task) => task.remoteDirectoryPath),
        )

        const uploadFile = createUploader(client, target.transfer ?? 'stream')
        const limit = pLimit({
            concurrency: Math.min(
                Math.max(target.concurrency ?? FILE_CONCURRENCY, MIN_FILE_CONCURRENCY),
                MAX_FILE_CONCURRENCY,
            ),
            rejectOnClear: true,
        })

        const promises = tasks.map((task) =>
            limit(async () => {
                if (token.isCancellationRequested) {
                    throw new CancelledError(target.name)
                }

                await uploadFile(task.sourceFilePath, task.remoteFilePath)
                onUpload(task)
            }),
        )

        try {
            await Promise.all(promises)
        } catch (error) {
            limit.clearQueue()
            await Promise.allSettled(promises)
            throw error
        }
    } catch (error) {
        if (token.isCancellationRequested) {
            throw new CancelledError(target.name)
        }

        throw error
    } finally {
        client.end()
    }
}

export { upload }
