declare module 'ssh2-sftp-client' {
    import type {
        Client,
        ConnectConfig,
        FileEntry,
        ReadStream,
        ReadStreamOptions,
        SFTPWrapper,
        TransferOptions,
        WriteStream,
        WriteStreamOptions,
    } from 'ssh2'

    type SftpClientCallbacks = {
        close?(): void
        end?(): void
        error?(err: Error): void
    }

    type SftpConnectConfig = ConnectConfig

    type SftpDirOptions = {
        filter?: (path: string, isDirectory: boolean) => boolean
    }

    type SftpDownloadDirOptions = {
        useFastget?: boolean
    } & SftpDirOptions

    type SftpFileEntry = FileEntry

    type SftpFileEntryWithStats = SftpFileEntry & SftpStats

    type SftpReadStream = ReadStream

    type SftpReadStreamOptions = ReadStreamOptions

    type SftpStats = {
        accessTime: number
        gid: number
        isBlockDevice: boolean
        isCharacterDevice: boolean
        isDirectory: boolean
        isFIFO: boolean
        isFile: boolean
        isSocket: boolean
        isSymbolicLink: boolean
        mode: number
        modifyTime: number
        size: number
        uid: number
    }

    type SftpStreamOptions = {
        pipeOptions?: { end?: boolean }
        readStreamOptions?: SftpReadStreamOptions
        writeStreamOptions?: SftpWriteStreamOptions
    }

    type SftpTransferOptions = TransferOptions

    type SftpUploadDirOptions = {
        useFastput?: boolean
    } & SftpDirOptions

    type SftpWrapper = SFTPWrapper

    type SftpWriteStream = WriteStream

    type SftpWriteStreamOptions = WriteStreamOptions

