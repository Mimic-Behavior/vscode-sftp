import { SftpClient } from '@mimic-behavior/ssh2-sftp-client'
import path from 'node:path'
import pLimit from 'p-limit'
import * as vscode from 'vscode'

import { batchFilesByDirectories, catchFiles, pathMapping } from '~/core'
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
        const limit = pLimit({ concurrency: 4 })

        await withProgress(
            async (progress) => {
                const batches = batchFilesByDirectories(files)

                const remoteRootPath = await sftp.realpath('.')

                const uploadTasks: {
                    remoteDirectoryPath: string
                    remoteFilePath: string
                    sourceFilePath: string
                }[] = []

                for (const [directory, filenames] of batches.entries()) {
                    const relativePath = path.relative(workspaceFolder, directory)
                    const mappedDirectoryPath = pathMapping(relativePath, target.mappings || [])
                    const remoteDirectoryPath = path.posix.join(remoteRootPath, mappedDirectoryPath)

                    for (const filename of filenames) {
                        uploadTasks.push({
                            remoteDirectoryPath,
                            remoteFilePath: path.posix.join(remoteDirectoryPath, filename),
                            sourceFilePath: path.posix.join(directory, filename),
                        })
                    }
                }

                const tasks = new Map<string, Promise<void>>()

                for (const directory of uploadTasks.map((task) => task.remoteDirectoryPath)) {
                    tasks.set(directory, sftp.mkdir(directory, { recursive: true }))
                }

                await limit.map(uploadTasks, async (uploadTask) => {
                    await tasks.get(uploadTask.remoteDirectoryPath)
                    progress.report({ message: `Uploading file: ${uploadTask.remoteFilePath}` })
                    await sftp.fastPut(uploadTask.sourceFilePath, uploadTask.remoteFilePath)
                })
            },
            {
                title: `Deploying to ${target.name}`,
            },
        )

        sftp.end()
    }
}

export { deploy }
