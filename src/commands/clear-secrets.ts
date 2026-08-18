import * as vscode from 'vscode'

import type { Target } from '~/core'

import { getConfig, getSecretStorageKey, promptTargets } from '~/platform'

async function clearSecrets(context: vscode.ExtensionContext) {
    const config = getConfig(context)

    const targets = config.value.get<Target[]>('targets')
    if (!targets) {
        vscode.window.showInformationMessage('No targets found in the extension configuration')
        return
    }

    const targetsSelected = await promptTargets(targets)
    if (!targetsSelected?.length) {
        vscode.window.showInformationMessage('No targets selected')
        return
    }

    for (const target of targets) {
        context.secrets.delete(getSecretStorageKey(target.name, 'passphrase'))
        context.globalState.update(getSecretStorageKey(target.name, 'passphrase'), undefined)

        context.secrets.delete(getSecretStorageKey(target.name, 'password'))
        context.globalState.update(getSecretStorageKey(target.name, 'password'), undefined)
    }
}

export { clearSecrets }
