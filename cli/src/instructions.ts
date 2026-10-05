/**
 * Repository instruction files (ON.1–ON.5, ON.9–ON.10). The toolkit owns one
 * delimited block in root `AGENTS.md` and, optionally, one `@AGENTS.md`
 * import line in an existing `CLAUDE.md`. Nothing outside those is changed,
 * and ambiguous states stop the operation instead of being guessed at.
 */
import { BLOCK_BEGIN, BLOCK_END } from './catalogue/agents-block.ts'

export const AGENTS_PATH = 'AGENTS.md'
export const AGENTS_OVERRIDE_PATH = 'AGENTS.override.md'
export const CLAUDE_PATHS = ['CLAUDE.md', '.claude/CLAUDE.md'] as const
export const CLAUDE_LOCAL_PATH = 'CLAUDE.local.md'

const MAP_HEADING = /^(repository map|repo structure|folder structure)$/i

export type BlockLocation =
  | { kind: 'absent' }
  | { kind: 'valid'; start: number; end: number; text: string; headingLevel: number }
  | { kind: 'malformed'; message: string }

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

/** Find the single managed block. Duplicate, unpaired, or reversed markers are malformed. */
export function findManagedBlock(document: string): BlockLocation {
  const begins = count(document, BLOCK_BEGIN)
  const ends = count(document, BLOCK_END)
  if (begins === 0 && ends === 0) return { kind: 'absent' }
  if (begins !== 1 || ends !== 1) {
    return { kind: 'malformed', message: `expected one managed block, found ${begins} begin and ${ends} end markers` }
  }
  const start = document.indexOf(BLOCK_BEGIN)
  const endMarker = document.indexOf(BLOCK_END)
  if (endMarker < start) return { kind: 'malformed', message: 'the end marker appears before the begin marker' }
  const end = endMarker + BLOCK_END.length
  const text = document.slice(start, end)
  const heading = /^(#{1,6}) /m.exec(text)
  return { kind: 'valid', start, end, text: text.replace(/\r\n/g, '\n'), headingLevel: heading ? heading[1]!.length : 3 }
}

interface Heading {
  line: number
  level: number
  title: string
}

/** ATX headings outside fenced code blocks. */
function headings(lines: string[]): Heading[] {
  const out: Heading[] = []
  let fence: string | null = null
  lines.forEach((line, index) => {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (marker) {
      if (fence === null) fence = marker[1]![0]!
      else if (marker[1]![0] === fence) fence = null
      return
    }
    if (fence !== null) return
    const match = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (match) out.push({ line: index, level: match[1]!.length, title: match[2]! })
  })
  return out
}

function eolOf(document: string): string {
  return document.includes('\r\n') ? '\r\n' : '\n'
}

export type AgentsPlan =
  | { kind: 'create'; after: string; description: string }
  | { kind: 'insert' | 'replace' | 'unchanged'; before: string; after: string; description: string }
  | { kind: 'conflict'; message: string }

/**
 * Plan the `AGENTS.md` change. `render(level)` returns the block, delimiters
 * included, with its heading at `level`.
 */
export function planAgentsMd(document: string | undefined, render: (headingLevel: number) => string): AgentsPlan {
  if (document === undefined) {
    return { kind: 'create', after: `# Agent Instructions\n\n${render(2)}\n`, description: `create ${AGENTS_PATH} with the Product Owner Toolkit section` }
  }
  const eol = eolOf(document)
  const withEol = (text: string) => text.replace(/\n/g, eol)
  const location = findManagedBlock(document)
  if (location.kind === 'malformed') {
    return { kind: 'conflict', message: `${AGENTS_PATH} has a malformed Product Owner Toolkit block: ${location.message}. Fix or remove the ${BLOCK_BEGIN} and ${BLOCK_END} markers, then run again.` }
  }
  if (location.kind === 'valid') {
    const after = document.slice(0, location.start) + withEol(render(location.headingLevel)) + document.slice(location.end)
    return after === document
      ? { kind: 'unchanged', before: document, after, description: `${AGENTS_PATH} block is already up to date` }
      : { kind: 'replace', before: document, after, description: `replace the Product Owner Toolkit block in ${AGENTS_PATH}` }
  }

  const lines = document.split(/\r?\n/)
  const all = headings(lines)
  const map = all.find((h) => MAP_HEADING.test(h.title))
  if (map) {
    const next = all.find((h) => h.line > map.line && h.level <= map.level)
    let insertAt = next ? next.line : lines.length
    while (insertAt > map.line + 1 && lines[insertAt - 1]!.trim() === '') insertAt--
    const block = render(Math.min(map.level + 1, 6)).split('\n')
    const tail = lines.slice(insertAt)
    // Keep one blank line between the block and whatever follows, and end the file with a newline.
    const updated = [...lines.slice(0, insertAt), '', ...block, ...(tail[0] === '' ? [] : ['']), ...tail]
    return {
      kind: 'insert',
      before: document,
      after: updated.join(eol),
      description: `insert the Product Owner Toolkit block at the end of the "${'#'.repeat(map.level)} ${map.title}" section (line ${map.line + 1}) of ${AGENTS_PATH}`,
    }
  }
  const body = document.replace(/(\r?\n)*$/, '')
  return {
    kind: 'insert',
    before: document,
    after: `${body}${eol}${eol}${withEol(render(2))}${eol}`,
    description: `append a Product Owner Toolkit section to the end of ${AGENTS_PATH}`,
  }
}

/** The import line that loads root `AGENTS.md` from a `CLAUDE.md` at `claudePath`. */
export function agentsImportFor(claudePath: string): string {
  return claudePath.includes('/') ? '@../AGENTS.md' : '@AGENTS.md'
}

/** Whether `text` imports root `AGENTS.md` (outside code fences) from a file at `claudePath`. */
export function hasAgentsImport(text: string, claudePath: string): boolean {
  const accepted = claudePath.includes('/') ? ['@../AGENTS.md'] : ['@AGENTS.md', '@./AGENTS.md']
  let fence = false
  for (const line of text.split(/\r?\n/)) {
    if (/^ {0,3}(`{3,}|~{3,})/.test(line)) {
      fence = !fence
      continue
    }
    if (fence) continue
    if (line.split(/\s+/).some((token) => accepted.includes(token))) return true
  }
  return false
}

export function addAgentsImport(text: string, claudePath: string): string {
  return `${agentsImportFor(claudePath)}${eolOf(text)}${text}`
}

export type ClaudePlan =
  | { kind: 'none'; reason: string }
  | { kind: 'import'; path: string; before: string; after: string; description: string }
  | { kind: 'conflict'; message: string }

/** Plan the `CLAUDE.md` import (ON.9 and the instruction target matrix). */
export function planClaudeImport(read: (path: string) => string | undefined, claudeSelected: boolean): ClaudePlan {
  if (!claudeSelected) return { kind: 'none', reason: 'Claude Code is not selected' }
  const present = CLAUDE_PATHS.map((path) => ({ path, text: read(path) })).filter((f): f is { path: (typeof CLAUDE_PATHS)[number]; text: string } => f.text !== undefined)
  if (present.length === 0) return { kind: 'none', reason: `no ${CLAUDE_PATHS.join(' or ')}; Claude Code reads ${AGENTS_PATH} directly` }
  if (present.length > 1) {
    return {
      kind: 'conflict',
      message: `Both ${CLAUDE_PATHS.join(' and ')} exist, so it is unclear which should import ${AGENTS_PATH}. Add \`@AGENTS.md\` to CLAUDE.md or \`@../AGENTS.md\` to .claude/CLAUDE.md yourself, then run again.`,
    }
  }
  const [file] = present
  if (hasAgentsImport(file!.text, file!.path)) return { kind: 'none', reason: `${file!.path} already imports ${AGENTS_PATH}` }
  return {
    kind: 'import',
    path: file!.path,
    before: file!.text,
    after: addAgentsImport(file!.text, file!.path),
    description: `add \`${agentsImportFor(file!.path)}\` as the first line of ${file!.path} so Claude Code reads the toolkit map`,
  }
}
