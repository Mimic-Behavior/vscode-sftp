class ConnectionError extends Error {
    constructor(subject: string, options?: ErrorOptions) {
        super(`Could not connect to ${subject}`, options)

        this.name = 'ConnectionError'
    }
}

export { ConnectionError }
