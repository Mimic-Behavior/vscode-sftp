import * as vscode from 'vscode'

import { EXTENSION_KEY } from '../config/constants'

let logger: { value: vscode.OutputChannel }

function getLogger() {
    if (logger === undefined) {
        logger = {
            value: vscode.window.createOutputChannel(EXTENSION_KEY, { log: true }),
        }
    }

    return logger
}

export { getLogger }
