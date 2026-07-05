import * as vscode from 'vscode'

import { EXTENSION_KEY } from '~/core'

let logger: { value: vscode.OutputChannel }

function getLogger() {
    if (!logger) {
        logger = {
            value: vscode.window.createOutputChannel(EXTENSION_KEY, { log: true }),
        }
    }

    return logger
}

export { getLogger }
