import path from 'node:path'

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

    return [...levels.entries()].sort(([a], [b]) => a - b).map(([, level]) => [...level])
}

export { catchDirectoryLevels }
