import { utils } from '@mimic-behavior/ssh2'

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

export { needsPassphrase }
