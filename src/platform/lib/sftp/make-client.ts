import { SftpClient } from '@mimic-behavior/ssh2-sftp-client'
import * as vscode from 'vscode'

import { CancelledError, ConnectionError } from '~/core'

import type { Target } from '../../types'
import type { Auth } from './resolve-auth'

const KEEPALIVE_INTERVAL = 10_000

async function makeClient(target: Target, auth: Auth, token: vscode.CancellationToken): Promise<SftpClient> {
    const sftp = new SftpClient()

    // Stays subscribed for the whole operation so that cancelling aborts an in-flight transfer too
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

    // Nagle's algorithm hurts latency of the many small SFTP packets
    sftp.ssh2.setNoDelay(true)

    return sftp
}

export { makeClient }
