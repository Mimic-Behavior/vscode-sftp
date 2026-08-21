import fs from 'node:fs/promises'
import path from 'node:path'

import type { File } from '~/shared'

async function collectFiles(pathnames: string[]): Promise<File[]> {
    const result: string[] = []

    for (const pathname of pathnames) {
        const stats = await fs.stat(pathname)

        if (stats.isDirectory()) {
            const files = await fs.readdir(pathname, { recursive: true, withFileTypes: true })
            const filesPathnames = files.length
                ? files.filter((file) => file.isFile()).map((file) => path.join(file.parentPath, file.name))
                : []

            result.push(...filesPathnames)
        } else {
            result.push(pathname)
        }
    }

    return result.map((pathname) => ({ pathname, type: 'file' }))
}

export { collectFiles }
