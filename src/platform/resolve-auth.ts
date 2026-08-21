import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import * as vscode from 'vscode'

import type { Auth, Target } from '~/shared'

import { needsPassphrase } from '~/core'

import { resolveSecret } from './resolve-secret'

async function resolveAuth(context: vscode.ExtensionContext, target: Target): Promise<Auth> {
    if (target.connection.password) {
        return {
            password: await resolveSecret(context, target.name, 'password'),
        }
    }

    if (target.connection.privateKey) {
        const privateKeyPathResolved = target.connection.privateKey.startsWith('~/')
            ? path.join(os.homedir(), target.connection.privateKey.slice(1))
            : target.connection.privateKey
        const privateKey = await fs.readFile(privateKeyPathResolved, 'utf-8')

        if (target.connection.passphrase === true || needsPassphrase(privateKey)) {
            return {
                passphrase: await resolveSecret(context, target.name, 'passphrase'),
                privateKey,
            }
        } else {
            return {
                privateKey,
            }
        }
    }

    return {}
}

export { resolveAuth }
