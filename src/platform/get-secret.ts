import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import * as vscode from 'vscode'

import type { Secret, Target } from '~/core'

import { promptPassword } from './ui'

async function getSecret(
    context: vscode.ExtensionContext,
    target: Target,
    storageKey: string,
): Promise<Secret | undefined> {
    const stored = await context.secrets.get(storageKey)

    try {
        const privateKeyPath = target.privateKey.startsWith('~/')
            ? path.join(os.homedir(), target.privateKey.slice(1))
            : target.privateKey

        await fs.access(privateKeyPath)

        if (stored !== undefined) {
            return {
                passphrase: stored,
                privateKey: await fs.readFile(privateKeyPath, 'utf-8'),
            }
        } else {
            const result = await promptPassword(`Enter private key passphrase for ${target.name}`)

            return {
                passphrase: result,
                privateKey: await fs.readFile(privateKeyPath, 'utf-8'),
            }
        }
    } catch {
        if (stored !== undefined) {
            return {
                password: stored,
            }
        } else {
            const result = await promptPassword(`Enter password for ${target.name}`)

            return {
                password: result,
            }
        }
    }
}

export { getSecret }
