import type { SftpClient } from '@mimic-behavior/ssh2-sftp-client'

import { sftpUtils } from '@mimic-behavior/ssh2-sftp-client'

import type { Transfer } from '../../types'

import { getLogger } from '../get-logger'

const CHUNK_CONCURRENCY = 32
const CHUNK_SIZE = 32_768

type Uploader = (sourceFilePath: string, remoteFilePath: string) => Promise<void>

/**
 * `put` streams a file sequentially: ssh2 keeps a single WRITE request in flight, so it costs
 * a round trip per chunk, but every server handles it. `fastPut` pipelines writes at explicit
 * offsets, which is far faster on high latency links, yet servers that expect sequential
 * writes reject it. Hence sequential streaming is the default and the parallel mode latches
 * itself off for the rest of the connection as soon as the server refuses a transfer.
 */
function makeUploader(client: SftpClient, transfer: Transfer): Uploader {
    let isParallel = transfer === 'parallel'

    return async function upload(sourceFilePath: string, remoteFilePath: string) {
        if (isParallel) {
            const result = await sftpUtils.attempt(() =>
                client.fastPut(sourceFilePath, remoteFilePath, {
                    chunkSize: CHUNK_SIZE,
                    concurrency: CHUNK_CONCURRENCY,
                }),
            )

            if (!(result instanceof Error)) {
                return
            }

            isParallel = false

            getLogger().value.appendLine(
                `Parallel transfer of ${remoteFilePath} failed (${result.message}), falling back to sequential streaming`,
            )
        }

        // Opens the remote file with "w", so a partial parallel attempt gets truncated
        await client.put(sourceFilePath, remoteFilePath)
    }
}

export { makeUploader }
export type { Uploader }
