import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { amendmentsRevision, checkAmendmentsDocument, handleAmendmentsRequest } from './amendments-api'
import { loadRepositoryCatalogue } from './catalogue'
import { makeFixtureRepo, validManifest, type FixtureRepo } from '../testing/make-fixture-repo'
import type { AmendmentsManifest, CatalogueResult } from '../contracts'

async function withRepo(fn: (repo: FixtureRepo, catalogue: CatalogueResult) => Promise<void>): Promise<void> {
  const repo = await makeFixtureRepo()
  try {
    // Amendments pin declared screens; give the fixture a screens contract.
    const manifest = validManifest(repo.profileFingerprint) as Record<string, unknown>
    const variants = manifest.variants as Array<Record<string, unknown>>
    variants[0]!.screens = [
      { id: 'home', label: 'Home', order: 1, scenarioId: 'happy-path', prdRefs: [{ section: '5.1', requirementIds: ['AF.1'] }] },
      { id: 'done', label: 'Done', order: 2, scenarioId: 'happy-path', prdRefs: [{ section: '5.1', requirementIds: [] }] },
      { id: 'home', label: 'Home', order: 1, scenarioId: 'declined', prdRefs: [{ section: '5.1', requirementIds: [] }] },
    ]
    ;(manifest.scenarios as Array<Record<string, unknown>>).push({
      id: 'declined',
      label: 'Declined',
      description: 'The transfer is declined',
      requirementIds: ['AF.1'],
    })
    await repo.write('examples/demo-feature/prototypes/demo/prototype.json', JSON.stringify(manifest))
    const catalogue = await loadRepositoryCatalogue(repo.root)
    await fn(repo, catalogue)
  } finally {
    await repo.cleanup()
  }
}

const VALID_DOC: AmendmentsManifest = {
  schemaVersion: 1,
  amendments: [
    {
      id: 'am-001',
      screenId: 'home',
      requirementId: 'AF.1',
      title: 'Cap the amount',
      note: 'Cap it',
      selection: { variantId: 'focused', surfaceId: 'desktop', scenarioId: 'happy-path', themeId: 'light', screenId: 'home' },
      author: 'Dana',
      date: '2026-09-08',
      status: 'open',
    },
  ],
}

describe('checkAmendmentsDocument', () => {
  it('accepts a document whose references all resolve', async () => {
    await withRepo(async (_repo, catalogue) => {
      const record = catalogue.records[0]
      if (!record) throw new Error('expected one record')
      expect(checkAmendmentsDocument(VALID_DOC, record, catalogue)).toBeNull()
    })
  })

  it('rejects unknown screens, requirements, selections, and duplicate ids', async () => {
    await withRepo(async (_repo, catalogue) => {
      const record = catalogue.records[0]
      if (!record) throw new Error('expected one record')
      const ghostScreen = structuredClone(VALID_DOC)
      ghostScreen.amendments[0]!.screenId = 'ghost'
      expect(checkAmendmentsDocument(ghostScreen, record, catalogue)).toContain('"ghost"')
      const ghostRequirement = structuredClone(VALID_DOC)
      ghostRequirement.amendments[0]!.requirementId = 'ZZ.9'
      expect(checkAmendmentsDocument(ghostRequirement, record, catalogue)).toContain('ZZ.9')
      const duplicate = structuredClone(VALID_DOC)
      duplicate.amendments.push(structuredClone(duplicate.amendments[0]!))
      expect(checkAmendmentsDocument(duplicate, record, catalogue)).toContain('more than once')
      const badTheme = structuredClone(VALID_DOC)
      badTheme.amendments[0]!.selection.themeId = 'midnight'
      expect(checkAmendmentsDocument(badTheme, record, catalogue)).toContain('unknown theme')
    })
  })

  it('validates screens against the selected scenario, not every scenario in the variant', async () => {
    await withRepo(async (_repo, catalogue) => {
      const record = catalogue.records[0]
      if (!record) throw new Error('expected one record')
      // `home` is declared for both scenarios; `done` only for `happy-path`.
      const declined = structuredClone(VALID_DOC)
      declined.amendments[0]!.selection.scenarioId = 'declined'
      expect(checkAmendmentsDocument(declined, record, catalogue)).toBeNull()
      const crossed = structuredClone(declined)
      crossed.amendments[0]!.screenId = 'done'
      expect(checkAmendmentsDocument(crossed, record, catalogue)).toContain('screen "done" is not declared by variant "focused" for scenario "declined"')
      const crossedSelection = structuredClone(declined)
      crossedSelection.amendments[0]!.selection.screenId = 'done'
      expect(checkAmendmentsDocument(crossedSelection, record, catalogue)).toContain('selection screen "done"')
      const happyDone = structuredClone(VALID_DOC)
      happyDone.amendments[0]!.screenId = 'done'
      happyDone.amendments[0]!.selection.screenId = 'done'
      expect(checkAmendmentsDocument(happyDone, record, catalogue)).toBeNull()
    })
  })
})

