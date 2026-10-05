import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { applyPlan, ApplyError } from '../src/apply.ts'
import { BLOCK_BEGIN, BLOCK_END } from '../src/catalogue/agents-block.ts'
import { loadBundle } from '../src/catalogue/bundle.ts'
import { Target } from '../src/fsx.ts'
import { run } from '../src/main.ts'
import { MANIFEST_PATH, parseManifest, serialiseManifest, type InstallationManifest } from '../src/manifest.ts'
import { plan } from '../src/planner.ts'
import { cleanupTempDirs, scriptedIo, tempDir, type TempDir } from './helpers.ts'

afterEach(cleanupTempDirs)

const bundle = loadBundle()

async function init(dir: TempDir, args: string[], answers?: string[]) {
  const io = scriptedIo(dir.root, answers)
  const code = await run(['init', ...args], { io, bundle })
  return { code, io, output: io.output() }
}

function manifestOf(dir: TempDir): InstallationManifest {
  const read = parseManifest(dir.read(MANIFEST_PATH))
  if (read.kind !== 'valid') throw new Error(read.kind)
  return read.manifest
}

/** Run init expecting a stop; assert the target is byte-for-byte unchanged. */
async function expectStop(dir: TempDir, args: string[], message: RegExp) {
  const before = dir.files().map((f) => [f, dir.read(f)])
  const { code, output } = await init(dir, args)
  expect(code).toBe(1)
  expect(output).toMatch(message)
  expect(dir.files().map((f) => [f, dir.read(f)])).toEqual(before)
}

