import { parseArgs } from 'node:util'

export const COMMANDS = ['init', 'doctor'] as const
export type Command = (typeof COMMANDS)[number]

export interface CliOptions {
  command?: Command
  target?: string
  agents?: string[]
  capabilities?: string[]
  contentRoot?: string
  yes: boolean
  dryRun: boolean
  noInstall: boolean
  json: boolean
  help: boolean
  version: boolean
}

export class UsageError extends Error {}

export const USAGE = `Usage: npx productownertoolkit@latest <command> [options]

Commands:
  init      Install the toolkit into a repository or folder, or add agents and capabilities
  doctor    Report installation health without changing anything

Options:
  --target <dir>             Directory to act on (default: the current directory)
  --agents <ids>             Comma-separated agents: claude-code, cursor, codex
  --capabilities <ids>       Comma-separated optional capabilities: prototyping, notion, authoring, examples
  --content-root <dir>       Folder for your product work (default: product)
  --dry-run                  Show the plan without writing anything
  --yes                      Apply the plan without asking for confirmation
  --no-install               Do not install the prototype playground dependencies
  --json                     doctor only: print a machine-readable result
  --help                     Show this help
  --version                  Show the toolkit version
`

function list(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined
  return value.split(',').map((item) => item.trim()).filter((item) => item !== '')
}

export function parseCli(argv: string[]): CliOptions {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        target: { type: 'string' },
        agents: { type: 'string' },
        capabilities: { type: 'string' },
        'content-root': { type: 'string' },
        yes: { type: 'boolean', short: 'y', default: false },
        'dry-run': { type: 'boolean', default: false },
        'no-install': { type: 'boolean', default: false },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    })
  } catch (error) {
    throw new UsageError((error as Error).message)
  }
  const { values, positionals } = parsed
  if (positionals.length > 1) throw new UsageError(`Unexpected argument: ${positionals[1]}`)
  const name = positionals[0]
  if (name !== undefined && !(COMMANDS as readonly string[]).includes(name)) {
    throw new UsageError(name === 'update' ? 'The update command is not available in this version yet.' : `Unknown command: ${name}`)
  }
  const command = name as Command | undefined
  if (values.json && command !== 'doctor') throw new UsageError('--json is only supported by doctor')
  if (command === 'doctor') {
    for (const flag of ['agents', 'capabilities', 'content-root'] as const) {
      if (values[flag] !== undefined) throw new UsageError(`--${flag} is only supported by init`)
    }
    if (values.yes || values['dry-run'] || values['no-install']) throw new UsageError('doctor never writes, so --yes, --dry-run and --no-install do not apply')
  }
  return {
    command,
    target: values.target,
    agents: list(values.agents),
    capabilities: list(values.capabilities),
    contentRoot: values['content-root'],
    yes: values.yes,
    dryRun: values['dry-run'],
    noInstall: values['no-install'],
    json: values.json,
    help: values.help,
    version: values.version,
  }
}
