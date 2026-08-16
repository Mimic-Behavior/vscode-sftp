import * as vscode from 'vscode'

import { getSecretStorageKey, promptTargets } from '~/platform'

async function clearSecrets(context: vscode.ExtensionContext) {
    const targets = await promptTargets(context)

    if (!targets?.length) {
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
