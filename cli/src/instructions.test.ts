import { describe, expect, it } from 'vitest'
import { BLOCK_BEGIN, BLOCK_END } from './catalogue/agents-block.ts'
import { findManagedBlock, hasAgentsImport, planAgentsMd, planClaudeImport } from './instructions.ts'

const render = (level: number) => `${BLOCK_BEGIN}\n${'#'.repeat(level)} Product Owner Toolkit\n\nBody\n${BLOCK_END}`

describe('planAgentsMd', () => {
  it('creates AGENTS.md when absent', () => {
    const plan = planAgentsMd(undefined, render)
    expect(plan.kind).toBe('create')
    expect(plan.kind === 'create' && plan.after).toBe(`# Agent Instructions\n\n${render(2)}\n`)
  })

  it('inserts at the end of a recognised map section, one level deeper, leaving other content untouched', () => {
    const document = '# Repo\n\nIntro\n\n## Repository Map\n\n| a | b |\n| --- | --- |\n\n## Other\n\nText\n'
    const plan = planAgentsMd(document, render)
    expect(plan.kind).toBe('insert')
    if (plan.kind !== 'insert') return
    expect(plan.after).toBe(`# Repo\n\nIntro\n\n## Repository Map\n\n| a | b |\n| --- | --- |\n\n${render(3)}\n\n## Other\n\nText\n`)
    expect(plan.description).toContain('"## Repository Map" section (line 5)')
  })

  it.each(['Repo Structure', 'Folder Structure', 'repository map'])('recognises "%s"', (title) => {
    const plan = planAgentsMd(`# X\n\n### ${title}\n\ntree\n`, render)
    expect(plan.kind === 'insert' && plan.after).toBe(`# X\n\n### ${title}\n\ntree\n\n${render(4)}\n`)
  })

  it('ignores a map heading inside a code fence and appends a new section', () => {
    const document = '# X\n\n```md\n## Repository Map\n```\n'
    const plan = planAgentsMd(document, render)
    expect(plan.kind === 'insert' && plan.after).toBe(`${document.trimEnd()}\n\n${render(2)}\n`)
    expect(plan.kind === 'insert' && plan.description).toMatch(/append/)
  })

  it('replaces only the block contents and keeps its heading level', () => {
    const document = `Before\n\n${render(4).replace('Body', 'Old')}\n\nAfter\n`
    const plan = planAgentsMd(document, render)
    expect(plan.kind === 'replace' && plan.after).toBe(`Before\n\n${render(4)}\n\nAfter\n`)
    expect(planAgentsMd(`Before\n\n${render(4)}\n`, render).kind).toBe('unchanged')
  })

  it('keeps CRLF line endings', () => {
    const plan = planAgentsMd('# X\r\n\r\nText\r\n', render)
    expect(plan.kind === 'insert' && plan.after).toBe(`# X\r\n\r\nText\r\n\r\n${render(2).replace(/\n/g, '\r\n')}\r\n`)
  })

  it.each([
    ['duplicate', `${render(3)}\n${render(3)}`],
    ['unpaired', `${BLOCK_BEGIN}\ntext`],
    ['reversed', `${BLOCK_END}\n${BLOCK_BEGIN}`],
  ])('stops on a %s block', (_label, document) => {
    const plan = planAgentsMd(document, render)
    expect(plan.kind).toBe('conflict')
    expect(findManagedBlock(document).kind).toBe('malformed')
  })
})

describe('planClaudeImport', () => {
  const files = (entries: Record<string, string>) => (path: string) => entries[path]

  it('does nothing without Claude Code or without a CLAUDE.md', () => {
    expect(planClaudeImport(files({ 'CLAUDE.md': 'x' }), false).kind).toBe('none')
    expect(planClaudeImport(files({}), true).kind).toBe('none')
  })

  it('prepends the import to the root CLAUDE.md, preserving everything else', () => {
    const plan = planClaudeImport(files({ 'CLAUDE.md': '# Mine\r\nRules\r\n' }), true)
    expect(plan).toMatchObject({ kind: 'import', path: 'CLAUDE.md', after: '@AGENTS.md\r\n# Mine\r\nRules\r\n' })
  })

  it('uses a relative import from .claude/CLAUDE.md', () => {
    const plan = planClaudeImport(files({ '.claude/CLAUDE.md': 'Rules\n' }), true)
    expect(plan).toMatchObject({ kind: 'import', path: '.claude/CLAUDE.md', after: '@../AGENTS.md\nRules\n' })
  })

  it('recognises an existing import', () => {
    expect(planClaudeImport(files({ 'CLAUDE.md': 'See @AGENTS.md for more\n' }), true).kind).toBe('none')
    expect(hasAgentsImport('```\n@AGENTS.md\n```\n', 'CLAUDE.md')).toBe(false)
    expect(hasAgentsImport('@./AGENTS.md', 'CLAUDE.md')).toBe(true)
  })

  it('stops when both candidate files exist', () => {
    expect(planClaudeImport(files({ 'CLAUDE.md': 'a', '.claude/CLAUDE.md': 'b' }), true).kind).toBe('conflict')
  })
})
