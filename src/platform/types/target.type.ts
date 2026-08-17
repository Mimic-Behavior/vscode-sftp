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
    mappings?: { from: string; to: string }[]
    mappingsOnly?: boolean
    name: string
    transfer?: Transfer
}

type Transfer = 'parallel' | 'stream'

export type { Target, Transfer }
