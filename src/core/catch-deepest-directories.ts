import path from 'node:path'

import type { File } from './types'

function catchDeepestDirectories(files: File[]) {
    const pathnames: string[] = []

    for (const file of files) {
        if (pathnames.includes(file.pathname)) {
            continue
        }

        if (file.type === 'directory') {
            pathnames.push(file.pathname)
        } else {
            pathnames.push(path.dirname(file.pathname))
        }
    }

    /**
     * pathnames:
     * [
     *     'src',
     *     'src/utils',
     *     'src/platform',
     *     'src/platform/ui',
     *     'src/platform/types',
     *     'src/core',
     *     'src/commands',
     * ]
     */
    return pathnames.filter((pathname) => !pathnames.some((other) => other !== pathname && other.startsWith(pathname)))
}

export { catchDeepestDirectories }
