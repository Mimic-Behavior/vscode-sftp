import * as vscode from 'vscode'

const REPORT_INTERVAL = 100

type ProgressReporter = (label: string) => void

/**
 * Turns per-file completions into throttled progress updates, so that large deploys
 * do not re-render the notification thousands of times.
 */
function makeProgressReporter(
    progress: vscode.Progress<{ increment?: number; message?: string }>,
    total: number,
): ProgressReporter {
    let completed = 0
    let pendingIncrement = 0
    let lastReportedAt = 0

    return function report(label: string) {
        completed += 1
        pendingIncrement += 100 / total

        const now = Date.now()

        if (now - lastReportedAt < REPORT_INTERVAL && completed < total) {
            return
        }

        lastReportedAt = now

        progress.report({ increment: pendingIncrement, message: `${completed} / ${total} — ${label}` })

        pendingIncrement = 0
    }
}

export { makeProgressReporter }
export type { ProgressReporter }
