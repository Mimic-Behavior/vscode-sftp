import * as vscode from 'vscode'

import { CancelledError, catchFiles } from '~/core'
import { getLogger, makeProgressReporter, promptTargets, type Target, withProgress } from '~/platform'
import { type Auth, deployTarget, rememberSecrets, resolveAuth } from '~/platform/lib/sftp'

/**
 * A failing keychain should not abort an otherwise healthy deploy.
 */
function rememberSecretsQuietly(context: vscode.ExtensionContext, target: Target, auth: Auth) {
    return rememberSecrets(context, target, auth).catch((error) => {
        getLogger().value.appendLine(`Could not store credentials for ${target.name}: ${error}`)
    })
}

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

async function upload(uris: vscode.Uri[], context: vscode.ExtensionContext) {
    const logger = getLogger()

    if (!uris || uris.length === 0) {
        vscode.window.showInformationMessage('No files or directories selected')
        return
    }

    const targets = await promptTargets(context)

    if (!targets?.length) {
        vscode.window.showInformationMessage('No targets selected')
        return
    }

    const sourceRootPath = vscode.workspace.getWorkspaceFolder(uris[0])?.uri.fsPath

    if (!sourceRootPath) {
        vscode.window.showErrorMessage('Selected files are outside of the workspace')
        return
    }

    // VS Code shows a single input box at a time, so credentials have to be collected
    // before any target starts working, not concurrently with the other targets
    const deployments: { auth: Auth; target: Target }[] = []

    try {
        for (const target of targets) {
            deployments.push({ auth: await resolveAuth(context, target), target })
        }
    } catch (error) {
        if (!(error instanceof CancelledError)) {
            showFailure('Could not resolve credentials', error)
        }

        return
    }

    const files = await catchFiles(uris.map((uri) => uri.fsPath))

    if (files.length === 0) {
        vscode.window.showInformationMessage('Nothing to upload')
        return
    }

    logger.value.appendLine(`Uploading ${files.length} file(s) to ${deployments.length} target(s)`)

    const results = await withProgress(
        (progress, token) => {
            const report = makeProgressReporter(progress, files.length * deployments.length)

            return Promise.allSettled(
                deployments.map(({ auth, target }) =>
                    deployTarget({
                        auth,
                        files,
                        onConnected: () => rememberSecretsQuietly(context, target, auth),
                        report,
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
