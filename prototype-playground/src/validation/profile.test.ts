import { describe, expect, it } from 'vitest'
import { loadActiveDesignProfile, loadDesignProfileVersion, parseActivePointer } from './profile'
import { PathResolver } from './paths'
import { makeFixtureRepo, type FixtureRepo } from '../testing/make-fixture-repo'

const VERSION_DIR = 'design-system/profiles/v001'

async function withRepo(fn: (repo: FixtureRepo) => Promise<void>): Promise<void> {
  const repo = await makeFixtureRepo()
  try {
    await fn(repo)
  } finally {
    await repo.cleanup()
  }
}

describe('parseActivePointer', () => {
  it('accepts the exact two-line grammar', () => {
    expect(parseActivePointer('v001\nsha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789\n')).toEqual({
      version: 'v001',
      fingerprint: 'sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    })
  })

  it('rejects every other shape', () => {
    const good = 'sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
    for (const bad of [
      'v001\n' + good, // missing trailing LF
      'v001\n' + good + '\n\n', // extra blank line
      'v001\n' + good + '\nextra\n', // three lines
      'v0001\n' + good + '\n', // version not vNNN
      'v01\n' + good + '\n',
      'v001\n' + good.toUpperCase() + '\n', // uppercase hex
      'v001\n' + good.replace('a', 'z') + '\n',
      'v001\nnot-a-fingerprint\n',
      '',
    ]) {
      expect(parseActivePointer(bad)).toBeNull()
    }
  })
})

describe('loadActiveDesignProfile', () => {
  it('loads a consistent fixture profile', async () => {
    await withRepo(async (repo) => {
      const result = await loadActiveDesignProfile(new PathResolver(repo.root))
      expect(result.diagnostics).toEqual([])
      expect(result.resolved?.id).toBe('default')
      expect(result.resolved?.version).toBe('v001')
      expect(result.resolved?.fingerprint).toBe(repo.profileFingerprint)
      expect(result.pointer?.version).toBe('v001')
    })
  })

  it('reports a tampered ACTIVE fingerprint as PROFILE_FINGERPRINT_MISMATCH', async () => {
    await withRepo(async (repo) => {
      await repo.write('design-system/profiles/ACTIVE', 'v001\nsha256:0000000000000000000000000000000000000000000000000000000000000000\n')
      const result = await loadActiveDesignProfile(new PathResolver(repo.root))
      expect(result.diagnostics.some((d) => d.code === 'PROFILE_FINGERPRINT_MISMATCH' && d.severity === 'error')).toBe(true)
      expect(result.resolved).toBeNull()
    })
  })

  it('reports malformed ACTIVE as PROFILE_POINTER_INVALID', async () => {
    await withRepo(async (repo) => {
      await repo.write('design-system/profiles/ACTIVE', 'v001\n')
      const result = await loadActiveDesignProfile(new PathResolver(repo.root))
      expect(result.diagnostics.some((d) => d.code === 'PROFILE_POINTER_INVALID')).toBe(true)
    })
  })

  it('reports a missing ACTIVE', async () => {
    await withRepo(async (repo) => {
      await repo.remove('design-system/profiles/ACTIVE')
      const result = await loadActiveDesignProfile(new PathResolver(repo.root))
      expect(result.diagnostics.some((d) => d.code === 'SOURCE_NOT_FOUND' && d.path === 'design-system/profiles/ACTIVE')).toBe(true)
    })
  })

  it('detects changed immutable bytes after ACTIVE was written', async () => {
    await withRepo(async (repo) => {
      await repo.write(`${VERSION_DIR}/tokens.css`, ':root { --background: #000; }\n')
      const result = await loadActiveDesignProfile(new PathResolver(repo.root))
      expect(result.diagnostics.some((d) => d.code === 'PROFILE_FINGERPRINT_MISMATCH')).toBe(true)
    })
  })

  it('flags a drifted raw source as a SOURCE_DRIFT warning only', async () => {
    await withRepo(async (repo) => {
      await repo.write('design-system/example.pen', 'drifted bytes')
      const result = await loadActiveDesignProfile(new PathResolver(repo.root))
      const drift = result.diagnostics.find((d) => d.code === 'SOURCE_DRIFT')
      expect(drift?.severity).toBe('warning')
      expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(false)
      expect(result.resolved).not.toBeNull()
    })
  })

  it('flags a missing raw source as a SOURCE_DRIFT warning', async () => {
    await withRepo(async (repo) => {
      await repo.remove('design-system/example.pen')
      const result = await loadActiveDesignProfile(new PathResolver(repo.root))
      expect(result.diagnostics.some((d) => d.code === 'SOURCE_DRIFT' && d.severity === 'warning')).toBe(true)
      expect(result.resolved).not.toBeNull()
    })
  })

  it('rejects symlinked profile members', async () => {
    await withRepo(async (repo) => {
      await repo.write('design-system/outside.css', ':root { --background: #fff; }\n')
      await repo.remove(`${VERSION_DIR}/tokens.css`)
      await repo.link(`${VERSION_DIR}/tokens.css`, `${repo.root}/design-system/outside.css`)
      await repo.refreshActive()
      const result = await loadActiveDesignProfile(new PathResolver(repo.root))
      expect(result.diagnostics.some((d) => d.code === 'PATH_NOT_AUTHORISED')).toBe(true)
      expect(result.resolved).toBeNull()
    })
  })

  it('rejects duplicate component ids', async () => {
    await withRepo(async (repo) => {
      const components = { schemaVersion: 1, components: [
        { id: 'button', name: 'Button', variants: [], sourceIds: ['example-pen'] },
        { id: 'button', name: 'Button again', variants: [], sourceIds: ['example-pen'] },
      ] }
      await repo.write(`${VERSION_DIR}/components.json`, JSON.stringify(components))
      const fingerprint = await repo.refreshActive()
      const manifest = JSON.parse(JSON.stringify({ id: 'default' }))
      void manifest
      const result = await loadActiveDesignProfile(new PathResolver(repo.root))
      expect(result.diagnostics.some((d) => d.code === 'PROFILE_SCHEMA_INVALID' && d.message.includes('Duplicate component id'))).toBe(true)
      expect(fingerprint).toMatch(/^sha256:/)
    })
  })

  it('rejects an oversize tokens.css as PROFILE_TOO_LARGE', async () => {
    await withRepo(async (repo) => {
      await repo.write(`${VERSION_DIR}/tokens.css`, ':root { --x: ' + 'a'.repeat(1024 * 1024 + 10) + '; }\n')
      await repo.refreshActive()
      const result = await loadActiveDesignProfile(new PathResolver(repo.root))
      expect(result.diagnostics.some((d) => d.code === 'PROFILE_TOO_LARGE')).toBe(true)
    })
  })

  it('treats a missing optional Figma source as a warning only', async () => {
    await withRepo(async (repo) => {
      const profile = JSON.parse(await (await import('node:fs/promises')).readFile(`${repo.root}/${VERSION_DIR}/profile.json`, 'utf8'))
      profile.sources.push({ id: 'brand-figma', kind: 'figma', roles: ['components'], required: false, uri: 'https://figma.com/file/x', sourceKey: 'file-x:v3' })
      await repo.write(`${VERSION_DIR}/profile.json`, JSON.stringify(profile))
      await repo.refreshActive()
      const result = await loadActiveDesignProfile(new PathResolver(repo.root))
      expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(false)
      expect(result.resolved).not.toBeNull()
      expect(result.diagnostics.filter((d) => d.code === 'SOURCE_DRIFT')).toEqual([])
    })
  })

  it('rejects a profile.json version that disagrees with its directory', async () => {
    await withRepo(async (repo) => {
      const profile = JSON.parse(await (await import('node:fs/promises')).readFile(`${repo.root}/${VERSION_DIR}/profile.json`, 'utf8'))
      profile.version = 'v002'
      await repo.write(`${VERSION_DIR}/profile.json`, JSON.stringify(profile))
      const result = await loadDesignProfileVersion(new PathResolver(repo.root), 'v001')
      expect(result.diagnostics.some((d) => d.code === 'PROFILE_POINTER_INVALID' && d.message.includes('v002'))).toBe(true)
    })
  })

  it('computes a deterministic fingerprint independent of walk order', async () => {
    await withRepo(async (repo) => {
      const resolver = new PathResolver(repo.root)
      const first = await loadDesignProfileVersion(resolver, 'v001')
      const second = await loadDesignProfileVersion(new PathResolver(repo.root), 'v001')
      expect(first.resolved?.fingerprint).toBe(second.resolved?.fingerprint)
      expect(first.resolved?.fingerprint).toBe(repo.profileFingerprint)
    })
  })
})
