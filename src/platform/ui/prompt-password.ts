import * as vscode from 'vscode'

function promptPassword(placeHolder: string) {
    return vscode.window.showInputBox({ ignoreFocusOut: true, password: true, placeHolder })
}

export { promptPassword }
