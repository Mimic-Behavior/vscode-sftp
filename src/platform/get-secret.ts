import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import * as vscode from 'vscode'

import type { Target } from '~/core'

import { promptPassword } from './ui'

async function getSecret(
    context: vscode.ExtensionContext,
    target: Target,
    storageKey: string,
): Promise<{ password: string } | { privateKey: string } | undefined> {
    try {
        const privateKeyPath = target.privateKey.startsWith('~/')
            ? path.join(os.homedir(), target.privateKey.slice(1))
            : target.privateKey

        await fs.access(privateKeyPath)

        return {
            privateKey: await fs.readFile(privateKeyPath, 'utf-8'),
        }
    } catch {
        const stored = await context.secrets.get(storageKey)
        if (stored) {
            return {
                password: stored,
            }
        }

        const result = await promptPassword(target)
        if (result) {
            return {
                password: result,
            }
        }
    }
}

export { getSecret }
