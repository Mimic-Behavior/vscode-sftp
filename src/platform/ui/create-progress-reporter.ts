import throttle from 'es-toolkit/compat/throttle'
import * as vscode from 'vscode'

const REPORT_INTERVAL = 100

function createProgressReporter(progress: vscode.Progress<{ increment?: number; message?: string }>, total: number) {
    let completed = 0
    let reported = 0

    const flush = throttle((message?: string) => {
        const delta = completed - reported

        if (delta === 0) {
            return
        }

        reported = completed
        progress.report({
            increment: (delta / total) * 100,
            message: message ? `${completed} / ${total} - ${message}` : `${completed} / ${total}`,
        })
    }, REPORT_INTERVAL)

    return (message?: string) => {
        completed = completed + 1

        flush(message)
    }
}

export { createProgressReporter }
