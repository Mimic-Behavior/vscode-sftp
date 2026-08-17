import { EXTENSION_KEY } from '../config/constants'

function getSecretStorageKey(targetName: string, type: 'passphrase' | 'password') {
    return `${EXTENSION_KEY}.${targetName}.${type}`
}

export { getSecretStorageKey }
