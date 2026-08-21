import type { SftpClient } from '@mimic-behavior/ssh2-sftp-client'

import { CancelledError } from '~/shared'

// eslint-disable-next-line no-control-regex -- ANSI sequences start with the ESC control character
const ANSI_ESCAPE = /\u001B\[[0-9;]*[A-Za-z]/g
const IDLE_TIMEOUT = 120_000
const MAX_PASSWORD_ATTEMPTS = 3
const OUTPUT_LIMIT = 32_768
const PASSWORD_PROMPT = /(?:password|passphrase)(?: for [^:]*)?:$/i
const PENDING_LIMIT = 512

type RunRemoteCommandOptions = {
    client: SftpClient
    command: string
    getPassword?: () => Promise<string>
    idleTimeoutMs?: number
    onOutput?: (chunk: string) => void
    signal: AbortSignal
    subject: string
}

type RunRemoteCommandResult = {
    code?: number
    signal?: string
    stderr: string
    stdout: string
}

function appendLimited(current: string, chunk: string, limit: number) {
    const next = current + chunk

    return next.length > limit ? next.slice(next.length - limit) : next
}

function dropEchoedInput(text: string) {
    const index = text.indexOf('\n')

    return index === -1 ? undefined : text.slice(index + 1)
}

function formatFailure(command: string, result: RunRemoteCommandResult) {
    const output = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join('\n')
    const details = output ? `\n${output}` : ''

    return new Error(`Remote command failed${formatStatus(result)}: ${command}${details}`)
}

function formatStatus({ code, signal }: RunRemoteCommandResult) {
    if (code !== undefined) {
        return ` with code ${code}`
    }

    if (signal !== undefined) {
        return ` with signal ${signal}`
    }

    return ''
}

function getPromptLine(pending: string) {
    return (
        stripAnsi(pending)
            .split(/\r?\n/)
            .map((line) => line.trimEnd())
            .findLast((line) => line.length > 0) ?? ''
    )
}

function runRemoteCommand({
    client,
    command,
    getPassword,
    idleTimeoutMs = IDLE_TIMEOUT,
    onOutput,
    signal,
    subject,
}: RunRemoteCommandOptions): Promise<RunRemoteCommandResult> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new CancelledError(subject))
            return
        }

        // a pty is only needed to answer prompts; without one the server keeps stderr separate
        const options = { env: { LC_ALL: 'C' }, pty: getPassword !== undefined }

        client.ssh2.exec(command, options, (error, channel) => {
            if (error) {
                reject(error)
                return
            }

            let awaitingPassword = false
            let echoPending = false
            let passwordAttempts = 0
            let pending = ''
            let settled = false
            let stderr = ''
            let stdout = ''

            const timeoutId = setTimeout(() => {
                fail(new Error(`Remote command produced no output for ${idleTimeoutMs}ms: ${command}`))
            }, idleTimeoutMs)

            const settle = () => {
                settled = true
                signal.removeEventListener('abort', onAbort)
                clearTimeout(timeoutId)
            }

            const fail = (reason: unknown) => {
                if (settled) {
                    return
                }

                settle()

                if (!channel.destroyed) {
                    channel.destroy()
                }

                reject(reason)
            }

            const succeed = (result: RunRemoteCommandResult) => {
                if (settled) {
                    return
                }

                settle()
                resolve(result)
            }

            const onAbort = () => fail(new CancelledError(subject))

            signal.addEventListener('abort', onAbort, { once: true })

            if (signal.aborted) {
                onAbort()
                return
            }

            const answerPrompt = async (requestPassword: () => Promise<string>) => {
                awaitingPassword = true
                passwordAttempts += 1
                pending = ''

                try {
                    const password = await requestPassword()

                    if (settled || channel.destroyed || !channel.writable) {
                        return
                    }

                    echoPending = true
                    channel.write(`${password}\n`)
                } finally {
                    awaitingPassword = false
                }
            }

            const takeVisible = (text: string) => {
                if (!echoPending) {
                    return text
                }

                const rest = dropEchoedInput(text)

                echoPending = rest === undefined

                return rest ?? ''
            }

            const handleChunk = async (text: string, stream: 'stderr' | 'stdout') => {
                if (settled) {
                    return
                }

                timeoutId.refresh()

                const visible = takeVisible(text)

                if (stream === 'stdout') {
                    stdout = appendLimited(stdout, visible, OUTPUT_LIMIT)
                } else {
                    stderr = appendLimited(stderr, visible, OUTPUT_LIMIT)
                }

                pending = appendLimited(pending, visible, PENDING_LIMIT)

                if (visible !== '') {
                    onOutput?.(visible)
                }

                if (getPassword === undefined || awaitingPassword) {
                    return
                }

                if (!PASSWORD_PROMPT.test(getPromptLine(pending))) {
                    return
                }

                if (passwordAttempts >= MAX_PASSWORD_ATTEMPTS) {
                    fail(new Error(`Password prompt limit exceeded for: ${command}`))
                    return
                }

                await answerPrompt(getPassword)
            }

            channel.setEncoding('utf8')
            channel.stderr.setEncoding('utf8')

            channel.on('data', (text: string) => {
                handleChunk(text, 'stdout').catch(fail)
            })
            channel.stderr.on('data', (text: string) => {
                handleChunk(text, 'stderr').catch(fail)
            })
            channel.once('close', (code: null | number | undefined, exitSignal?: string) => {
                const result: RunRemoteCommandResult = {
                    code: code ?? undefined,
                    signal: exitSignal,
                    stderr,
                    stdout,
                }

                if (code === 0) {
                    succeed(result)
                    return
                }

                fail(formatFailure(command, result))
            })
            channel.once('error', fail)
        })
    })
}

function stripAnsi(value: string) {
    return value.replace(ANSI_ESCAPE, '')
}

export { runRemoteCommand }
export type { RunRemoteCommandOptions, RunRemoteCommandResult }
