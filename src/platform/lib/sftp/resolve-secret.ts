import * as vscode from 'vscode'

import { CancelledError } from '~/core'

import { promptPassword } from '../../ui/prompt-password'
import { getSecretStorageKey } from '../get-secret-storage-key'

async function resolveSecret(
    context: vscode.ExtensionContext,
    targetName: string,
    secretType: 'passphrase' | 'password',
): Promise<string> {
    const storageKey = getSecretStorageKey(targetName, secretType)
    const stored = await context.secrets.get(storageKey)

    if (stored !== undefined) {
        return stored
    }

    const entered = await promptPassword(`Enter ${secretType} for ${targetName}`)

    if (entered === undefined) {
        throw new CancelledError(`${secretType} prompt for ${targetName}`)
    }

    return entered
}

export { resolveSecret }
