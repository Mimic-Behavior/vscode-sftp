function getSecretStorageKey(targetName: string) {
    return `sftp.${targetName}.secret`
}

export { getSecretStorageKey }
