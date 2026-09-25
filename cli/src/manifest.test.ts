import { describe, expect, it } from 'vitest'
import { MANIFEST_PATH, parseManifest, serialiseManifest, type InstallationManifest } from './manifest.ts'

function sampleManifest(overrides: Partial<InstallationManifest> = {}): InstallationManifest {
  return {
    schemaVersion: 1,
    toolkitVersion: '0.1.0',
    contentRoot: 'product',
    toolkitRoot: '.product-owner-toolkit/guides',
    agents: ['claude-code'],
    skillDirectories: ['.claude/skills'],
    capabilities: ['core'],
    managedFiles: { 'z.md': 'sha256:1', 'a.md': 'sha256:2' },
    managedBlock: { path: 'AGENTS.md', checksum: 'sha256:3' },
    installedAt: '2026-09-25T00:00:00.000Z',
    updatedAt: '2026-09-25T00:00:00.000Z',
    configuration: { status: 'pending', completedAt: null },
    ...overrides,
  }
}

describe('parseManifest', () => {
  it('round-trips a valid manifest with sorted managed files', () => {
    const text = serialiseManifest(sampleManifest())
    expect(Object.keys(JSON.parse(text).managedFiles)).toEqual(['a.md', 'z.md'])
    const read = parseManifest(text)
    expect(read.kind).toBe('valid')
  })

  it('preserves extra configuration fields', () => {
    const manifest = sampleManifest({ configuration: { status: 'complete', completedAt: '2026-09-26T00:00:00Z', note: 'kept' } })
    const read = parseManifest(serialiseManifest(manifest))
    expect(read.kind === 'valid' && read.manifest.configuration).toEqual(manifest.configuration)
  })

  it('refuses a newer schema with a pointer to the latest CLI', () => {
    const read = parseManifest(JSON.stringify({ ...sampleManifest(), schemaVersion: 2 }))
    expect(read.kind).toBe('unsupported')
    expect(read.kind === 'unsupported' && read.message).toMatch(/newer than this CLI supports.*@latest/)
  })

  it('refuses an unknown older schema', () => {
    const read = parseManifest(JSON.stringify({ ...sampleManifest(), schemaVersion: 0 }))
    expect(read.kind === 'unsupported' && read.message).toMatch(/no supported migration/)
  })

  it.each([
    ['invalid JSON', '{'],
    ['a non-object', '[]'],
    ['an unsafe content root', JSON.stringify(sampleManifest({ contentRoot: '../elsewhere' }))],
    ['a self-checksum', JSON.stringify(sampleManifest({ managedFiles: { [MANIFEST_PATH]: 'sha256:x' } }))],
    ['a bad configuration status', JSON.stringify({ ...sampleManifest(), configuration: { status: 'done', completedAt: null } })],
  ])('rejects %s', (_label, text) => {
    expect(parseManifest(text).kind).toBe('invalid')
  })
})
