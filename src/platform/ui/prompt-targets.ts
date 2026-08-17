import * as vscode from 'vscode'

import type { Target } from '~/platform'

import { getConfig } from '../lib/get-config'

async function promptTargets(context: vscode.ExtensionContext) {
    const config = getConfig(context)
    const targets = config.value.get<Target[]>('targets') ?? []
    const targetsNames = targets.map((target) => target.name)

    const result = await vscode.window.showQuickPick(targetsNames, {
        canPickMany: true,
        ignoreFocusOut: true,
        matchOnDescription: false,
        matchOnDetail: false,
    })

    return result ? targets.filter((target) => result.includes(target.name)) : []
}

export { promptTargets }
