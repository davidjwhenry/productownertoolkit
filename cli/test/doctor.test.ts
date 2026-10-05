import fs from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { loadBundle } from '../src/catalogue/bundle.ts'
import type { DoctorReport } from '../src/commands/doctor.ts'
import { run } from '../src/main.ts'
import { MANIFEST_PATH } from '../src/manifest.ts'
import { cleanupTempDirs, scriptedIo, tempDir, type TempDir } from './helpers.ts'

afterEach(cleanupTempDirs)

const bundle = loadBundle()

async function installed(args: string[] = ['--agents', 'claude-code,codex']): Promise<TempDir> {
  const dir = tempDir()
  const code = await run(['init', ...args, '--yes'], { io: scriptedIo(dir.root), bundle })
  if (code !== 0) throw new Error('init failed')
  return dir
}

async function doctor(dir: TempDir): Promise<{ code: number; report: DoctorReport; text: string }> {
  const io = scriptedIo(dir.root)
  const code = await run(['doctor', '--json'], { io, bundle })
  const text = scriptedIo(dir.root)
  await run(['doctor'], { io: text, bundle })
  return { code, report: JSON.parse(io.stdout.join('\n')) as DoctorReport, text: text.output() }
}

const codes = (report: DoctorReport) => report.findings.map((f) => f.code)

describe('doctor', () => {
  it('reports a fresh installation as healthy with configuration pending', async () => {
    const dir = await installed()
    const before = dir.files().map((f) => [f, dir.read(f)])
    const { code, report, text } = await doctor(dir)
    expect(code).toBe(0)
    expect(report.status).toBe('healthy')
    expect(report.installation).toMatchObject({ agents: ['claude-code', 'codex'], capabilities: ['core'], contentRoot: 'product', contentRootPresent: true })
    expect(codes(report)).toEqual(['configuration-pending'])
    expect(text).toContain('Healthy.')
    // Read-only.
    expect(dir.files().map((f) => [f, dir.read(f)])).toEqual(before)
  })

  it('reports a missing installation', async () => {
    const { code, report } = await doctor(tempDir())
    expect(code).toBe(1)
    expect(report.status).toBe('not-installed')
  })

  it('treats a CRLF-converted clone as unmodified', async () => {
    const dir = await installed()
    for (const file of dir.files('.claude/skills')) {
      dir.write(`.claude/skills/${file}`, dir.read(`.claude/skills/${file}`).replace(/\n/g, '\r\n'))
    }
    expect((await doctor(dir)).report.status).toBe('healthy')
  })

  it('reports modified and missing managed files and incomplete skill mirrors', async () => {
    const dir = await installed()
    dir.write('.product-owner-toolkit/guides/mcp-config/github.md', 'edited\n')
    dir.write('.agents/skills/prd-writer/SKILL.md', '')
    fs.rmSync(`${dir.root}/.claude/skills/uat-writer/SKILL.md`)
    const { code, report, text } = await doctor(dir)
    expect(code).toBe(1)
    expect(report.status).toBe('unhealthy')
    const errors = report.findings.filter((f) => f.severity === 'error').map((f) => `${f.code} ${f.path}`)
    expect(errors.sort()).toEqual([
      'managed-file-modified .agents/skills/prd-writer/SKILL.md',
      'managed-file-modified .product-owner-toolkit/guides/mcp-config/github.md',
      'skill-file-missing .claude/skills/uat-writer/SKILL.md',
    ])
    expect(text).toContain('The .claude/skills/ mirror is incomplete')
    expect(text).toContain('doctor changed nothing')
  })

  it('reports managed block, override, and CLAUDE.md problems', async () => {
    const dir = await installed()
    dir.write('AGENTS.md', dir.read('AGENTS.md').replace('Skills:', 'Edited. Skills:'))
    dir.write('AGENTS.override.md', 'x')
    dir.write('CLAUDE.md', 'no import\n')
    dir.write('.claude/CLAUDE.md', 'no import\n')
    dir.write('CLAUDE.local.md', 'personal\n')
    const { report } = await doctor(dir)
    expect(codes(report)).toEqual(expect.arrayContaining([
      'managed-block-modified',
      'agents-override',
      'claude-md-ambiguous',
      'claude-md-no-import',
      'claude-local-no-import',
    ]))
  })

  it('reports a malformed or missing managed block', async () => {
    const dir = await installed()
    dir.write('AGENTS.md', '# Nothing here\n')
    expect(codes((await doctor(dir)).report)).toContain('managed-block-missing')
    dir.write('AGENTS.md', '<!-- productownertoolkit:begin -->\n')
    expect(codes((await doctor(dir)).report)).toContain('managed-block-malformed')
  })

  it('reports configuration once bootstrap-context completes it', async () => {
    const dir = await installed()
    const manifest = JSON.parse(dir.read(MANIFEST_PATH))
    dir.write(MANIFEST_PATH, JSON.stringify({ ...manifest, configuration: { status: 'complete', completedAt: '2026-09-25T12:00:00Z' } }))
    const { report } = await doctor(dir)
    expect(codes(report)).not.toContain('configuration-pending')
    expect(report.installation?.configuration.status).toBe('complete')
  })

  it('checks the playground and active design profile when Prototyping is installed', async () => {
    const dir = await installed(['--agents', 'codex', '--capabilities', 'prototyping'])
    let { report } = await doctor(dir)
    expect(codes(report)).toContain('playground-dependencies')
    expect(codes(report)).not.toContain('design-profile-missing')
    dir.write('product/design-system/profiles/ACTIVE', 'v999\n')
    ;({ report } = await doctor(dir))
    expect(codes(report)).toContain('design-profile-missing')
  })

  it('reports an unsupported manifest and an interrupted transaction', async () => {
    const dir = await installed()
    dir.write('.product-owner-toolkit/transaction.json', JSON.stringify({ state: 'applying' }))
    const { report } = await doctor(dir)
    expect(report.findings.find((f) => f.code === 'transaction-pending')?.message).toContain('"applying"')
    dir.write(MANIFEST_PATH, JSON.stringify({ schemaVersion: 3 }))
    const newer = await doctor(dir)
    expect(newer.code).toBe(1)
    expect(codes(newer.report)).toEqual(['manifest-unsupported'])
  })

  it('reports a missing content root', async () => {
    const dir = await installed()
    fs.rmSync(`${dir.root}/product`, { recursive: true })
    const { report } = await doctor(dir)
    expect(report.installation?.contentRootPresent).toBe(false)
    expect(codes(report)).toContain('content-root-missing')
  })
})
