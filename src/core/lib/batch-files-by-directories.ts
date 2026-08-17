import path from 'node:path'

import type { File } from '../types'

function batchFilesByDirectories(files: File[]) {
    const batches = new Map<string, string[]>()

    for (const file of files) {
        const batchDirectory = path.dirname(file.pathname)
        const batch = batches.get(batchDirectory)

        const filename = path.basename(file.pathname)

        if (batch) {
            batch.push(filename)
        } else {
            batches.set(batchDirectory, [filename])
        }
    }

    return batches
}

export { batchFilesByDirectories }
