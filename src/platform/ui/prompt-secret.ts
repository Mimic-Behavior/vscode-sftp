import * as vscode from 'vscode'

function promptSecret(title: string) {
    return vscode.window.showInputBox({ ignoreFocusOut: true, password: true, title })
}

export { promptSecret }
