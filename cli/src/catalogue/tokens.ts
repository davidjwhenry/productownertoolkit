import type { RootValues } from './types.ts'

/** Top-level folders that belong to the user-owned content root. */
export const CONTENT_DIRECTORIES = [
  'context',
  'requirements',
  'backlog',
  'testing',
  'examples',
  'design-system',
  'personal',
] as const

/** Top-level folders that belong to the toolkit-managed guidance root. */
export const TOOLKIT_DIRECTORIES = ['mcp-config', 'conventions'] as const

export const STANDALONE_ROOTS: RootValues = { content: '.', toolkit: '.' }

const TOKEN = /\{(content|toolkit)\}\//g
const EMPTY_TOKEN = /\{(content|toolkit)\}\/(?![\w.<[{-])/g

function prefix(value: string): string {
  const trimmed = value.replace(/\/+$/, '')
  return trimmed === '.' || trimmed === '' ? '' : `${trimmed}/`
}

/** Replace `{content}/` and `{toolkit}/` with concrete directory prefixes. */
export function renderTokens(text: string, roots: RootValues): string {
  return text.replace(TOKEN, (_match, name: 'content' | 'toolkit') => prefix(roots[name]))
}

function untokenisedPattern(directories: readonly string[]): RegExp {
  return new RegExp(`(?<![\\w./@{}-])(${directories.join('|')})/`, 'g')
}

export interface TokenFinding {
  line: number
  message: string
}

/**
 * Report root-level toolkit paths that are not tokenised, and tokens that do not
 * introduce a path segment (which would render as an empty string in a standalone clone).
 */
export function lintTokens(text: string): TokenFinding[] {
  const findings: TokenFinding[] = []
  const checks: Array<[RegExp, (m: RegExpExecArray) => string]> = [
    [untokenisedPattern(CONTENT_DIRECTORIES), (m) => `\`${m[1]}/\` should be written as \`{content}/${m[1]}/\``],
    [untokenisedPattern(TOOLKIT_DIRECTORIES), (m) => `\`${m[1]}/\` should be written as \`{toolkit}/${m[1]}/\``],
    [EMPTY_TOKEN, (m) => `\`{${m[1]}}/\` must be followed by a path segment`],
  ]
  text.split('\n').forEach((lineText, index) => {
    for (const [pattern, message] of checks) {
      pattern.lastIndex = 0
      for (let m = pattern.exec(lineText); m; m = pattern.exec(lineText)) {
        findings.push({ line: index + 1, message: message(m) })
      }
    }
  })
  return findings
}
