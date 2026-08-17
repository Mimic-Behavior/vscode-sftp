import type { SftpClient } from '@mimic-behavior/ssh2-sftp-client'

import { utils } from '@mimic-behavior/ssh2'
import { sftpUtils } from '@mimic-behavior/ssh2-sftp-client'
import pLimit from 'p-limit'

import { catchDirectoryLevels } from '~/core'

const DIRECTORY_CONCURRENCY = 8

async function ensureDirectories(client: SftpClient, rootPath: string, directoryPaths: string[]) {
    const limit = pLimit({ concurrency: DIRECTORY_CONCURRENCY })

    for (const level of catchDirectoryLevels(rootPath, directoryPaths)) {
        await Promise.all(level.map((directoryPath) => limit(() => ensureDirectory(client, directoryPath))))
    }
}

async function ensureDirectory(client: SftpClient, directoryPath: string) {
    const result = await sftpUtils.attempt(() => client.mkdir(directoryPath))

    if (sftpUtils.isSftpError(result) && result.code === utils.sftp.STATUS_CODE.FAILURE) {
        const stats = await sftpUtils.attempt(() => client.stat(directoryPath))

        if (stats instanceof Error) {
            throw stats
        }

        if (stats.isDirectory() === false) {
            throw new Error(`Path exists and is not a directory: ${directoryPath}`)
        }

        return
    }

    if (result instanceof Error) {
        throw result
    }
}

export { ensureDirectories }
