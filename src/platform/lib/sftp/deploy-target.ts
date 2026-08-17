import path from 'node:path'
import pLimit from 'p-limit'
import * as vscode from 'vscode'

import { CancelledError, type File } from '~/core'

import type { Target } from '../../types'
import type { ProgressReporter } from '../../ui/make-progress-reporter'
import type { Auth } from './resolve-auth'

import { makeFileTasks } from '../plan'
import { ensureDirectories } from './ensure-directories'
import { makeClient } from './make-client'
import { makeUploader } from './make-uploader'

/**
 * Sequential streaming spends a round trip per chunk, so several files have to be in flight
 * to keep a high latency link busy. Servers tend to cap concurrent operations, hence the ceiling.
 */
const FILE_CONCURRENCY = 8
const MAX_FILE_CONCURRENCY = 64

type DeployTargetOptions = {
    auth: Auth
    files: File[]
    onConnected: () => Promise<void>
    report: ProgressReporter
    sourceRootPath: string
    target: Target
    token: vscode.CancellationToken
}

async function deployTarget({ auth, files, onConnected, report, sourceRootPath, target, token }: DeployTargetOptions) {
    const client = await makeClient(target, auth, token)

    try {
        await onConnected()

        const remoteRootPath = await client.realpath('.')
        const tasks = makeFileTasks({ files, remoteRootPath, sourceRootPath, target })

        if (tasks.length === 0) {
            return
        }

        await ensureDirectories(
            client,
            remoteRootPath,
            tasks.map((task) => task.remoteDirectoryPath),
        )

        const upload = makeUploader(client, target.transfer ?? 'stream')
        const limit = pLimit({
            concurrency: Math.min(Math.max(target.concurrency ?? FILE_CONCURRENCY, 1), MAX_FILE_CONCURRENCY),
            rejectOnClear: true,
        })

        const promises = tasks.map((task) => {
            return limit(async () => {
                if (token.isCancellationRequested) {
                    throw new CancelledError(target.name)
                }

                await upload(task.sourceFilePath, task.remoteFilePath)

                report(`${target.name}: ${path.posix.basename(task.remoteFilePath)}`)
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
