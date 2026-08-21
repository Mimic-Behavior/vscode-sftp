import * as vscode from 'vscode'

import type { Target } from '~/shared'

import { getSecretStorageKey, promptTargets } from '~/platform'

const EXTENSION_KEY = 'sftp'
const SECRET_TYPES = ['passphrase', 'password'] as const

async function clearSecrets(context: vscode.ExtensionContext) {
    const targets = vscode.workspace.getConfiguration(EXTENSION_KEY).get<Target[]>('targets')
    if (!targets?.length) {
        vscode.window.showInformationMessage('No targets found in the extension configuration')
        return
    }

    const targetsSelected = await promptTargets(targets)
    if (!targetsSelected?.length) {
        vscode.window.showInformationMessage('No targets selected')
        return
    }

    await Promise.all(targetsSelected.map((target) => clearTargetSecrets(context, target)))

    vscode.window.showInformationMessage(
        targetsSelected.length === 1
            ? `Cleared secrets for ${targetsSelected[0].name}`
            : `Cleared secrets for ${targetsSelected.length} targets`,
    )
}

async function clearTargetSecrets(context: vscode.ExtensionContext, target: Target) {
    for (const secretType of SECRET_TYPES) {
        const storageKey = getSecretStorageKey(target.name, secretType)

        await context.secrets.delete(storageKey)
        await context.globalState.update(storageKey, undefined)
    }
}

export { clearSecrets }
