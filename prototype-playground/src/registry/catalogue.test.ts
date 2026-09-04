import { describe, expect, it } from 'vitest'
import { classifyManifestPath, loadRepositoryCatalogue } from './catalogue'
import { makeFixtureRepo, validEntryHtml, validManifest, type FixtureRepo } from '../testing/make-fixture-repo'

async function withRepo(fn: (repo: FixtureRepo) => Promise<void>): Promise<void> {
  const repo = await makeFixtureRepo()
  try {
    await fn(repo)
  } finally {
    await repo.cleanup()
  }
}

describe('classifyManifestPath', () => {
  it('derives origin, classification, and feature from the four patterns', () => {
    const live = classifyManifestPath('requirements/platform-requirements/payments/prototypes/checkouts/prototype.json')
    expect(live).toMatchObject({ origin: 'requirement', classification: 'platform', feature: 'payments' })
    const customer = classifyManifestPath('requirements/customer-functional-requirements/savings/prototypes/pots/prototype.json')
    expect(customer).toMatchObject({ origin: 'requirement', classification: 'customer', feature: 'savings' })
    const internal = classifyManifestPath('requirements/internal-functional-requirements/admin/prototypes/roles/prototype.json')
    expect(internal).toMatchObject({ origin: 'requirement', classification: 'internal', feature: 'admin' })
    const example = classifyManifestPath('examples/demo-feature/prototypes/demo/prototype.json')
    expect(example).toMatchObject({ origin: 'example', classification: null, feature: 'demo-feature' })
    expect(classifyManifestPath('docs/demo-feature/prototypes/demo/prototype.json')).toBeNull()
    expect(classifyManifestPath('requirements/platform-requirements/payments/prototypes/prototype.json')).toBeNull()
  })
})

