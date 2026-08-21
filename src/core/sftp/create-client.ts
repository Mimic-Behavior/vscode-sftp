import { SftpClient } from '@mimic-behavior/ssh2-sftp-client'

import { type Auth, CancelledError, ConnectionError, type Target } from '~/shared'

const KEEPALIVE_INTERVAL = 10_000

type CreateClientOptions = {
    auth: Auth
    signal: AbortSignal
    target: Target
}

async function createClient({ auth, signal, target }: CreateClientOptions): Promise<SftpClient> {
    const sftp = new SftpClient()

    signal.addEventListener('abort', () => sftp.ssh2.destroy())

    try {
        await sftp.connect({
            host: target.connection.host,
            keepaliveInterval: KEEPALIVE_INTERVAL,
            port: target.connection.port,
            username: target.connection.username,
            ...auth,
        })
    } catch (error) {
        if (signal.aborted) {
            throw new CancelledError(target.name)
        }

        throw new ConnectionError(target.name, { cause: error })
    }

    sftp.ssh2.setNoDelay(true)

    return sftp
}

export { createClient }
