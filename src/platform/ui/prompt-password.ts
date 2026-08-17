import * as vscode from 'vscode'

function promptPassword(title: string) {
    return vscode.window.showInputBox({ ignoreFocusOut: true, password: true, title })
}

export { promptPassword }
