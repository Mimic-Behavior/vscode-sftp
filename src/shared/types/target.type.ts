import type { Mapping } from './mapping.type'
import type { Transfer } from './transfer.type'

type Target = {
    commands?: {
        onAfter?: string
    }
    concurrency?: number
    connection: {
        host: string
        passphrase?: boolean
        passphraseMaxAge?: number
        password?: boolean
        passwordMaxAge?: number
        port: number
        privateKey?: string
        username: string
    }
    mappings?: Mapping[]
    mappingsOnly?: boolean
    name: string
    transfer?: Transfer
}

export type { Target }
