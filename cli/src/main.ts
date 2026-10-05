import { parseCli, USAGE, UsageError } from './args.ts'
import { loadBundle, type Bundle } from './catalogue/bundle.ts'
import { runDoctor } from './commands/doctor.ts'
import { runInit } from './commands/init.ts'
import type { Io } from './io.ts'

export interface RunOptions {
  io: Io
  bundle?: Bundle
}

/** Run the CLI and return its exit code: 0 success, 1 stopped or unhealthy, 2 usage error. */
export async function run(argv: string[], { io, bundle }: RunOptions): Promise<number> {
  let options
  try {
    options = parseCli(argv)
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    io.err(error.message)
    io.err('Run with --help for usage.')
    return 2
  }
  if (options.version) {
    io.out((bundle ?? loadBundle()).version)
    return 0
  }
  if (options.help || !options.command) {
    io.out(USAGE)
    return options.help ? 0 : 2
  }
  const loaded = bundle ?? loadBundle()
  return options.command === 'init' ? runInit(options, io, loaded) : runDoctor(options, io, loaded)
}
