import * as vscode from 'vscode'

import type { Target } from '~/core'

import type { Auth } from './resolve-auth'

import { getLogger } from '../get-logger'
import { getSecretStorageKey } from '../get-secret-storage-key'

async function remember(
    context: vscode.ExtensionContext,
    target: Target,
    type: 'passphrase' | 'password',
    secret: string,
) {
    const storageKey = getSecretStorageKey(target.name, type)

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

function rememberSecretsQuietly(context: vscode.ExtensionContext, target: Target, auth: Auth) {
    const logger = getLogger()

    return rememberSecrets(context, target, auth).catch((error) => {
        logger.value.appendLine(`Could not store credentials for ${target.name}: ${error}`)
    })
}

export { rememberSecrets, rememberSecretsQuietly }
