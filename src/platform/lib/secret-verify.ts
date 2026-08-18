import { differenceInDays } from 'date-fns'
import * as vscode from 'vscode'

import type { Target } from '~/core'

import { getSecretStorageKey } from './get-secret-storage-key'

function secretVerify(context: vscode.ExtensionContext, target: Target, type: 'passphrase' | 'password') {
    const storageKey = getSecretStorageKey(target.name, type)
    const storageLastUpdate = context.globalState.get<number>(storageKey)

    if (storageLastUpdate === undefined) {
        return
    }

    if (
        differenceInDays(Date.now(), storageLastUpdate) >
        ((type === 'passphrase' ? target.connection.passphraseMaxAge : target.connection.passwordMaxAge) ?? 30)
    ) {
        context.secrets.delete(storageKey)
        context.globalState.update(storageKey, undefined)
    }
}

export { secretVerify }
