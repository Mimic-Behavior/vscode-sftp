import * as vscode from 'vscode'

import type { Target } from '~/shared'

async function promptTargets(targets: Target[]) {
    const result = await vscode.window.showQuickPick(
        targets.map((target) => target.name),
        {
            canPickMany: true,
            ignoreFocusOut: true,
            matchOnDescription: false,
            matchOnDetail: false,
        },
    )

    return result ? targets.filter((target) => result.includes(target.name)) : undefined
}

export { promptTargets }
