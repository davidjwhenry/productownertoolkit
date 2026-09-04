import { describe, expect, it } from 'vitest'
import { readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildHandoff, HANDOFF_MARKER_NAME, HOST_CSP } from './build'
import { makeFixtureRepo, type FixtureRepo } from '../testing/make-fixture-repo'

async function withRepo(fn: (repo: FixtureRepo) => Promise<void>): Promise<void> {
  const repo = await makeFixtureRepo()
  try {
    await fn(repo)
  } finally {
    await repo.cleanup()
  }
}

const PROTOTYPE_DIR = 'examples/demo-feature/prototypes/demo'

describe('buildHandoff', () => {
  it('refuses protected destinations without generating anything', async () => {
    await withRepo(async (repo) => {
      for (const target of ['.', '', 'examples', 'examples/demo-feature', PROTOTYPE_DIR]) {
        await expect(
          buildHandoff({ repoRoot: repo.root, prototypeId: 'demo', outputDir: target }),
        ).rejects.toThrow(/protected|refusing/i)
      }
    })
  })

  it('rejects unknown prototype ids', async () => {
    await withRepo(async (repo) => {
      await expect(buildHandoff({ repoRoot: repo.root, prototypeId: 'ghost' })).rejects.toThrow('Unknown prototype id')
    })
  })

  it('builds the full hand-off tree with a marker and host CSP', async () => {
    await withRepo(async (repo) => {
      const directory = await buildHandoff({ repoRoot: repo.root, prototypeId: 'demo' })
      expect(directory).toBe(path.join(await realpath(repo.root), PROTOTYPE_DIR, 'handoff'))

      const entries = await readdir(directory)
      for (const expected of ['index.html', 'prototype.json', HANDOFF_MARKER_NAME, 'source']) {
        expect(entries).toContain(expected)
      }
      const sourceTree = await readdir(path.join(directory, 'source'))
      expect(sourceTree.sort()).toEqual(['design-system', 'prd', 'variants'])

      const index = await readFile(path.join(directory, 'index.html'), 'utf8')
      expect(index).toContain(`http-equiv="Content-Security-Policy" content="${HOST_CSP}"`)
      expect(index).toContain('<script')

      const summary = JSON.parse(await readFile(path.join(directory, 'prototype.json'), 'utf8'))
      expect(summary.id).toBe('demo')
      expect(summary.variants[0].id).toBe('focused')

      const marker = JSON.parse(await readFile(path.join(directory, HANDOFF_MARKER_NAME), 'utf8'))
      expect(marker.generator).toBe('product-owner-toolkit/prototype-playground')
      expect(marker.prototypeId).toBe('demo')
      const paths = marker.files.map((f: { path: string }) => f.path)
      expect(paths).toEqual([...paths].sort())
      expect(paths).not.toContain(HANDOFF_MARKER_NAME)
      for (const file of marker.files) {
        const bytes = await readFile(path.join(directory, file.path))
        expect(bytes.length).toBeGreaterThan(0)
      }
    })
  })

  it('refuses a second run without --force and replaces exactly with --force', async () => {
    await withRepo(async (repo) => {
      const first = await buildHandoff({ repoRoot: repo.root, prototypeId: 'demo' })
      await expect(buildHandoff({ repoRoot: repo.root, prototypeId: 'demo' })).rejects.toThrow('not empty')

      // A user-added file blocks --force rather than being deleted.
      await writeFile(path.join(first, 'review-notes.md'), 'do not delete me')
      await expect(buildHandoff({ repoRoot: repo.root, prototypeId: 'demo', force: true })).rejects.toThrow('unlisted')
      await expect(stat(path.join(first, 'review-notes.md'))).resolves.toBeTruthy()

      // A modified generated file blocks --force too.
      const rm = (await import('node:fs/promises')).rm
      await rm(path.join(first, 'review-notes.md'))
      const indexPath = path.join(first, 'index.html')
      const pristine = await readFile(indexPath, 'utf8')
      await writeFile(indexPath, pristine + '<!-- edited -->')
      await expect(buildHandoff({ repoRoot: repo.root, prototypeId: 'demo', force: true })).rejects.toThrow('modified')

      // A pristine tool-owned hand-off replaces exactly: identical inputs, identical marker.
      await writeFile(indexPath, pristine)
      const original = await readFile(path.join(first, HANDOFF_MARKER_NAME), 'utf8')
      const second = await buildHandoff({ repoRoot: repo.root, prototypeId: 'demo', force: true })
      expect(second).toBe(first)
      expect(await readFile(path.join(second, HANDOFF_MARKER_NAME), 'utf8')).toBe(original)
    })
  })

  it('refuses a non-empty unmarked destination', async () => {
    await withRepo(async (repo) => {
      const target = path.join(repo.root, 'handoff-target')
      await (await import('node:fs/promises')).mkdir(target, { recursive: true })
      await writeFile(path.join(target, 'keep.txt'), 'user content')
      await expect(buildHandoff({ repoRoot: repo.root, prototypeId: 'demo', outputDir: 'handoff-target' })).rejects.toThrow('not empty')
      await expect(buildHandoff({ repoRoot: repo.root, prototypeId: 'demo', outputDir: 'handoff-target', force: true })).rejects.toThrow('marker')
      expect(await readFile(path.join(target, 'keep.txt'), 'utf8')).toBe('user content')
    })
  })
})
