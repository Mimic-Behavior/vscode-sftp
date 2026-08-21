import * as vscode from 'vscode'

import { clearSecrets, upload } from '~/commands'
import { secretVerify } from '~/platform'
import { type Target } from '~/shared'

const EXTENSION_KEY = 'sftp'

async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('sftp.upload', (_, uris: vscode.Uri[]) => upload(uris, context)),
        vscode.commands.registerCommand('sftp.clearSecrets', () => clearSecrets(context)),
    )

    const targets = vscode.workspace.getConfiguration(EXTENSION_KEY).get<Target[]>('targets') ?? []

    await Promise.all(
        targets.flatMap((target) => [
            secretVerify(context, target, 'passphrase'),
            secretVerify(context, target, 'password'),
        ]),
    )
}

function deactivate() {}

export { activate, deactivate }
