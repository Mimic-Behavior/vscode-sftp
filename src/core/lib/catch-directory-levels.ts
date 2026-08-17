import path from 'node:path'

/**
 * Collects every directory between `rootPath` (exclusive) and the given directories,
 * grouped by depth and ordered parents first, so that each level can be created in parallel.
 * Expects posix separators.
 */
function catchDirectoryLevels(rootPath: string, directoryPaths: string[]): string[][] {
    const levels = new Map<number, Set<string>>()

    for (const directoryPath of new Set(directoryPaths)) {
        let current = directoryPath

        while (current !== rootPath && current.startsWith(`${rootPath}/`)) {
            const depth = current.split('/').length
            let level = levels.get(depth)

            if (level === undefined) {
                level = new Set()
                levels.set(depth, level)
            }

            level.add(current)

            current = path.posix.dirname(current)
        }
    }

    return [...levels.entries()].sort(([left], [right]) => left - right).map(([, level]) => [...level])
}

export { catchDirectoryLevels }
