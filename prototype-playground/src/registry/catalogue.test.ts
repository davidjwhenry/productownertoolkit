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

function manifestWithScreens(fingerprint: string, screens: unknown[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  const manifest = validManifest(fingerprint) as Record<string, unknown>
  const variants = manifest.variants as Array<Record<string, unknown>>
  variants[0]!.screens = screens
  return { ...manifest, ...extra }
}

const FIXTURE_SCREENS = [
  {
    id: 'home',
    label: 'Home',
    order: 1,
    scenarioId: 'happy-path',
    prdRefs: [{ section: '5.1', requirementIds: ['AF.1'] }],
    fixture: { values: { amount: '750' }, validation: { amount: 'Enter an amount' } },
  },
  { id: 'done', label: 'Done', order: 2, scenarioId: 'happy-path', prdRefs: [{ section: '5.1', requirementIds: [] }] },
]

describe('screen declarations and companions', () => {
  it('loads screens, prdMap, design notes, and amendments onto the record', async () => {
    await withRepo(async (repo) => {
      await repo.write('examples/demo-feature/prototypes/demo/prototype.json', JSON.stringify(manifestWithScreens(repo.profileFingerprint, FIXTURE_SCREENS, {
        companions: [{ kind: 'design-notes', path: 'examples/demo-feature/prototypes/demo/companions/design-notes.json' }],
      })))
      await repo.write('examples/demo-feature/prototypes/demo/companions/design-notes.json', JSON.stringify({
        schemaVersion: 1,
        notes: [{ id: 'job', section: '5.1', label: 'Funding', quote: 'AF.1 The app shall demo.', requirementIds: ['AF.1'] }],
      }))
      await repo.write('examples/demo-feature/prototypes/demo/amendments.json', JSON.stringify({
        schemaVersion: 1,
        amendments: [{
          id: 'am-001',
          screenId: 'home',
          requirementId: 'AF.1',
          title: 'Cap the amount',
          note: 'Cap it',
          selection: { variantId: 'focused', surfaceId: 'desktop', scenarioId: 'happy-path', themeId: 'light', screenId: 'home' },
          author: 'Dana',
          date: '2026-09-08',
          status: 'open',
        }],
      }))
      const catalogue = await loadRepositoryCatalogue(repo.root)
      expect(catalogue.totals).toEqual({ errors: 0, warnings: 0 })
      const record = catalogue.records[0]
      if (!record) throw new Error('expected one record')
      expect(record.variants[0]?.screens?.map((screen) => screen.id)).toEqual(['home', 'done'])
      expect(record.prdMap.sections.map((section) => section.section)).toEqual(['5.1'])
      expect(record.prdMap.sections[0]?.requirementIds).toEqual(['AF.1'])
      expect(record.designNotes).toHaveLength(1)
      expect(record.amendments).toHaveLength(1)
    })
  })

  it('rejects screens that do not mirror the entry screen set exactly', async () => {
    await withRepo(async (repo) => {
      const screens = [{ id: 'home', label: 'Home', order: 1, scenarioId: 'happy-path', prdRefs: [{ section: '5.1', requirementIds: [] }] }]
      await repo.write('examples/demo-feature/prototypes/demo/prototype.json', JSON.stringify(manifestWithScreens(repo.profileFingerprint, screens)))
      const catalogue = await loadRepositoryCatalogue(repo.root)
      expect(catalogue.records).toHaveLength(0)
      expect(catalogue.diagnostics.some((d) => d.code === 'SCREEN_UNDECLARED' && d.message.includes('"done"'))).toBe(true)
    })
  })

  it('rejects declared screens missing from the entry', async () => {
    await withRepo(async (repo) => {
      const screens = [...FIXTURE_SCREENS, { id: 'ghost', label: 'Ghost', order: 3, scenarioId: 'happy-path', prdRefs: [{ section: '5.1', requirementIds: [] }] }]
      await repo.write('examples/demo-feature/prototypes/demo/prototype.json', JSON.stringify(manifestWithScreens(repo.profileFingerprint, screens)))
      const catalogue = await loadRepositoryCatalogue(repo.root)
      expect(catalogue.diagnostics.some((d) => d.code === 'SCREEN_NOT_IN_ENTRY' && d.message.includes('"ghost"'))).toBe(true)
    })
  })

  it('rejects prdRefs to unnumbered sections and unknown requirements', async () => {
    await withRepo(async (repo) => {
      const screens = [
        { id: 'home', label: 'Home', order: 1, scenarioId: 'happy-path', prdRefs: [{ section: '9.9', requirementIds: ['AF.1'] }] },
        { id: 'done', label: 'Done', order: 2, scenarioId: 'happy-path', prdRefs: [{ section: '5.1', requirementIds: ['ZZ.9'] }] },
      ]
      await repo.write('examples/demo-feature/prototypes/demo/prototype.json', JSON.stringify(manifestWithScreens(repo.profileFingerprint, screens)))
      const catalogue = await loadRepositoryCatalogue(repo.root)
      expect(catalogue.diagnostics.some((d) => d.code === 'PRD_SECTION_UNRESOLVED' && d.message.includes('§9.9'))).toBe(true)
      expect(catalogue.diagnostics.some((d) => d.code === 'SCREEN_REF_UNKNOWN' && d.message.includes('ZZ.9'))).toBe(true)
    })
  })

  it('rejects fixtures referencing unknown controls or validation targets', async () => {
    await withRepo(async (repo) => {
      const screens = [
        { id: 'home', label: 'Home', order: 1, scenarioId: 'happy-path', prdRefs: [{ section: '5.1', requirementIds: [] }], fixture: { values: { ghost: '1' } } },
        { id: 'done', label: 'Done', order: 2, scenarioId: 'happy-path', prdRefs: [{ section: '5.1', requirementIds: [] }], fixture: { validation: { ghost: 'nope' } } },
      ]
      await repo.write('examples/demo-feature/prototypes/demo/prototype.json', JSON.stringify(manifestWithScreens(repo.profileFingerprint, screens)))
      const catalogue = await loadRepositoryCatalogue(repo.root)
      expect(catalogue.diagnostics.some((d) => d.code === 'FIXTURE_CONTROL_UNKNOWN' && d.message.includes('"ghost"'))).toBe(true)
      expect(catalogue.diagnostics.some((d) => d.code === 'FIXTURE_VALIDATION_TARGET_UNKNOWN' && d.message.includes('"ghost"'))).toBe(true)
    })
  })

  it('degrades invalid amendments and unresolvable design notes to warnings', async () => {
    await withRepo(async (repo) => {
      await repo.write('examples/demo-feature/prototypes/demo/prototype.json', JSON.stringify(manifestWithScreens(repo.profileFingerprint, FIXTURE_SCREENS, {
        companions: [{ kind: 'design-notes', path: 'examples/demo-feature/prototypes/demo/companions/design-notes.json' }],
      })))
      await repo.write('examples/demo-feature/prototypes/demo/companions/design-notes.json', JSON.stringify({
        schemaVersion: 1,
        notes: [
          { id: 'ok', section: '5.1', label: 'Funding', quote: 'AF.1 quote', requirementIds: [] },
          { id: 'bad', section: '9.9', label: 'Nowhere', quote: 'unresolvable', requirementIds: [] },
        ],
      }))
      await repo.write('examples/demo-feature/prototypes/demo/amendments.json', JSON.stringify({
        schemaVersion: 1,
        amendments: [{
          id: 'am-001',
          screenId: 'ghost',
          requirementId: null,
          title: 'Bad ref',
          note: 'n/a',
          selection: { variantId: 'focused', surfaceId: 'desktop', scenarioId: 'happy-path', themeId: 'light', screenId: 'ghost' },
          author: 'Dana',
          date: '2026-09-08',
          status: 'open',
        }],
      }))
      const catalogue = await loadRepositoryCatalogue(repo.root)
      expect(catalogue.totals.errors).toBe(0)
      expect(catalogue.totals.warnings).toBeGreaterThanOrEqual(2)
      expect(catalogue.diagnostics.some((d) => d.code === 'NOTE_SECTION_UNRESOLVED')).toBe(true)
      expect(catalogue.diagnostics.some((d) => d.code === 'AMENDMENT_SCREEN_UNKNOWN')).toBe(true)
      const record = catalogue.records[0]
      expect(record?.designNotes.map((note) => note.id)).toEqual(['ok'])
      expect(record?.amendments).toEqual([])
    })
  })
})
