import * as vscode from 'vscode'

import { CancelledError } from '~/shared'

import { getSecretStorageKey } from './get-secret-storage-key'
import { promptSecret } from './ui'

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

    const result = await promptSecret(`Enter ${secretType} for ${targetName}`)

    if (result === undefined) {
        throw new CancelledError(`${secretType} prompt for ${targetName}`)
    }

    return result
}

export { resolveSecret }
