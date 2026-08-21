import path from 'node:path'

import { type File, pathMapping, type Target } from '~/shared'

type Task = {
    remoteDirectoryPath: string
    remoteFilePath: string
    sourceFilePath: string
}

function createUploadTasks({
    files,
    remoteRootPath,
    sourceRootPath,
    target,
}: {
    files: File[]
    remoteRootPath: string
    sourceRootPath: string
    target: Target
}) {
    const fileTasks: Task[] = []

    for (const file of files) {
        const sourcePath = path.resolve('/', path.relative(sourceRootPath, file.pathname))
        const mappedPath = pathMapping(sourcePath, target.mappings || [])

        if (target.mappingsOnly && mappedPath === sourcePath) {
            continue
        }

        const remotePath = path.posix.join(remoteRootPath, mappedPath)

        fileTasks.push({
            remoteDirectoryPath: path.posix.dirname(remotePath),
            remoteFilePath: remotePath,
            sourceFilePath: file.pathname,
        })
    }

    return fileTasks
}

export { createUploadTasks }
