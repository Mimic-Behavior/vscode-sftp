import * as vscode from 'vscode'

import { deploy } from './commands'
import { clearSecrets } from './platform'

async function activate(context: vscode.ExtensionContext) {
    await clearSecrets(context)

    const disposable = vscode.commands.registerCommand('sftp.deploy', (_, uris: vscode.Uri[]) => deploy(uris, context))

    context.subscriptions.push(disposable)
}

function deactivate() {}

export { activate, deactivate }
