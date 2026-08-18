import path from 'node:path'
import * as vscode from 'vscode'

import { CancelledError, catchFiles, type Target } from '~/core'
import {
    type Auth,
    createProgressReporter,
    deployTarget,
    getConfig,
    getLogger,
    promptTargets,
    rememberSecretsQuietly,
    resolveAuth,
    withProgress,
} from '~/platform'

function showFailure(summary: string, error: unknown) {
    const logger = getLogger()

    logger.value.appendLine(`${summary}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`)

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
    const config = getConfig(context)
    const logger = getLogger()

    if (!uris?.length) {
        vscode.window.showInformationMessage('No files or directories selected')
        return
    }

    const sourceRootPath = vscode.workspace.getWorkspaceFolder(uris[0])?.uri.fsPath
    if (!sourceRootPath) {
        vscode.window.showErrorMessage('Selected files are outside of the workspace')
        return
    }

    const targets = config.value.get<Target[]>('targets')
    if (!targets) {
        vscode.window.showInformationMessage('No targets found in the extension configuration')
        return
    }

    const targetsSelected = await promptTargets(targets)
    if (!targetsSelected?.length) {
        vscode.window.showInformationMessage('No targets selected')
        return
    }

    const files = await catchFiles(uris.map((uri) => uri.fsPath))
    if (!files.length) {
        vscode.window.showInformationMessage('No files to upload')
        return
    }

    const deployments: { auth: Auth; target: Target }[] = []

    try {
        for (const target of targetsSelected) {
            deployments.push({ auth: await resolveAuth(context, target), target })
        }
    } catch (error) {
        if (error instanceof CancelledError) {
            return
        }

        showFailure('Could not resolve credentials', error)
    }

    logger.value.appendLine(`Uploading ${files.length} file(s) to ${deployments.length} target(s)`)

    const results = await withProgress(
        (progress, token) => {
            const report = createProgressReporter(progress, files.length * deployments.length)

            return Promise.allSettled(
                deployments.map(({ auth, target }) =>
                    deployTarget({
                        auth,
                        files,
                        onConnected: () => rememberSecretsQuietly(context, target, auth),
                        onUpload: (task) => report(`${target.name}: ${path.posix.basename(task.remoteFilePath)}`),
                        sourceRootPath,
                        target,
                        token,
                    }),
                ),
            )
        },
        {
            cancellable: true,
            title:
                deployments.length === 1
                    ? `Uploading to ${deployments[0].target.name}`
                    : `Uploading to ${deployments.length} targets`,
        },
    )

    for (const [index, result] of results.entries()) {
        if (result.status === 'rejected' && !(result.reason instanceof CancelledError)) {
            showFailure(`Upload to ${deployments[index].target.name} failed`, result.reason)
        }
    }
}

export { upload }
