import { utils } from '@mimic-behavior/ssh2'
import { SftpClient, sftpUtils } from '@mimic-behavior/ssh2-sftp-client'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pLimit from 'p-limit'
import * as vscode from 'vscode'

import { catchFiles, type File, pathMapping } from '~/core'
import { getLogger, getSecretStorageKey, promptPassword, promptTargets, type Target, withProgress } from '~/platform'

async function makeClient(context: vscode.ExtensionContext, target: Target): Promise<SftpClient | undefined> {
    const sftp = new SftpClient()
    const auth = await resolveAuth(context, target)

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
                    host: target.connection.host,
                    port: target.connection.port,
                    username: target.connection.username,
                    ...auth,
                })
            },
            { cancellable: true, title: `Connecting to ${target.name}` },
        )

        if (auth?.passphrase) {
            context.secrets.store(getSecretStorageKey(target.name, 'passphrase'), auth.passphrase)
            context.globalState.update(getSecretStorageKey(target.name, 'passphrase'), Date.now())
        }

        if (auth?.password) {
            context.secrets.store(getSecretStorageKey(target.name, 'password'), auth.password)
            context.globalState.update(getSecretStorageKey(target.name, 'password'), Date.now())
        }
    } catch (error) {
        if (isConnectionCancelled) {
            throw new Error(`Connection to ${target.name} was cancelled`)
        } else {
            throw new Error(`Error connecting to ${target.name}: ${error}`)
        }
    }

    return sftp
}

function makeFileTasks({
    files,
    remoteRootPath,
    sourceRootPath,
    target,
}: {
    files: File[]
    remoteRootPath: string
    sourceRootPath: string
    target: Target
}) {
    const fileTasks: {
        remoteDirectoryPath: string
        remoteFilePath: string
        sourceFilePath: string
    }[] = []

    for (const file of files) {
        const sourcePath = path.resolve('/', path.relative(sourceRootPath, file.pathname))
        const mappedPath = pathMapping(sourcePath, target.mappings || [])

        if (target.mappingsOnly && mappedPath === sourcePath) {
            continue
        }

        const remotePath = path.posix.join(remoteRootPath, mappedPath)

        fileTasks.push({
            remoteDirectoryPath: path.posix.dirname(remotePath),
            remoteFilePath: remotePath,
            sourceFilePath: file.pathname,
        })
    }

    return fileTasks
}

function needsPassphrase(privateKey: string): boolean {
    const parsed = utils.parseKey(privateKey)

    if (!(parsed instanceof Error)) {
        return false
    }

    const message = parsed.message.toLowerCase()

    // oxfmt-ignore
    return (
        message.includes('encrypted') ||
        message.includes('passphrase')
    )
}

async function resolveAuth(context: vscode.ExtensionContext, target: Target) {
    if (target.connection.password) {
        return {
            password: await resolveSecret(context, target.name, 'password'),
        }
    }

    if (target.connection.privateKey) {
        const privateKeyPathResolved = target.connection.privateKey.startsWith('~/')
            ? path.join(os.homedir(), target.connection.privateKey.slice(1))
            : target.connection.privateKey
        const privateKey = await fs.readFile(privateKeyPathResolved, 'utf-8')

        const askPassphrase = target.connection.passphrase === true || needsPassphrase(privateKey)

        if (askPassphrase) {
            return {
                passphrase: await resolveSecret(context, target.name, 'passphrase'),
                privateKey,
            }
        } else {
            return {
                privateKey,
            }
        }
    }
}

async function resolveSecret(
    context: vscode.ExtensionContext,
    targetName: string,
    secretType: 'passphrase' | 'password',
): Promise<string | undefined> {
    const storageKey = getSecretStorageKey(targetName, secretType)
    const stored = await context.secrets.get(storageKey)

    if (stored !== undefined) {
        return stored
    }

    return promptPassword(`Enter ${secretType} for ${targetName}`)
}

async function upload(uris: vscode.Uri[], context: vscode.ExtensionContext) {
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

    const files = await catchFiles(uris.map((uri) => uri.fsPath))

    await Promise.all(
        targets.map(async (target) => {
            const client = await makeClient(context, target).catch((error) => {
                vscode.window.showInformationMessage(error instanceof Error ? error.message : String(error))
            })

            if (!client) {
                return
            }

            const limit = pLimit({ concurrency: 4, rejectOnClear: true })

            try {
                await withProgress(
                    async (progress) => {
                        const ensuredDirectories = useEnsuredDirectories(client)

                        const remoteRootPath = await client.realpath('.')
                        const sourceRootPath = vscode.workspace.getWorkspaceFolder(uris[0])?.uri.fsPath || ''

                        const fileTasks = makeFileTasks({ files, remoteRootPath, sourceRootPath, target })

                        const promises = fileTasks.map(({ remoteDirectoryPath, remoteFilePath, sourceFilePath }) => {
                            // eslint-disable-next-line sonarjs/no-nested-functions
                            return limit(async () => {
                                await ensuredDirectories.ensure(remoteDirectoryPath)
                                progress.report({ message: `Uploading file: ${remoteFilePath}` })
                                await client.put(sourceFilePath, remoteFilePath)
                            })
                        })

                        try {
                            await Promise.all(promises)
                        } catch (error) {
                            limit.clearQueue()

                            await Promise.allSettled(promises)

                            throw error
                        }
                    },
                    {
                        title: `Uploading to ${target.name}`,
                    },
                )
            } catch (error) {
                const message = `Error uploading files to ${target.name}: ${error}`
                logger.value.appendLine(message)
                vscode.window.showInformationMessage(message)
            } finally {
                client.end()
            }
        }),
    )
}

function useEnsuredDirectories(client: SftpClient) {
    const ensured = new Map<string, Promise<void>>()

    async function ensureSegment(segment: string) {
        const result = await sftpUtils.attempt(() => client.mkdir(segment))

        if (sftpUtils.isSftpError(result) && result.code === utils.sftp.STATUS_CODE.FAILURE) {
            const stats = await sftpUtils.attempt(() => client.stat(segment))

            if (stats instanceof Error) {
                throw stats
            }

            if (stats.isDirectory() === false) {
                throw new Error(`Path exists and is not a directory: ${segment}`)
            }

            return
        }

        if (result instanceof Error) {
            throw result
        }
    }

    async function ensure(directoryPath: string) {
        let current = path.posix.isAbsolute(directoryPath) ? '/' : ''

        for (const segment of directoryPath.split('/').filter(Boolean)) {
            current = path.posix.join(current, segment)

            let pending = ensured.get(current)

            if (pending === undefined) {
                pending = ensureSegment(current)
                ensured.set(current, pending)
            }

            await pending
        }
    }

    return {
        ensure,
    }
}

export { upload }
