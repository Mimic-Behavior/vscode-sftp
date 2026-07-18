import * as vscode from 'vscode'

function promptPassword(title: string) {
    return vscode.window.showInputBox({ password: true, title })
}

export { promptPassword }
