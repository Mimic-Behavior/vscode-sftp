type Target = {
    commands?: {
        onAfter?: string
    }
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
}

export type { Target }
