import * as vscode from 'vscode'

import { EXTENSION_KEY, type Target } from '~/core'

import { getSecretStorageKey } from './utils'

async function clearSecrets(context: vscode.ExtensionContext) {
    const targets = vscode.workspace.getConfiguration(EXTENSION_KEY).get<Target[]>('targets') ?? []

    await Promise.all(targets.map((target) => context.secrets.delete(getSecretStorageKey(target.name))))
}

export { clearSecrets }
