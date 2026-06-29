import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import picomatch from 'picomatch'
import SftpClient from 'ssh2-sftp-client'
import * as vscode from 'vscode'

import type { Mapping, Target } from './types'

let logger: vscode.OutputChannel

async function activate(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('sftp')

    logger = vscode.window.createOutputChannel('sftp', { log: true })

    const disposable = vscode.commands.registerCommand('sftp.deploy', async (_, uris: vscode.Uri[]) => {
        logger.appendLine('Deploying files')
        logger.appendLine(JSON.stringify(uris, null, 4))

        if (!uris || uris.length === 0) {
            vscode.window.showInformationMessage('No files or directories selected')
            return
        }

        const targets = config.get<Target[]>('targets')

        if (!targets?.length) {
            vscode.window.showInformationMessage('No targets found')
            return
        }

        const targetsNames = await vscode.window.showQuickPick(
            targets.map((target) => target.name),
            {
                canPickMany: true,
                ignoreFocusOut: true,
                matchOnDescription: false,
                matchOnDetail: false,
                placeHolder: 'Target name',
                title: 'Select targets',
            },
        )

        if (!targetsNames?.length) {
            vscode.window.showInformationMessage('No targets selected')
            return
        }

        for (const targetName of targetsNames) {
            const target = targets.find((target) => target.name === targetName)

            if (!target) {
                vscode.window.showInformationMessage('Target not found')
                return
            }

            const sftp = new SftpClient()
            const storageKey = `sftp.${target.name}.password`
            const secret = await resolveSecret(context, target, storageKey)

            if (!secret) {
                vscode.window.showErrorMessage(`Failed to resolve secret for ${target.name}`)
                return
            }

            // Connect to server
            if (!(await resolveConnection(sftp, target, secret))) {
                return
            }

            if (secret?.password) {
                await context.secrets.store(storageKey, secret.password)
            }

            await uploadWithProgress(sftp, target, uris)
            await sftp.end()
        }
    })

    context.subscriptions.push(disposable)
}

function deactivate() {}

function pathMapping(pathname: string, mappings: Mapping[]) {
    for (const mapping of mappings) {
        if (
            // oxfmt-ignore
            !mapping.from.endsWith('/') ||
            !mapping.from.startsWith('/') ||
            !mapping.to.endsWith('/') ||
            !mapping.to.startsWith('/')
        ) {
            continue
        }

        const result = picomatch(mapping.from.replace(/\/$/, '/**'), {
            capture: true,
            nobrace: true,
            nobracket: true,
            noext: true,
            nonegate: true,
        })(pathname, true)

        if (Array.isArray(result.match)) {
            return path.join(mapping.to, result.match.at(-1) ?? '')
        }
    }

    return pathname
}

async function resolveConnection(sftp: SftpClient, target: Target, secret: { password?: string; privateKey?: string }) {
    let isCancelled = false

    try {
        return await vscode.window.withProgress(
            {
                cancellable: true,
                location: vscode.ProgressLocation.Notification,
                title: 'Connecting to server',
            },
            (_, token) => {
                token.onCancellationRequested(() => {
                    isCancelled = true
                    sftp.client.destroy()
                })

                return sftp.connect({
                    host: target.host,
                    port: target.port,
                    readyTimeout: 8000,
                    username: target.username,
                    ...secret,
                })
            },
        )
    } catch (error) {
        if (isCancelled) {
            vscode.window.showInformationMessage('Connection cancelled')
        } else {
            vscode.window.showErrorMessage(
                `Failed to connect to server, error: ${error instanceof Error ? error.message : String(error)}`,
            )
        }

        return
    }
}

async function resolveSecret(context: vscode.ExtensionContext, target: Target, storageKey: string) {
    return vscode.window.withProgress(
        { cancellable: false, location: vscode.ProgressLocation.Notification, title: 'Resolving secret' },
        async () => {
            try {
                const privateKeyPath = target.privateKey.startsWith('~/')
                    ? path.join(os.homedir(), target.privateKey.slice(1))
                    : target.privateKey

                await fs.access(privateKeyPath)

                return {
                    privateKey: await fs.readFile(privateKeyPath, 'utf-8'),
                }
            } catch {
                const stored = await context.secrets.get(storageKey)

                if (stored) {
                    return {
                        password: stored,
                    }
                }

                const result = await vscode.window.showInputBox({
                    password: true,
                    placeHolder: 'Enter password',
                    title: `Enter password for ${target.name}`,
                })

                if (result) {
                    return {
                        password: result,
                    }
                }

                vscode.window.showInformationMessage(`Password for ${target.name} is not set`)
            }
        },
    )
}

async function upload({
    currentUpload,
    mappings,
    pathname,
    sftp,
}: {
    currentUpload: (pathname: string) => void
    mappings: Mapping[]
    pathname: string
    sftp: SftpClient
}) {
    const file = await fs.stat(pathname)

    if (file.isDirectory()) {
        const entries = await fs.readdir(pathname)

        for (const entry of entries) {
            await upload({
                currentUpload,
                mappings,
                pathname: path.join(pathname, entry),
                sftp,
            })
        }
    } else {
        const workspacePath = pathname.replace(
            vscode.workspace.getWorkspaceFolder(vscode.Uri.file(pathname))?.uri.fsPath ?? '',
            '',
        )

        currentUpload?.(workspacePath)

        const mappedPath = mappings?.length ? pathMapping(workspacePath, mappings) : workspacePath
        const remotePath = path.join(await sftp.cwd(), mappedPath)

        await sftp.mkdir(path.dirname(remotePath), true)
        await sftp.put(pathname, remotePath)
    }
}

async function uploadWithProgress(sftp: SftpClient, target: Target, uris: vscode.Uri[]) {
    try {
        const total = await vscode.window.withProgress(
            { cancellable: false, location: vscode.ProgressLocation.Notification, title: 'Uploading files' },
            async (progress) => {
                let total = 0

                for (const uri of uris) {
                    logger.appendLine(`Uploading file: ${uri.fsPath}`)
                    await upload({
                        currentUpload: (pathname) => {
                            progress.report({ message: `Uploading file: ${pathname}` })
                            total++
                        },
                        mappings: target.mappings,
                        pathname: uri.fsPath,
                        sftp,
                    })
                }

                return total
            },
        )

        vscode.window.showInformationMessage(`Uploaded ${total} files to ${target.name}`)
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to upload files to ${target.name}, error: ${error instanceof Error ? error.message : String(error)}`,
        )
    }
}

export { activate, deactivate }
