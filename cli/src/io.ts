import readline from 'node:readline/promises'

/** Terminal access, injectable so commands can be tested without a TTY. */
export interface Io {
  out(text: string): void
  err(text: string): void
  /** True when the user can answer prompts. */
  interactive: boolean
  /** Ask one question; resolves to the trimmed answer. */
  ask(question: string): Promise<string>
  color: boolean
  cwd: string
  env: Record<string, string | undefined>
  nodeVersion: string
}

/** Colour only decorates; every message must make sense without it (DT.7). */
export function paint(io: Pick<Io, 'color'>, code: 'bold' | 'dim' | 'red' | 'yellow' | 'green', text: string): string {
  if (!io.color) return text
  const codes = { bold: [1, 22], dim: [2, 22], red: [31, 39], yellow: [33, 39], green: [32, 39] }[code]
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
    color,
    cwd: process.cwd(),
    env,
    nodeVersion: process.versions.node,
  }
}