describe('loadRepositoryCatalogue', () => {
  it('loads a valid fixture repository with zero errors', async () => {
    await withRepo(async (repo) => {
      const catalogue = await loadRepositoryCatalogue(repo.root)
      expect(catalogue.totals).toEqual({ errors: 0, warnings: 0 })
      const record = catalogue.records[0]
      if (!record) throw new Error('expected one record')
      expect(record).toMatchObject({ id: 'demo', origin: 'example', feature: 'demo-feature' })
      expect(record.designSystem.currentness).toBe('active')
      expect(record.designSystem.fingerprint).toBe(repo.profileFingerprint)
      const html = await record.loadVariant('focused')
      expect(html).toBe(validEntryHtml())
      await expect(record.loadVariant('ghost')).rejects.toThrow('Unknown variant')
    })
  })

  it('hides examples from records when includeExamples is false but still validates them', async () => {
    await withRepo(async (repo) => {
      const catalogue = await loadRepositoryCatalogue(repo.root, { includeExamples: false })
      expect(catalogue.records).toHaveLength(0)
      expect(catalogue.totals.errors).toBe(0)
    })
  })

  it('excludes a schema-invalid manifest with PROTOTYPE_SCHEMA_INVALID', async () => {
    await withRepo(async (repo) => {
      const manifest = validManifest(repo.profileFingerprint) as Record<string, unknown>
      delete manifest.prototypeOnly
      await repo.write('examples/demo-feature/prototypes/demo/prototype.json', JSON.stringify(manifest))
      const catalogue = await loadRepositoryCatalogue(repo.root)
      expect(catalogue.records).toHaveLength(0)
      expect(catalogue.diagnostics.some((d) => d.code === 'PROTOTYPE_SCHEMA_INVALID' && d.path.endsWith('prototype.json'))).toBe(true)
      expect(catalogue.totals.errors).toBe(1)
    })
  })

  it('excludes every duplicate prototype id', async () => {
    await withRepo(async (repo) => {
      await repo.write('examples/copy-feature/prd/copy-feature-prd.md', '# Copy\n')
      await repo.write('examples/copy-feature/prototypes/demo/variants/focused.html', validEntryHtml())
      await repo.write('examples/copy-feature/prototypes/demo/prototype.json', JSON.stringify(validManifest(repo.profileFingerprint, { feature: 'copy-feature' })))
      const catalogue = await loadRepositoryCatalogue(repo.root)
      expect(catalogue.records).toHaveLength(0)
      expect(catalogue.diagnostics.filter((d) => d.code === 'PROTOTYPE_ID_DUPLICATE')).toHaveLength(2)
    })
  })

  it('rejects a cross-feature PRD reference', async () => {
    await withRepo(async (repo) => {
      const manifest = validManifest(repo.profileFingerprint) as { source: { prd: string } }
      manifest.source.prd = 'examples/other-feature/prd/demo-prd.md'
      await repo.write('examples/demo-feature/prototypes/demo/prototype.json', JSON.stringify(manifest))
      const catalogue = await loadRepositoryCatalogue(repo.root)
      expect(catalogue.records).toHaveLength(0)
      expect(catalogue.diagnostics.some((d) => d.code === 'PATH_NOT_AUTHORISED' && d.path === 'examples/other-feature/prd/demo-prd.md')).toBe(true)
    })
  })

  it('rejects a pinned fingerprint that disagrees with the version', async () => {
    await withRepo(async (repo) => {
      const manifest = validManifest(repo.profileFingerprint) as { designSystem: { fingerprint: string } }
      manifest.designSystem.fingerprint = 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
      await repo.write('examples/demo-feature/prototypes/demo/prototype.json', JSON.stringify(manifest))
      const catalogue = await loadRepositoryCatalogue(repo.root)
      expect(catalogue.records).toHaveLength(0)
      expect(catalogue.diagnostics.some((d) => d.code === 'PROFILE_FINGERPRINT_MISMATCH')).toBe(true)
    })
  })

  it('rejects an entry outside the prototype variants directory', async () => {
    await withRepo(async (repo) => {
      const manifest = validManifest(repo.profileFingerprint) as { variants: Array<{ entry: string }> }
      manifest.variants[0]!.entry = 'examples/other/variants/focused.html'
      await repo.write('examples/demo-feature/prototypes/demo/prototype.json', JSON.stringify(manifest))
      const catalogue = await loadRepositoryCatalogue(repo.root)
      expect(catalogue.records).toHaveLength(0)
      expect(catalogue.diagnostics.some((d) => d.code === 'PATH_NOT_AUTHORISED')).toBe(true)
    })
  })

  it('reports an entry with a forbidden script as ENTRY_NOT_SELF_CONTAINED', async () => {
    await withRepo(async (repo) => {
      const html = validEntryHtml().replace('<h1>Home</h1>', '<h1>Home</h1>\n      <script>alert(1)</script>')
      await repo.write('examples/demo-feature/prototypes/demo/variants/focused.html', html)
      const catalogue = await loadRepositoryCatalogue(repo.root)
      expect(catalogue.records).toHaveLength(0)
      expect(catalogue.diagnostics.some((d) => d.code === 'ENTRY_NOT_SELF_CONTAINED' && d.message.includes('<script>'))).toBe(true)
    })
  })

  it('labels a prototype pinned to a non-active profile version as older', async () => {
    await withRepo(async (repo) => {
      // Copy v001 to v002 and pin the manifest to it; ACTIVE still points at v001.
      const { cp } = await import('node:fs/promises')
      await cp(`${repo.root}/design-system/profiles/v001`, `${repo.root}/design-system/profiles/v002`, { recursive: true })
      const v002Profile = JSON.parse(await (await import('node:fs/promises')).readFile(`${repo.root}/design-system/profiles/v002/profile.json`, 'utf8'))
      v002Profile.version = 'v002'
      await repo.write('design-system/profiles/v002/profile.json', JSON.stringify(v002Profile))
      const manifest = validManifest(repo.profileFingerprint) as { designSystem: { version: string; fingerprint: string } }
      manifest.designSystem.version = 'v002'
      // Recompute the v002 fingerprint through the catalogue loader by
      // deriving it from the same bytes: v002 differs only in profile.json.
      const catalogueProbe = await loadRepositoryCatalogue(repo.root, { selectedPrototypeId: 'absent' })
      void catalogueProbe
      const resolver = new (await import('../validation/paths')).PathResolver(repo.root)
      const fingerprint = await (await import('../validation/profile')).computeProfileFingerprint(resolver, 'v002')
      manifest.designSystem.fingerprint = fingerprint
      await repo.write('examples/demo-feature/prototypes/demo/prototype.json', JSON.stringify(manifest))
      const catalogue = await loadRepositoryCatalogue(repo.root)
      expect(catalogue.records).toHaveLength(1)
      expect(catalogue.records[0]?.designSystem.currentness).toBe('older')
      expect(catalogue.activeProfile?.version).toBe('v001')
      expect(catalogue.profiles['default@v002']).toBeDefined()
    })
  })

  it('filters discovery to the selected prototype id', async () => {
    await withRepo(async (repo) => {
      await repo.write('examples/second-feature/prd/second-feature-prd.md', '# Second\n')
      await repo.write('examples/second-feature/prototypes/second/variants/focused.html', validEntryHtml())
      await repo.write('examples/second-feature/prototypes/second/prototype.json', JSON.stringify(validManifest(repo.profileFingerprint, { id: 'second', feature: 'second-feature' })))
      const catalogue = await loadRepositoryCatalogue(repo.root, { selectedPrototypeId: 'second' })
      expect(catalogue.records.map((r) => r.id)).toEqual(['second'])
      const full = await loadRepositoryCatalogue(repo.root)
      expect(full.records.map((r) => r.id)).toEqual(['demo', 'second'])
    })
  })

  it('sorts live prototypes before examples, then by feature and title', async () => {
    await withRepo(async (repo) => {
      await repo.write('requirements/platform-requirements/zeta/prototypes/live-two/variants/focused.html', validEntryHtml())
      await repo.write(
        'requirements/platform-requirements/zeta/prototypes/live-two/prototype.json',
        JSON.stringify(validManifest(repo.profileFingerprint, { id: 'live-two', feature: 'zeta' })).replace('examples/zeta/prd/zeta-prd.md', 'requirements/platform-requirements/zeta/prd/zeta-prd.md').replace('examples/zeta/prototypes/live-two/variants/focused.html', 'requirements/platform-requirements/zeta/prototypes/live-two/variants/focused.html'),
      )
      await repo.write('requirements/platform-requirements/zeta/prd/zeta-prd.md', '# Zeta\n')
      await repo.write('examples/alpha-feature/prototypes/alpha/variants/focused.html', validEntryHtml())
      await repo.write('examples/alpha-feature/prd/alpha-feature-prd.md', '# Alpha\n')
      await repo.write('examples/alpha-feature/prototypes/alpha/prototype.json', JSON.stringify(validManifest(repo.profileFingerprint, { id: 'alpha', feature: 'alpha-feature' })))
      const catalogue = await loadRepositoryCatalogue(repo.root)
      expect(catalogue.records.map((r) => r.id)).toEqual(['live-two', 'alpha', 'demo'])
    })
  })
})
