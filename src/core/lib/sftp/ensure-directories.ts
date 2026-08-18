import type { SftpClient } from '@mimic-behavior/ssh2-sftp-client'

import { utils } from '@mimic-behavior/ssh2'
import { sftpUtils } from '@mimic-behavior/ssh2-sftp-client'
import pLimit from 'p-limit'

import { catchDirectoryLevels } from '../catch-directory-levels'

const DIRECTORY_CONCURRENCY = 8

async function ensureDirectories(client: SftpClient, rootPath: string, directories: string[]) {
    const limit = pLimit({ concurrency: DIRECTORY_CONCURRENCY })

    for (const level of catchDirectoryLevels(rootPath, directories)) {
        await Promise.all(level.map((directory) => limit(() => ensureDirectory(client, directory))))
    }
}

async function ensureDirectory(client: SftpClient, directory: string) {
    const result = await sftpUtils.attempt(() => client.mkdir(directory))

    if (sftpUtils.isSftpError(result) && result.code === utils.sftp.STATUS_CODE.FAILURE) {
        const stats = await sftpUtils.attempt(() => client.stat(directory))

        if (stats instanceof Error) {
            throw stats
        }

        if (stats.isDirectory() === false) {
            throw new Error(`Path exists and is not a directory: ${directory}`)
        }

        return
    }

    if (result instanceof Error) {
        throw result
    }
}

export { ensureDirectories }