describe('init into an empty folder', () => {
  it('installs core for one agent with a manifest, AGENTS.md, and seeds', async () => {
    const dir = tempDir()
    const { code, output } = await init(dir, ['--agents', 'codex', '--yes'])
    expect(code).toBe(0)
    expect(output).toContain('Files are installed, but company configuration is still pending.')
    expect(output).toContain('Codex: Type `$bootstrap-context` in Codex')
    const manifest = manifestOf(dir)
    expect(manifest).toMatchObject({ agents: ['codex'], capabilities: ['core'], contentRoot: 'product', skillDirectories: ['.agents/skills'] })
    expect(manifest.playgroundRoot).toBeUndefined()
    expect(dir.exists('.agents/skills/prd-writer/SKILL.md')).toBe(true)
    expect(dir.exists('.claude/skills')).toBe(false)
    expect(dir.read('product/context/company-context.md').length).toBeGreaterThan(0)
    expect(dir.read('AGENTS.md')).toMatch(/^# Agent Instructions\n\n<!-- productownertoolkit:begin -->\n## Product Owner Toolkit/)
    // Seeds are user-owned: never checksummed. The manifest never lists itself.
    expect(Object.keys(manifest.managedFiles).some((p) => p.startsWith('product/context/'))).toBe(false)
    expect(manifest.managedFiles[MANIFEST_PATH]).toBeUndefined()
    // Installed skills contain concrete paths, never placeholders.
    expect(dir.read('.agents/skills/bootstrap-context/SKILL.md')).not.toMatch(/\{(content|toolkit)\}/)
  })

  it('writes to the fewest skill folders and notes Cursor duplicates', async () => {
    const dir = tempDir()
    const { output } = await init(dir, ['--agents', 'claude-code,cursor,codex', '--yes'])
    expect(manifestOf(dir).skillDirectories).toEqual(['.claude/skills', '.agents/skills'])
    expect(dir.exists('.cursor')).toBe(false)
    expect(output).toContain('Cursor reads both .claude/skills and .agents/skills')
  })

  it('honours a custom content root', async () => {
    const dir = tempDir()
    await init(dir, ['--agents', 'codex', '--content-root', 'docs/product/', '--yes'])
    expect(manifestOf(dir).contentRoot).toBe('docs/product')
    expect(dir.exists('docs/product/context/team-context.md')).toBe(true)
    expect(dir.read('.agents/skills/bootstrap-context/SKILL.md')).toContain('docs/product/context/')
  })

  it('writes nothing on a dry run', async () => {
    const dir = tempDir()
    const { code, output } = await init(dir, ['--agents', 'codex', '--capabilities', 'prototyping', '--dry-run'])
    expect(code).toBe(0)
    expect(output).toContain('Dry run: nothing was written.')
    expect(output).toContain('prototype-playground/src/workspace.ts')
    expect(dir.files()).toEqual([])
  })

  it('refuses to write without confirmation when it cannot prompt', async () => {
    const dir = tempDir()
    await expectStop(dir, ['--agents', 'codex'], /Rerun with --yes/)
  })

  it('stops when no agent is selected or detected', async () => {
    await expectStop(tempDir(), ['--yes'], /No agent was selected or detected/)
  })

  it.each([['../outside'], ['.claude/product'], ['prototype-playground/x'], ['/abs']])('rejects the content root %s', async (root) => {
    await expectStop(tempDir(), ['--agents', 'codex', '--content-root', root, '--yes'], /content root/i)
  })
})

describe('interactive init', () => {
  it('preselects detected agents, asks for capabilities and content root, and confirms', async () => {
    const dir = tempDir()
    dir.mkdir('.cursor')
    const { code, io } = await init(dir, [], ['', 'notion', '', 'y'])
    expect(code).toBe(0)
    expect(io.questions[0]).toContain('Install for which agents?')
    expect(manifestOf(dir)).toMatchObject({ agents: ['cursor'], capabilities: ['core', 'notion'], skillDirectories: ['.agents/skills'] })
  })

  it('shows the banner and numbered steps only when prompting', async () => {
    const prompted = await init(tempDir(), [], ['claude-code', '', '', 'y'])
    expect(prompted.output).toContain('▲  Product Owner Toolkit')
    expect(prompted.output).toMatch(/1\/4 Agents[\s\S]*2\/4 Capabilities[\s\S]*3\/4 Folder[\s\S]*4\/4 Review/)
    expect(prompted.output).toContain('What next')

    const scripted = await init(tempDir(), ['--yes', '--agents', 'claude-code'])
    expect(scripted.output).not.toContain('▲')
    expect(scripted.output).not.toMatch(/\d\/\d /)
    expect(scripted.output).toContain('What next')
  })

  it('installs into an existing folder chosen from the list', async () => {
    const dir = tempDir()
    dir.mkdir('notes')
    const { code } = await init(dir, ['--agents', 'codex'], ['', 'notes', 'y'])
    expect(code).toBe(0)
    expect(manifestOf(dir).contentRoot).toBe('notes')
  })

  it('asks for a name when Create a new folder is chosen', async () => {
    const dir = tempDir()
    const { code, io } = await init(dir, ['--agents', 'codex'], ['', '\u0000new', 'my-work', 'y'])
    expect(code).toBe(0)
    expect(io.questions).toContain('New folder name: ')
    expect(manifestOf(dir).contentRoot).toBe('my-work')
  })

  it('writes nothing when the user declines', async () => {
    const dir = tempDir()
    const { code } = await init(dir, ['--agents', 'codex'], ['', '', 'n'])
    expect(code).toBe(1)
    expect(dir.files()).toEqual([])
  })

  it('continues without the CLAUDE.md import when declined, and doctor reports the gap', async () => {
    const dir = tempDir()
    dir.write('CLAUDE.md', '# Rules\n')
    const { code } = await init(dir, ['--agents', 'claude-code'], ['', '', 'n', 'y'])
    expect(code).toBe(0)
    expect(dir.read('CLAUDE.md')).toBe('# Rules\n')
    expect(manifestOf(dir).claudeImport).toBeUndefined()
    const io = scriptedIo(dir.root)
    await run(['doctor'], { io, bundle })
    expect(io.output()).toContain('CLAUDE.md does not import AGENTS.md')
  })
})

describe('playground dependencies', () => {
  const args = ['--agents', 'codex', '--capabilities', 'prototyping', '--yes']

  it('installs them when Prototyping is added', async () => {
    const dir = tempDir()
    const { code, io } = await init(dir, args)
    expect(code).toBe(0)
    expect(io.execs).toEqual([`npm install ${path.join(dir.root, 'prototype-playground')}`])
    expect(io.output()).toContain('cd prototype-playground && npm start')
  })

  it('skips them with --no-install', async () => {
    const dir = tempDir()
    const { io } = await init(dir, [...args, '--no-install'])
    expect(io.execs).toEqual([])
    expect(io.output()).toContain('npm install && npm start')
  })

  it('keeps the installation when npm fails', async () => {
    const dir = tempDir()
    const io = scriptedIo(dir.root, undefined, 1)
    const code = await run(['init', ...args], { io, bundle })
    expect(code).toBe(0)
    expect(io.stderr.join('\n')).toContain('retry with: cd prototype-playground && npm install')
    expect(manifestOf(dir).capabilities).toContain('prototyping')
  })
})

describe('init into an established repository', () => {
  it('adopts byte-identical files and keeps different user-owned starters', async () => {
    const dir = tempDir()
    const guide = fs.readFileSync(`${bundle.root}/mcp-config/github.md`)
    dir.write('.product-owner-toolkit/guides/mcp-config/github.md', guide.toString('utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'))
    dir.write('product/context/company-context.md', '# Our own context\n')
    const { code, output } = await init(dir, ['--agents', 'codex', '--yes'])
    expect(code).toBe(0)
    expect(output).toMatch(/Existing identical files to adopt \(1\)[\s\S]*mcp-config\/github\.md/)
    expect(output).toMatch(/Existing files kept as they are \(1\)[\s\S]*product\/context\/company-context\.md/)
    expect(dir.read('product/context/company-context.md')).toBe('# Our own context\n')
    expect(manifestOf(dir).managedFiles['.product-owner-toolkit/guides/mcp-config/github.md']).toBeDefined()
  })

  it('stops on a different file at a managed path', async () => {
    const dir = tempDir()
    dir.write('.product-owner-toolkit/guides/mcp-config/github.md', 'mine\n')
    await expectStop(dir, ['--agents', 'codex', '--yes'], /mcp-config\/github\.md already exists with different content/)
  })

  it('stops on an existing skill with a toolkit skill name, including folders only Cursor reads', async () => {
    const own = tempDir()
    own.write('.agents/skills/prd-writer/SKILL.md', '# My PRD skill\n')
    await expectStop(own, ['--agents', 'codex', '--yes'], /A skill named prd-writer already exists at \.agents\/skills\/prd-writer\//)
    const cursor = tempDir()
    cursor.write('.cursor/skills/uat-writer/SKILL.md', '# Mine\n')
    await expectStop(cursor, ['--agents', 'cursor', '--yes'], /A skill named uat-writer already exists at \.cursor\/skills\/uat-writer\//)
  })

  it('stops on a different prototype-playground/ but ignores dependency folders in an identical one', async () => {
    const other = tempDir()
    other.write('prototype-playground/package.json', '{"name":"mine"}\n')
    await expectStop(other, ['--agents', 'codex', '--capabilities', 'prototyping', '--yes'], /A different prototype-playground\/ already exists/)

    const same = tempDir()
    await init(same, ['--agents', 'codex', '--capabilities', 'prototyping', '--yes'])
    const copy = tempDir()
    fs.cpSync(`${same.root}/prototype-playground`, `${copy.root}/prototype-playground`, { recursive: true })
    copy.write('prototype-playground/node_modules/x/index.js', '')
    copy.write('prototype-playground/package-lock.json', '{"changed":true}\n')
    const { code, output } = await init(copy, ['--agents', 'codex', '--capabilities', 'prototyping', '--yes'])
    expect(code).toBe(0)
    expect(output).toContain('prototype-playground/src/workspace.ts')
  })

  it('stops on a symlinked content root that leads outside the target', async () => {
    const dir = tempDir()
    dir.symlink('product', tempDir().root)
    await expectStop(dir, ['--agents', 'codex', '--yes'], /product is a symlink/)
  })

  it('stops on a case-only collision', async () => {
    const dir = tempDir()
    dir.write('Product/notes.md', 'x')
    await expectStop(dir, ['--agents', 'codex', '--yes'], /Product differs only in letter case/)
  })

  it('stops when AGENTS.override.md exists', async () => {
    const dir = tempDir()
    dir.write('AGENTS.override.md', 'override\n')
    await expectStop(dir, ['--agents', 'codex', '--yes'], /AGENTS\.override\.md exists/)
  })

  it.each([
    ['duplicate', `${BLOCK_BEGIN}\n${BLOCK_END}\n${BLOCK_BEGIN}\n${BLOCK_END}\n`],
    ['malformed', `# X\n${BLOCK_BEGIN}\n`],
  ])('stops on a %s toolkit block in AGENTS.md', async (_label, text) => {
    const dir = tempDir()
    dir.write('AGENTS.md', text)
    await expectStop(dir, ['--agents', 'codex', '--yes'], /malformed Product Owner Toolkit block/)
  })

  it('inserts into a recognised map section without touching other content', async () => {
    const dir = tempDir()
    const original = '# Repo\n\n## Folder Structure\n\n```\nsrc/\n```\n\n## Testing\n\nRun it.\n'
    dir.write('AGENTS.md', original)
    await init(dir, ['--agents', 'codex', '--yes'])
    const updated = dir.read('AGENTS.md')
    const block = updated.slice(updated.indexOf(BLOCK_BEGIN), updated.indexOf(BLOCK_END) + BLOCK_END.length)
    expect(block).toMatch(/^<!-- productownertoolkit:begin -->\n### Product Owner Toolkit/)
    expect(updated).toBe(original.replace('```\n\n## Testing', `\`\`\`\n\n${block}\n\n## Testing`))
  })

  it('stops when both CLAUDE.md files exist and Claude Code is selected', async () => {
    const dir = tempDir()
    dir.write('CLAUDE.md', 'a\n')
    dir.write('.claude/CLAUDE.md', 'b\n')
    await expectStop(dir, ['--agents', 'claude-code', '--yes'], /Both CLAUDE\.md and \.claude\/CLAUDE\.md exist/)
  })

  it('adds the import to .claude/CLAUDE.md with a relative path', async () => {
    const dir = tempDir()
    dir.write('.claude/CLAUDE.md', 'b\n')
    await init(dir, ['--agents', 'claude-code', '--yes'])
    expect(dir.read('.claude/CLAUDE.md')).toBe('@../AGENTS.md\nb\n')
    expect(manifestOf(dir).claudeImport).toBe('.claude/CLAUDE.md')
  })
})

describe('init on an existing installation', () => {
  it('adds agents and capabilities without touching user content or existing skills', async () => {
    const dir = tempDir()
    await init(dir, ['--agents', 'claude-code', '--yes'])
    dir.write('product/context/company-context.md', '# Configured\n')
    const first = manifestOf(dir)
    const { code, output } = await init(dir, ['--agents', 'codex', '--capabilities', 'notion', '--yes'])
    expect(code).toBe(0)
    expect(output).toContain('Codex (new)')
    const second = manifestOf(dir)
    expect(second).toMatchObject({ agents: ['claude-code', 'codex'], capabilities: ['core', 'notion'], skillDirectories: ['.claude/skills', '.agents/skills'] })
    expect(second.installedAt).toBe(first.installedAt)
    expect(dir.read('product/context/company-context.md')).toBe('# Configured\n')
    expect(dir.exists('.agents/skills/notion-sync/SKILL.md')).toBe(true)
    expect(dir.exists('.claude/skills/notion-sync/SKILL.md')).toBe(true)
  })

  it('keeps the existing skill folder when adding an agent that would otherwise choose another', async () => {
    const dir = tempDir()
    await init(dir, ['--agents', 'cursor', '--yes'])
    await init(dir, ['--agents', 'claude-code', '--yes'])
    expect(manifestOf(dir).skillDirectories).toEqual(['.agents/skills', '.claude/skills'])
  })

  it('preserves configuration written by bootstrap-context', async () => {
    const dir = tempDir()
    await init(dir, ['--agents', 'codex', '--yes'])
    const configured = { ...manifestOf(dir), configuration: { status: 'complete' as const, completedAt: '2026-09-25T12:00:00Z' } }
    dir.write(MANIFEST_PATH, serialiseManifest(configured))
    await init(dir, ['--capabilities', 'authoring', '--yes'])
    expect(manifestOf(dir).configuration).toEqual(configured.configuration)
  })

  it('refuses a newer manifest schema without writing', async () => {
    const dir = tempDir()
    dir.write(MANIFEST_PATH, JSON.stringify({ schemaVersion: 2 }))
    await expectStop(dir, ['--agents', 'codex', '--yes'], /newer than this CLI supports/)
  })

  it('refuses an unknown older manifest schema without writing', async () => {
    const dir = tempDir()
    dir.write(MANIFEST_PATH, JSON.stringify({ schemaVersion: 0 }))
    await expectStop(dir, ['--agents', 'codex', '--yes'], /no supported migration/)
  })

  it('refuses to mix toolkit versions or change the content root', async () => {
    const dir = tempDir()
    await init(dir, ['--agents', 'codex', '--yes'])
    await expectStop(dir, ['--content-root', 'elsewhere', '--yes'], /content root cannot be changed/)
    dir.write(MANIFEST_PATH, serialiseManifest({ ...manifestOf(dir), toolkitVersion: '0.0.9' }))
    await expectStop(dir, ['--capabilities', 'notion', '--yes'], /npx productownertoolkit@0\.0\.9 init/)
  })

  it('stops when the managed block was edited', async () => {
    const dir = tempDir()
    await init(dir, ['--agents', 'codex', '--yes'])
    dir.write('AGENTS.md', dir.read('AGENTS.md').replace('Skills:', 'My note. Skills:'))
    await expectStop(dir, ['--capabilities', 'notion', '--yes'], /has been edited since it was installed/)
  })
})

describe('applyPlan', () => {
  it('undoes everything when the disk changes after planning', () => {
    const dir = tempDir()
    dir.write('AGENTS.md', '# Mine\n')
    const planned = plan(Target.open(dir.root), bundle, { agents: ['codex'], capabilities: [], contentRoot: 'product', now: '2026-09-25T00:00:00Z' })
    const last = planned.files.filter((f) => f.action === 'create').at(-1)!
    dir.write(last.path, 'appeared\n')
    expect(() => applyPlan(dir.root, planned, { claudeImport: false })).toThrow(ApplyError)
    expect(dir.files()).toEqual(['AGENTS.md', last.path])
    expect(dir.read('AGENTS.md')).toBe('# Mine\n')
  })
})
