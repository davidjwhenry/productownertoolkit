import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { checkAmendmentsDocument, handleAmendmentsRequest } from './amendments-api'
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
    ]
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
})

describe('handleAmendmentsRequest', () => {
  it('round-trips a valid PUT through disk and serves it on GET', async () => {
    await withRepo(async (repo, catalogue) => {
      const put = await handleAmendmentsRequest({
        method: 'PUT',
        suffix: '/demo',
        body: Buffer.from(JSON.stringify(VALID_DOC)),
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
})
