import path from 'node:path'

function groupDirectoriesByDepth(rootPath: string, directories: string[]): string[][] {
    const groups = new Map<number, Set<string>>()

    for (const directory of new Set(directories)) {
        let current = directory

        while (current !== rootPath && current.startsWith(`${rootPath}/`)) {
            const depth = current.split('/').length

            let group = groups.get(depth)

            if (group === undefined) {
                group = new Set()
                groups.set(depth, group)
            }

            group.add(current)

            current = path.posix.dirname(current)
        }
    }

    return [...groups.entries()].sort(([a], [b]) => a - b).map(([, depth]) => [...depth])
}

export { groupDirectoriesByDepth }
