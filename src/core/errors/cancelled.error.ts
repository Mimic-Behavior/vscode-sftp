class CancelledError extends Error {
    constructor(subject: string) {
        super(`Cancelled: ${subject}`)

        this.name = 'CancelledError'
    }
}

export { CancelledError }
