import * as vscode from 'vscode'

import { throttle } from '~/shared/utils'

const REPORT_INTERVAL = 100

function createProgressReporter(progress: vscode.Progress<{ increment?: number; message?: string }>, total: number) {
    let completed = 0
    let increment = 0

    return throttle((message?: string) => {
        completed = completed + 1
        increment = increment + 100 / total

        progress.report({
            increment,
            message: message ? `${completed} / ${total} - ${message}` : `${completed} / ${total}`,
        })
    }, REPORT_INTERVAL)
}

export { createProgressReporter }