describe('handleAmendmentsRequest', () => {
  it('round-trips a valid PUT through disk and serves it on GET', async () => {
    await withRepo(async (repo, catalogue) => {
      const put = await handleAmendmentsRequest({
        method: 'PUT',
        suffix: '/demo',
        body: Buffer.from(JSON.stringify(VALID_DOC)),
        ifMatch: amendmentsRevision(null),
        repoRoot: repo.root,
        loadCatalogue: () => Promise.resolve(catalogue),
      })
      expect(put.status).toBe(200)
      const onDisk = await readFile(path.join(repo.root, 'examples/demo-feature/prototypes/demo/amendments.json'), 'utf8')
      expect(JSON.parse(onDisk)).toEqual(VALID_DOC)
      const get = await handleAmendmentsRequest({
        method: 'GET',
        suffix: '/demo',
        body: Buffer.alloc(0),
        repoRoot: repo.root,
        loadCatalogue: () => Promise.resolve(catalogue),
      })
      expect(get.status).toBe(200)
      expect(JSON.parse(get.body)).toEqual(VALID_DOC)
      expect(get.etag).toBe(put.etag)
    })
  })

  it('rejects invalid documents without touching disk, and unknown prototypes with 404', async () => {
    await withRepo(async (repo, catalogue) => {
      const invalid = structuredClone(VALID_DOC)
      invalid.amendments[0]!.screenId = 'ghost'
      const put = await handleAmendmentsRequest({
        method: 'PUT',
        suffix: '/demo',
        body: Buffer.from(JSON.stringify(invalid)),
        ifMatch: amendmentsRevision(null),
        repoRoot: repo.root,
        loadCatalogue: () => Promise.resolve(catalogue),
      })
      expect(put.status).toBe(422)
      await expect(readFile(path.join(repo.root, 'examples/demo-feature/prototypes/demo/amendments.json'))).rejects.toThrow()
      const missing = await handleAmendmentsRequest({
        method: 'GET',
        suffix: '/nope',
        body: Buffer.alloc(0),
        repoRoot: repo.root,
        loadCatalogue: () => Promise.resolve(catalogue),
      })
      expect(missing.status).toBe(404)
    })
  })

  it('accepts the first of two writes from the same revision and rejects the stale second', async () => {
    await withRepo(async (repo, catalogue) => {
      const request = (body: AmendmentsManifest, ifMatch?: string) =>
        handleAmendmentsRequest({
          method: body ? 'PUT' : 'GET',
          suffix: '/demo',
          body: Buffer.from(JSON.stringify(body)),
          ifMatch,
          repoRoot: repo.root,
          loadCatalogue: () => Promise.resolve(catalogue),
        })
      const first = structuredClone(VALID_DOC)
      const second = structuredClone(VALID_DOC)
      second.amendments[0]!.title = 'Second tab'
      const base = amendmentsRevision(null)
      const [a, b] = await Promise.all([request(first, base), request(second, base)])
      expect([a.status, b.status]).toEqual([200, 409])
      expect(b.etag).toBe(a.etag)
      const onDisk = await readFile(path.join(repo.root, 'examples/demo-feature/prototypes/demo/amendments.json'), 'utf8')
      expect(JSON.parse(onDisk)).toEqual(first)
      expect((await request(second)).status).toBe(428)
      expect((await request(second, a.etag)).status).toBe(200)
    })
  })
})
