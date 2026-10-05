import { skillDirectoriesFor } from './agents.ts'
import { renderTokens } from './tokens.ts'
import type { Catalogue, RootValues } from './types.ts'

export const BLOCK_BEGIN = '<!-- productownertoolkit:begin -->'
export const BLOCK_END = '<!-- productownertoolkit:end -->'

export interface AgentsBlockOptions {
  capabilities: string[]
  agents: string[]
  roots: RootValues
  /** Set for installed repositories; omitted for the standalone toolkit clone. */
  manifestPath?: string
  /** Level of the block's own heading (default 3, as in the template). */
  headingLevel?: number
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('')
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

/** Render the managed block, including its delimiters, from the block template. */
export function renderAgentsBlock(template: string, catalogue: Catalogue, options: AgentsBlockOptions): string {
  const capabilities = catalogue.capabilities.filter((c) => c.required || options.capabilities.includes(c.id))

  const map = capabilities
    .flatMap((c) => c.map)
    .map((row) => `| \`${row.path}\` | ${row.purpose} |`)
    .join('\n')
  const skills = capabilities.flatMap((c) => c.skills).map((s) => `\`${s}\``)
  const directories = skillDirectoriesFor(catalogue, options.agents).map((dir) => `\`${dir}/\``)
  const installation = options.manifestPath
    ? `This repository uses the Product Owner Toolkit, recorded in \`${options.manifestPath}\`. Product work lives in \`{content}/\`.\n\n`
    : ''

  const heading = '#'.repeat(Math.min(Math.max(options.headingLevel ?? 3, 1), 6))
  const body = template
    .replace(/^#{1,6} /, `${heading} `)
    .replace('{{installation}}', installation)
    .replace('{{map}}', map)
    .replace('{{skills}}', `${list(skills)} (in ${list(directories)})`)
  // `{content}/` on its own names the content root itself.
  const rendered = renderTokens(body.replace(/`\{content\}\/`/g, `\`${options.roots.content}/\``), options.roots)
  return `${BLOCK_BEGIN}\n${rendered.trimEnd()}\n${BLOCK_END}`
}

export class ManagedBlockError extends Error {}

/** Replace the contents of the single managed block in `document`. */
export function replaceManagedBlock(document: string, block: string): string {
  const begins = document.split(BLOCK_BEGIN).length - 1
  const ends = document.split(BLOCK_END).length - 1
  if (begins === 0 && ends === 0) throw new ManagedBlockError('no managed Product Owner Toolkit block found')
  if (begins !== 1 || ends !== 1) {
    throw new ManagedBlockError(`expected one managed block, found ${begins} begin and ${ends} end markers`)
  }
  const start = document.indexOf(BLOCK_BEGIN)
  const end = document.indexOf(BLOCK_END)
  if (end < start) throw new ManagedBlockError('managed block end marker appears before its begin marker')
  return document.slice(0, start) + block + document.slice(end + BLOCK_END.length)
}
