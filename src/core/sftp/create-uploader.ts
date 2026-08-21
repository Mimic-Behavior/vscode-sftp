import type { SftpClient } from '@mimic-behavior/ssh2-sftp-client'

import { sftpUtils } from '@mimic-behavior/ssh2-sftp-client'

import type { Transfer } from '~/shared'

const CHUNK_CONCURRENCY = 32
const CHUNK_SIZE = 32_768

function createUploader(client: SftpClient, transfer: Transfer) {
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
        }

        await client.put(sourceFilePath, remoteFilePath)
    }
}

export { createUploader }
