function throttle<A, R>(fn: (...args: A[]) => R, delay: number): (...args: A[]) => R | undefined {
    let lastCalledAt = 0

    return function (...args: A[]) {
        const now = Date.now()

        if (now - lastCalledAt < delay) {
            return
        }

        lastCalledAt = now

        return fn(...args)
    }
}

export { throttle }
