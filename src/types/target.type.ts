import type { Mapping } from './mapping.type'

type Target = {
    hasButton: boolean
    host: string
    mappings: Mapping[]
    name: string
    port: number
    privateKey: string
    username: string
}

export type { Target }
