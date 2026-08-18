import { SftpClient } from '@mimic-behavior/ssh2-sftp-client'
import * as vscode from 'vscode'

import type { Auth } from '~/platform'

import type { Target } from '../../types'

import { CancelledError, ConnectionError } from '../../errors'

const KEEPALIVE_INTERVAL = 10_000

async function createClient(target: Target, auth: Auth, token: vscode.CancellationToken): Promise<SftpClient> {
    const sftp = new SftpClient()

    token.onCancellationRequested(() => sftp.ssh2.destroy())

    try {
        await sftp.connect({
            host: target.connection.host,
            keepaliveInterval: KEEPALIVE_INTERVAL,
            port: target.connection.port,
            username: target.connection.username,
            ...auth,
        })
    } catch (error) {
        if (token.isCancellationRequested) {
            throw new CancelledError(target.name)
        }

        throw new ConnectionError(target.name, { cause: error })
    }

    sftp.ssh2.setNoDelay(true)

    return sftp
}

export { createClient }
