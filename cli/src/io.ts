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
  /** Whether the terminal renders 24-bit colour. */
  truecolor: boolean
  /** Terminal width in columns. */
  columns: number
  cwd: string
  env: Record<string, string | undefined>
  nodeVersion: string
}

/** The brand colour, #F73B20, or its nearest 256-colour match where 24-bit colour is unavailable. */
export function accentCode(truecolor: boolean): string {
  return truecolor ? '38;2;247;59;32' : '38;5;202'
}

/** Colour only decorates; every message must make sense without it (DT.7). */
export function paint(io: Pick<Io, 'color'> & { truecolor?: boolean }, code: 'bold' | 'dim' | 'red' | 'yellow' | 'green' | 'accent', text: string): string {
  if (!io.color) return text
  if (code === 'accent') return `\u001b[${accentCode(io.truecolor === true)}m${text}\u001b[39m`
  const codes = { bold: [1, 22], dim: [2, 22], red: [31, 39], yellow: [33, 39], green: [32, 39] }[code]
  return `\u001b[${codes[0]}m${text}\u001b[${codes[1]}m`
}

export function processIo(): Io {
  const env = process.env
  const color = process.stdout.isTTY === true && env.NO_COLOR === undefined && env.TERM !== 'dumb'
  const truecolor = color && /truecolor|24bit/i.test(env.COLORTERM ?? '')
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
    select: (message, choices, options) => selectPrompt(process.stdin, process.stdout, message, choices, { ...options, color, truecolor }),
    exec: (command, args, cwd) =>
      new Promise((resolve) => {
        const child = spawn(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
        child.on('error', () => resolve(1))
        child.on('close', (code) => resolve(code ?? 1))
      }),
    color,
    truecolor,
    columns: process.stdout.columns || 80,
    cwd: process.cwd(),
    env,
    nodeVersion: process.versions.node,
  }
}
