function getSecretStorageKey(targetName: string, secretType: 'passphrase' | 'password') {
    return `mimic-sftp.${targetName}.${secretType}`
}

export { getSecretStorageKey }
