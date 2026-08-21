import * as vscode from 'vscode'

function toAbortSignal(token: vscode.CancellationToken): AbortSignal {
    const controller = new AbortController()

    if (token.isCancellationRequested) {
        controller.abort()
    } else {
        token.onCancellationRequested(() => controller.abort())
    }

    return controller.signal
}

export { toAbortSignal }
