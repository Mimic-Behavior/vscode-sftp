import * as vscode from 'vscode'

import type { Auth, Target } from '~/shared'

import { getSecretStorageKey } from './get-secret-storage-key'

async function remember(
    context: vscode.ExtensionContext,
    target: Target,
    secretType: 'passphrase' | 'password',
    secret: string,
) {
    const storageKey = getSecretStorageKey(target.name, secretType)

    await context.secrets.store(storageKey, secret)
    await context.globalState.update(storageKey, Date.now())
}

async function rememberSecrets(context: vscode.ExtensionContext, target: Target, auth: Auth) {
    if (auth.passphrase !== undefined) {
        await remember(context, target, 'passphrase', auth.passphrase)
    }

    if (auth.password !== undefined) {
        await remember(context, target, 'password', auth.password)
    }
}

export { rememberSecrets }
