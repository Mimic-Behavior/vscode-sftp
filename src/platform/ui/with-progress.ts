import * as vscode from 'vscode'

function withProgress<T>(
    task: (
        progress: vscode.Progress<{ increment?: number; message?: string }>,
        token: vscode.CancellationToken,
    ) => Promise<T>,
    options?: Omit<vscode.ProgressOptions, 'location'>,
): Thenable<T> {
    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            ...options,
        },
        task,
    )
}

export { withProgress }
