import pLimit from 'p-limit'
import * as vscode from 'vscode'

import {
    CancelledError,
    createClient,
    createUploader,
    createUploadTasks,
    ensureDirectories,
    type File,
    type Target,
    type Task,
} from '~/core'

import type { Auth } from './resolve-auth'

const FILE_CONCURRENCY = 8
const MAX_FILE_CONCURRENCY = 64
const MIN_FILE_CONCURRENCY = 1

type DeployTargetOptions = {
    auth: Auth
    files: File[]
    onConnected: () => Promise<void>
    onUpload: (task: Task) => void
    sourceRootPath: string
    target: Target
    token: vscode.CancellationToken
}

async function deployTarget({
    auth,
    files,
    onConnected,
    onUpload,
    sourceRootPath,
    target,
    token,
}: DeployTargetOptions) {
    const client = await createClient(target, auth, token)

    try {
        await onConnected()

        const remoteRootPath = await client.realpath('.')
        const tasks = createUploadTasks({ files, remoteRootPath, sourceRootPath, target })

        if (tasks.length === 0) {
            return
        }

        await ensureDirectories(
            client,
            remoteRootPath,
            tasks.map((task) => task.remoteDirectoryPath),
        )

        const upload = createUploader(client, target.transfer ?? 'stream')
        const limit = pLimit({
            concurrency: Math.min(
                Math.max(target.concurrency ?? FILE_CONCURRENCY, MIN_FILE_CONCURRENCY),
                MAX_FILE_CONCURRENCY,
            ),
            rejectOnClear: true,
        })

        const promises = tasks.map((task) => {
            return limit(async () => {
                if (token.isCancellationRequested) {
                    throw new CancelledError(target.name)
                }

                await upload(task.sourceFilePath, task.remoteFilePath)
                await onUpload(task)
            })
        })

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

export { deployTarget }
