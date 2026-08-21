import { differenceInDays } from 'date-fns'
import * as vscode from 'vscode'

import type { Target } from '~/shared'

import { getSecretStorageKey } from './get-secret-storage-key'

async function secretVerify(context: vscode.ExtensionContext, target: Target, secretType: 'passphrase' | 'password') {
    const storageKey = getSecretStorageKey(target.name, secretType)
    const storedAt = context.globalState.get<number>(storageKey)

    if (storedAt === undefined) {
        return
    }

    const maxAge =
        (secretType === 'passphrase' ? target.connection.passphraseMaxAge : target.connection.passwordMaxAge) ?? 30

    if (differenceInDays(Date.now(), storedAt) > maxAge) {
        await context.secrets.delete(storageKey)
        await context.globalState.update(storageKey, undefined)
    }
}

export { secretVerify }
