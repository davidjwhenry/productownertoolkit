import { spawn } from 'node:child_process'
import readline from 'node:readline/promises'
import { selectPrompt, type Choice, type SelectOptions } from './select.ts'

export type { Choice }

/** Terminal access, injectable so commands can be tested without a TTY. */
export interface Io {
  out(text: string): void
  err(text: string): void
  /** True when the user can answer prompts. */
  interactive: boolean
  /** Ask one question; resolves to the trimmed answer. */
  ask(question: string): Promise<string>
  /** Pick from a list with the arrow keys and space bar; resolves to the chosen ids. */
  select(message: string, choices: Choice[], options: SelectOptions): Promise<string[]>
  /** Run a command with its output shown; resolves to the exit code. */
  exec(command: string, args: string[], cwd: string): Promise<number>
  color: boolean
  /** Terminal width in columns. */
  columns: number
  cwd: string
  env: Record<string, string | undefined>
  nodeVersion: string
}

/** Colour only decorates; every message must make sense without it (DT.7). */
export function paint(io: Pick<Io, 'color'>, code: 'bold' | 'dim' | 'red' | 'yellow' | 'green' | 'cyan', text: string): string {
  if (!io.color) return text
  const codes = { bold: [1, 22], dim: [2, 22], red: [31, 39], yellow: [33, 39], green: [32, 39], cyan: [36, 39] }[code]
  return `\u001b[${codes[0]}m${text}\u001b[${codes[1]}m`
}

export function processIo(): Io {
  const env = process.env
  const color = process.stdout.isTTY === true && env.NO_COLOR === undefined && env.TERM !== 'dumb'
  return {
    out: (text) => process.stdout.write(`${text}\n`),
    err: (text) => process.stderr.write(`${text}\n`),
    interactive: process.stdin.isTTY === true && process.stdout.isTTY === true,
    async ask(question) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      try {
        return (await rl.question(question)).trim()
      } finally {
        rl.close()
      }
    },
    select: (message, choices, options) => selectPrompt(process.stdin, process.stdout, message, choices, { ...options, color }),
    exec: (command, args, cwd) =>
      new Promise((resolve) => {
        const child = spawn(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
        child.on('error', () => resolve(1))
        child.on('close', (code) => resolve(code ?? 1))
      }),
    color,
    columns: process.stdout.columns || 80,
    cwd: process.cwd(),
    env,
    nodeVersion: process.versions.node,
  }
}
