import * as vscode from 'vscode'

import { EXTENSION_KEY } from '~/core'

let config: { value: vscode.WorkspaceConfiguration }

function getConfig(context: vscode.ExtensionContext) {
    if (!config) {
        config = {
            value: vscode.workspace.getConfiguration(EXTENSION_KEY),
        }
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(EXTENSION_KEY)) {
                config.value = vscode.workspace.getConfiguration(EXTENSION_KEY)
            }
        }),
    )

    return config
}

export { getConfig }
