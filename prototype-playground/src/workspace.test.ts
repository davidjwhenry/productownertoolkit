import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadRepositoryCatalogue } from './registry/catalogue'
import { makeInstalledLayout, type InstalledLayout } from './testing/make-installed-layout'
import { describeWorkspace, resolveWorkspace, WorkspaceError } from './workspace'

const noEnv = { env: {} }

let layout: InstalledLayout | null = null
const extraDirs: string[] = []

afterEach(async () => {
  await layout?.cleanup()
  layout = null
  for (const dir of extraDirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

async function installed(contentRoot?: string): Promise<InstalledLayout> {
  layout = await makeInstalledLayout(contentRoot)
  return layout
}

async function tempDir(): Promise<string> {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'prototype-playground-workspace-')))
  extraDirs.push(dir)
  return dir
}

function expectWorkspaceError(fn: () => unknown, message: RegExp): void {
  let caught: unknown
  try {
    fn()
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(WorkspaceError)
  expect((caught as Error).message).toMatch(message)
}

describe('resolveWorkspace', () => {
  it('uses the parent directory when there is no manifest', async () => {
    const root = await tempDir()
    const appRoot = path.join(root, 'prototype-playground')
    await mkdir(appRoot)
    const workspace = resolveWorkspace(appRoot, noEnv)
    expect(workspace).toEqual({ repoRoot: root, contentRoot: root, source: 'standalone' })
    expect(describeWorkspace(workspace)).toBe(`Content root: ${root} (standalone: parent of the playground)`)
  })

  it('reads contentRoot from the installation manifest', async () => {
    const { appRoot, repoRoot, contentRoot } = await installed()
    const workspace = resolveWorkspace(appRoot, noEnv)
    expect(workspace).toEqual({ repoRoot, contentRoot, source: 'manifest' })
    expect(describeWorkspace(workspace)).toContain('.product-owner-toolkit/installation.json')
  })

  it('accepts a nested content root and "." for the repository root', async () => {
    const { appRoot, repoRoot, writeManifest } = await installed('docs/product')
    expect(resolveWorkspace(appRoot, noEnv).contentRoot).toBe(path.join(repoRoot, 'docs', 'product'))
    await writeManifest({ schemaVersion: 1, contentRoot: '.' })
    expect(resolveWorkspace(appRoot, noEnv).contentRoot).toBe(repoRoot)
  })

  it('prefers the option, then the environment variable, then the manifest', async () => {
    const { appRoot } = await installed()
    const optionRoot = await tempDir()
    const envRoot = await tempDir()
    const env = { PROTOTYPE_PLAYGROUND_ROOT: envRoot }
    expect(resolveWorkspace(appRoot, { repoRoot: optionRoot, env })).toEqual({ repoRoot: optionRoot, contentRoot: optionRoot, source: 'option' })
    expect(resolveWorkspace(appRoot, { env })).toEqual({ repoRoot: envRoot, contentRoot: envRoot, source: 'override' })
    expect(resolveWorkspace(appRoot, noEnv).source).toBe('manifest')
  })

  it('rejects a manifest that is not valid JSON', async () => {
    const { appRoot, writeManifest } = await installed()
    await writeManifest('{ "schemaVersion": 1,')
    expectWorkspaceError(() => resolveWorkspace(appRoot, noEnv), /not valid JSON: .*installation\.json/)
  })

  it.each([
    ['missing', { contentRoot: 'product' }],
    ['a string', { schemaVersion: '1', contentRoot: 'product' }],
    ['newer', { schemaVersion: 2, contentRoot: 'product' }],
  ])('rejects a schemaVersion that is %s', async (_label, manifest) => {
    const { appRoot, writeManifest } = await installed()
    await writeManifest(manifest)
    expectWorkspaceError(() => resolveWorkspace(appRoot, noEnv), /Unsupported installation manifest version/)
  })

  it.each([
    ['missing', undefined, /no contentRoot string/],
    ['not a string', 42, /no contentRoot string/],
    ['empty', '', /no contentRoot string/],
    ['absolute', '/etc', /must be a relative path/],
    ['a Windows absolute path', 'C:/product', /must be a relative path/],
    ['a parent traversal', 'product/../../elsewhere', /must be a relative path/],
    ['a leading parent segment', '../product', /must be a relative path/],
    ['backslash-separated', 'docs\\product', /must be a relative path/],
  ])('rejects a contentRoot that is %s', async (_label, contentRoot, message) => {
    const { appRoot, writeManifest } = await installed()
    await writeManifest({ schemaVersion: 1, contentRoot })
    expectWorkspaceError(() => resolveWorkspace(appRoot, noEnv), message)
  })

  it('rejects a contentRoot symlink that points outside the repository', async () => {
    const { appRoot, repoRoot, writeManifest } = await installed()
    const outside = await tempDir()
    await symlink(outside, path.join(repoRoot, 'escape'))
    await writeManifest({ schemaVersion: 1, contentRoot: 'escape' })
    expectWorkspaceError(() => resolveWorkspace(appRoot, noEnv), /resolves outside the repository/)
  })

  it('points at doctor when the content root does not exist', async () => {
    const { appRoot, writeManifest } = await installed()
    await writeManifest({ schemaVersion: 1, contentRoot: 'missing' })
    expectWorkspaceError(() => resolveWorkspace(appRoot, noEnv), /does not exist\. Run `npx productownertoolkit doctor`/)
  })
})

describe('installed layout', () => {
  it('loads the catalogue from the manifest content root', async () => {
    const { appRoot } = await installed()
    const workspace = resolveWorkspace(appRoot, noEnv)
    const catalogue = await loadRepositoryCatalogue(workspace.contentRoot, { includeExamples: true })
    expect(catalogue.totals.errors).toBe(0)
    expect(catalogue.activeProfile).not.toBeNull()
    expect(catalogue.records.map((record) => [record.id, record.origin])).toEqual([['demo', 'example']])
  })
})
