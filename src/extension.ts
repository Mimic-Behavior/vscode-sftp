import * as vscode from 'vscode'

import { deploy } from './commands'

async function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('sftp.deploy', (_, uris: vscode.Uri[]) => deploy(uris, context))

    context.subscriptions.push(disposable)
}

function deactivate() {}

export { activate, deactivate }
