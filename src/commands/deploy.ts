import { SftpClient } from '@mimic-behavior/ssh2-sftp-client'
import path from 'node:path'
import pLimit from 'p-limit'
import * as vscode from 'vscode'

import { catchDeepestDirectories, catchFiles, pathMapping } from '~/core'
import { getLogger, getSecret, promptTargets, withProgress } from '~/platform'

async function deploy(uris: vscode.Uri[], context: vscode.ExtensionContext) {
    const logger = getLogger()

    if (!uris || uris.length === 0) {
        vscode.window.showInformationMessage('No files or directories selected')
        return
    }

    logger.value.appendLine('Deploying files')
    logger.value.appendLine(JSON.stringify(uris, null, 4))

    const targets = await promptTargets(context)

    if (!targets?.length) {
        vscode.window.showInformationMessage('No targets selected')
        return
    }

    for (const target of targets) {
        const sftp = new SftpClient()
        const storageKey = `sftp.${target.name}.password`
        const secret = await getSecret(context, target, storageKey)

        if (!secret) {
            vscode.window.showInformationMessage(`Password for ${target.name} is not set`)
            return
        }

        // Connect to the sftp server
        let isConnectionCancelled = false
        try {
            await withProgress(
                async (_, token) => {
                    token.onCancellationRequested(() => {
                        isConnectionCancelled = true
                        sftp.ssh2.destroy()
                    })

                    await sftp.connect({
                        host: target.host,
                        port: target.port,
                        username: target.username,
                        ...secret,
                    })
                },
                { cancellable: true, title: `Connecting to ${target.name}` },
            )
        } catch (error) {
            if (isConnectionCancelled) {
                vscode.window.showInformationMessage(`Connection to ${target.name} was cancelled`)
            } else {
                vscode.window.showInformationMessage(`Error connecting to ${target.name}: ${error}`)
            }

            return
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uris[0])?.uri.fsPath || ''

        const files = await catchFiles(uris.map((uri) => uri.fsPath))
        const directories = catchDeepestDirectories(files)

        const remoteRootPath = await sftp.realpath('.')

        await withProgress(async (progress) => {
            for (const directory of directories) {
                const relativePath = directory.replace(workspaceFolder, '')
                const remotePath = path.join(remoteRootPath, pathMapping(relativePath, target.mappings || []))
                progress.report({ message: `Creating directory: ${remotePath} to ${target.name}` })
                await sftp.mkdir(remotePath, { recursive: true })
            }

            await pLimit({ concurrency: 4 }).map(files, async (file) => {
                const relativePath = file.pathname.replace(workspaceFolder, '')
                const remotePath = path.join(remoteRootPath, pathMapping(relativePath, target.mappings || []))
                progress.report({ message: `Uploading file: ${remotePath} to ${target.name}` })
                return sftp.fastPut(file.pathname, remotePath)
            })
        })

        sftp.end()
    }
}

export { deploy }
