/**
 * Installed-layout fixture: `<tmp>/prototype-playground` as the app root,
 * `<tmp>/.product-owner-toolkit/installation.json`, and the fixture
 * repository's content moved under `<tmp>/<contentRoot>/`.
 */
import { mkdir, realpath, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { makeFixtureRepo, type FixtureRepo } from './make-fixture-repo'

export type InstalledLayout = {
  repoRoot: string
  appRoot: string
  contentRoot: string
  writeManifest: (manifest: unknown) => Promise<void>
  cleanup: () => Promise<void>
}

export async function makeInstalledLayout(contentRoot = 'product'): Promise<InstalledLayout> {
  const repo: FixtureRepo = await makeFixtureRepo()
  const repoRoot = await realpath(repo.root)
  const content = path.join(repoRoot, contentRoot)
  await mkdir(content, { recursive: true })
  for (const dir of ['design-system', 'examples']) {
    await rename(path.join(repoRoot, dir), path.join(content, dir))
  }
  const appRoot = path.join(repoRoot, 'prototype-playground')
  await mkdir(appRoot)
  const writeManifest = async (manifest: unknown): Promise<void> => {
    await mkdir(path.join(repoRoot, '.product-owner-toolkit'), { recursive: true })
    const text = typeof manifest === 'string' ? manifest : JSON.stringify(manifest, null, 2)
    await writeFile(path.join(repoRoot, '.product-owner-toolkit', 'installation.json'), text)
  }
  await writeManifest({ schemaVersion: 1, contentRoot })
  return { repoRoot, appRoot, contentRoot: content, writeManifest, cleanup: repo.cleanup }
}
