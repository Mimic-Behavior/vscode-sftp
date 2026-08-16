import * as vscode from 'vscode'

import { clearSecrets, upload } from './commands'
import { EXTENSION_KEY, secretVerify, type Target } from './platform'

async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('sftp.upload', (_, uris: vscode.Uri[]) => upload(uris, context)),
        vscode.commands.registerCommand('sftp.clearSecrets', () => clearSecrets(context)),
    )

    const targets = vscode.workspace.getConfiguration(EXTENSION_KEY).get<Target[]>('targets') ?? []

    for (const target of targets) {
        secretVerify(context, target, 'passphrase')
        secretVerify(context, target, 'password')
    }
}

function deactivate() {}

export { activate, deactivate }