    class SftpClient {
        client: Client
        /**
         * Create a new SFTP client.
         *
         * @param clientName name used to identify this client in log messages (optional)
         * @param callbacks handlers for the connection's close, end and error events (optional)
         */
        constructor(clientName?: string, callbacks?: SftpClientCallbacks)
        /**
         * Append data to an existing remote file.
         *
         * @param input data to append, as a Buffer or readable stream
         * @param remotePath path to the remote file
         * @param options write stream options (optional)
         *
         * @returns a success message
         */
        append(
            input: Buffer | NodeJS.ReadableStream,
            remotePath: string,
            options?: SftpWriteStreamOptions,
        ): Promise<string>
        /**
         * Change the access mode of a remote file.
         *
         * @param remotePath path to the remote file
         * @param mode new mode, as an octal number or string
         * @param addListeners add event listeners (optional, default true)
         *
         * @returns a success message
         */
        chmod(remotePath: string, mode: number | string, addListeners?: boolean): Promise<string>
        /**
         * Open a new connection to a remote SFTP server. Uses the same options as the
         * underlying SSH2 module.
         *
         * @param config connection options
         *
         * @returns the connected sftp client
         */
        connect(config: SftpConnectConfig): Promise<SftpWrapper>
        /**
         * Open a read stream for a remote file. You are responsible for handling and
         * closing the returned stream yourself.
         *
         * @param remotePath path to the remote file
         * @param options read stream options (optional)
         *
         * @returns a read stream for the file
         */
        createReadStream(remotePath: string, options?: SftpReadStreamOptions): SftpReadStream
        /**
         * Open a write stream for a remote file. You are responsible for handling and
         * closing the returned stream yourself.
         *
         * @param remotePath path to the remote file
         * @param options write stream options (optional)
         *
         * @returns a write stream for the file
         */
        createWriteStream(remotePath: string, options?: SftpWriteStreamOptions): SftpWriteStream
        /**
         * Get the current remote working directory.
         *
         * @returns the current remote working directory
         */
        cwd(): Promise<string>
        /**
         * Delete a remote file.
         *
         * @param remotePath path to the file to delete
         * @param notFoundOK ignore the error if the file does not exist (optional, default false)
         * @param addListeners add event listeners (optional, default true)
         *
         * @returns a success message
         */
        delete(remotePath: string, notFoundOK?: boolean, addListeners?: boolean): Promise<string>
        /**
         * Download a remote directory, including all of its files and sub-directories,
         * to a local directory.
         *
         * @param srcDir remote source directory
         * @param dstDir local destination directory
         * @param options filter(path, isDirectory) selects which items to download,
         * useFastget enables faster parallel downloads (optional)
         *
         * @returns a success message
         */
        downloadDir(srcDir: string, dstDir: string, options?: SftpDownloadDirOptions): Promise<string>
        /**
         * Close the SFTP connection.
         *
         * @returns true once the connection is closed
         */
        end(): Promise<boolean>
        /**
         * Check whether a remote path exists.
         *
         * @param remotePath path to check
         *
         * @returns the item type ('-' file, 'd' directory, 'l' symlink), or false if it does not exist
         */
        exists(remotePath: string): Promise<'-' | 'd' | 'l' | false>
        /**
         * Download a remote file using parallel reads for higher throughput. Support
         * depends on the remote server, so not all servers handle this well.
         *
         * @param remotePath path to the remote file
         * @param localPath local path to save the file to
         * @param options transfer options (optional)
         *
         * @returns a success message
         */
        fastGet(remotePath: string, localPath: string, options?: SftpTransferOptions): Promise<string>
        /**
         * Upload a local file using parallel writes for higher throughput. Support
         * depends on the remote server, so not all servers handle this well.
         *
         * @param localPath path to the local file
         * @param remotePath destination path on the remote server
         * @param options transfer options (optional)
         *
         * @returns a success message
         */
        fastPut(localPath: string, remotePath: string, options?: SftpTransferOptions): Promise<string>
        /**
         * Download a remote file. The destination decides how the data is returned:
         * a string saves it to that local path, a writable stream receives the data,
         * and omitting it returns the data as a Buffer.
         *
         * @param remotePath path to the remote file
         * @param dst local path or writable stream to receive the data (optional)
         * @param options read stream, write stream and pipe options (optional)
         * @param addListeners add event listeners (optional, default true)
         *
         * @returns the destination path, the stream, or a Buffer with the file data
         */
        get(
            remotePath: string,
            dst?: NodeJS.WritableStream | string,
            options?: SftpStreamOptions,
            addListeners?: boolean,
        ): Promise<Buffer | NodeJS.WritableStream | string>
        /**
         * List the contents of a remote directory. Each entry includes its type, name,
         * size, timestamps, access rights, owner and group.
         *
         * @param remotePath path to the remote directory
         * @param filter function used to keep only the entries you want (optional)
         * @param addListeners add event listeners (optional, default true)
         *
         * @returns the directory entries
         */
        list(
            remotePath: string,
            filter?: (item: SftpFileEntryWithStats) => boolean,
            addListeners?: boolean,
        ): Promise<SftpFileEntryWithStats[]>
        /**
         * Get the attributes of a remote path. For a symbolic link, returns the
         * attributes of the link itself rather than its target (unlike stat).
         *
         * @param remotePath path to the remote item
         *
         * @returns the item attributes
         */
        lstat(remotePath: string): Promise<SftpStats>
        /**
         * Create a directory on the remote server.
         *
         * @param remotePath path of the directory to create
         * @param recursive also create any missing parent directories (optional, default false)
         *
         * @returns a success message
         */
        mkdir(remotePath: string, recursive?: boolean): Promise<string>
        /**
         * Add an event listener to the underlying client. Rarely needed: you must
         * remove the listener yourself when done, otherwise it can leak memory.
         *
         * @param eventType event to listen for
         * @param callback function called when the event fires
         */
        on(eventType: string, callback: (...args: unknown[]) => void): void
        /**
         * Rename a remote file using the OpenSSH atomic rename extension
         * (posix-rename@openssh.com, available from SSH 4.8).
         *
         * @param fromPath current path of the file
         * @param toPath new path of the file
         * @param addListeners add event listeners (optional, default true)
         *
         * @returns a success message
         */
        posixRename(fromPath: string, toPath: string, addListeners?: boolean): Promise<string>
        /**
         * Create a remote file from local data. The source can be a Buffer, a readable
         * stream, or a string path to a local file.
         *
         * @param localSrc source data to upload
         * @param remotePath destination path on the remote server
         * @param options read stream, write stream and pipe options (optional)
         *
         * @returns a success message
         */
        put(
            localSrc: Buffer | NodeJS.ReadableStream | string,
            remotePath: string,
            options?: SftpStreamOptions,
        ): Promise<string>
        /**
         * Copy a remote file to another remote path. The target directory must already
         * exist and the destination file must not.
         *
         * @param srcPath path to the remote file to copy
         * @param dstPath destination path for the copy
         *
         * @returns a success message
         */
        rcopy(srcPath: string, dstPath: string): Promise<string>
        /**
         * Resolve a remote path to its absolute form. Handles '.' and '..' but not '~';
         * relative paths are resolved against the current working directory.
         *
         * @param remotePath remote path, may be relative
         * @param addListeners add event listeners (optional, default true)
         *
         * @returns the absolute path, or '' if it does not exist
         */
        realPath(remotePath: string, addListeners?: boolean): Promise<string>
        /**
         * Remove a previously added event listener from the underlying client.
         *
         * @param eventType event the listener was added for
         * @param callback listener function to remove
         */
        removeListener(eventType: string, callback: (...args: unknown[]) => void): void
        /**
         * Rename a remote file.
         *
         * @param fromPath current path of the file
         * @param toPath new path of the file
         * @param addListeners add event listeners (optional, default true)
         *
         * @returns a success message
         */
        rename(fromPath: string, toPath: string, addListeners?: boolean): Promise<string>
        /**
         * Remove a directory on the remote server.
         *
         * @param remotePath path of the directory to remove
         * @param recursive also remove the directory's contents (optional, default false)
         *
         * @returns a success message
         */
        rmdir(remotePath: string, recursive?: boolean): Promise<string>
        /**
         * Get the attributes of a remote path. For a symbolic link, returns the
         * attributes of the link's target rather than the link itself (unlike lstat).
         *
         * @param remotePath path to the remote item
         *
         * @returns the item attributes
         */
        stat(remotePath: string): Promise<SftpStats>
        /**
         * Upload a local directory, including all of its files and sub-directories, to
         * a remote directory.
         *
         * @param srcDir local source directory
         * @param dstDir remote destination directory
         * @param options filter(path, isDirectory) selects which items to upload,
         * useFastput enables faster parallel uploads (optional)
         *
         * @returns a success message
         */
        uploadDir(srcDir: string, dstDir: string, options?: SftpUploadDirOptions): Promise<string>
    }

    export default SftpClient
}
