import * as vscode from 'vscode'

import type { Target } from '~/core'

function promptPassword(target: Target) {
    return vscode.window.showInputBox({ password: true, title: `Enter password for ${target.name}` })
}

export { promptPassword }
