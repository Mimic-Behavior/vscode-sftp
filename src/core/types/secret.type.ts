type Secret =
    | {
          passphrase?: string
          privateKey: string
      }
    | {
          password?: string
      }

export type { Secret }
