/**
 * Deterministic offline hand-off builder. Runs strict validation for the
 * selected prototype, requires its pinned profile fingerprint to match
 * the immutable version, builds the single-file host through Vite in
 * `handoff` mode, copies inspectable source alongside, and replaces the
 * destination only through the verified marker protocol.
 */
import { createHash } from 'node:crypto'
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import type { HandoffMarkerManifest } from '../contracts'
import { loadRepositoryCatalogue } from '../registry/catalogue'
import prototypeRegistryPlugin from '../registry/vite-plugin'
import { PathError, PathResolver } from '../validation/paths'

export const HANDOFF_MARKER_NAME = '.prototype-playground-handoff.json'

export const HOST_CSP =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; object-src 'none'; frame-src 'self'; worker-src 'none'; base-uri 'none'; form-action 'none'"

export type BuildHandoffOptions = {
  repoRoot: string
  prototypeId: string
  outputDir?: string
  force?: boolean
}

export type BuildHandoffResult = {
  directory: string
  files: number
}

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function digest(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) out.push(...(await listFiles(path.join(dir, entry.name), rel)))
    else out.push(rel)
  }
  return out.sort()
}

/** Destinations that must never be written to or replaced. */
function protectedPaths(repoRoot: string, featureDir: string, prototypeDir: string): string[] {
  return [path.parse(repoRoot).root, (process.env.HOME ?? ''), repoRoot, appRoot, path.resolve(repoRoot, featureDir), path.resolve(repoRoot, prototypeDir)].filter((p) => p !== '')
}

function assertSafeDestination(destination: string, protectedList: string[]): void {
  for (const guarded of protectedList) {
    if (destination === guarded) {
      throw new Error(`Refusing to use protected destination: ${guarded}`)
    }
    if (guarded.startsWith(destination + path.sep)) {
      throw new Error(`Refusing to use a destination that contains protected path: ${guarded}`)
    }
  }
}

async function assertRegularDir(target: string): Promise<boolean> {
  try {
    const stats = await lstat(target)
    if (stats.isSymbolicLink()) throw new Error(`Destination is a symlink: ${target}`)
    return stats.isDirectory()
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw e
  }
}

async function verifyExistingHandoff(destination: string, prototypeId: string): Promise<void> {
  const markerPath = path.join(destination, HANDOFF_MARKER_NAME)
  let marker: HandoffMarkerManifest
  try {
    marker = JSON.parse(await readFile(markerPath, 'utf8')) as HandoffMarkerManifest
  } catch {
    throw new Error('Existing destination has no tool-owned hand-off marker; refusing to touch it')
  }
  if (marker.generator !== 'product-owner-toolkit/prototype-playground' || marker.prototypeId !== prototypeId) {
    throw new Error(`Existing hand-off marker does not belong to prototype "${prototypeId}"; refusing replacement`)
  }
  const actual = new Set(await listFiles(destination))
  for (const listed of marker.files) {
    if (!actual.delete(listed.path)) {
      throw new Error(`Hand-off lists "${listed.path}", which is missing; refusing replacement`)
    }
  }
  actual.delete(HANDOFF_MARKER_NAME)
  if (actual.size > 0) {
    throw new Error(`Hand-off destination contains unlisted files (${[...actual].slice(0, 3).join(', ')}…); refusing replacement`)
  }
  for (const listed of marker.files) {
    const bytes = await readFile(path.join(destination, listed.path))
    if (digest(bytes) !== listed.sha256) {
      throw new Error(`Hand-off file "${listed.path}" has been modified; refusing replacement`)
    }
  }
}

/**
 * Build one offline hand-off. Returns the written directory. Throws with a
 * specific diagnostic on forbidden content, unsafe destinations, or marker
 * verification failures; never deletes anything it did not generate.
 */
export async function buildHandoff(options: BuildHandoffOptions): Promise<string> {
  const { repoRoot, prototypeId, outputDir, force = false } = options
  const canonicalRepo = await realpath(repoRoot)

  // 1. Strict validation for exactly this prototype.
  const catalogue = await loadRepositoryCatalogue(canonicalRepo, { includeExamples: true, selectedPrototypeId: prototypeId })
  if (catalogue.totals.errors > 0) {
    const first = catalogue.diagnostics[0]
    throw new Error(`Strict validation failed (${catalogue.totals.errors} error(s)): ${first ? `${first.path}: ${first.message}` : 'unknown'}`)
  }
  const record = catalogue.records.find((r) => r.id === prototypeId)
  if (!record) throw new Error(`Unknown prototype id "${prototypeId}"`)
  const profile = catalogue.profiles[`${record.designSystem.id}@${record.designSystem.version}`]
  if (!profile || profile.fingerprint !== record.designSystem.fingerprint) {
    throw new Error('Pinned design profile fingerprint does not match its immutable version')
  }

  // 2. Destination authorisation.
  const prototypeDir = path.dirname(record.manifestPath)
  const featureDir = path.dirname(path.dirname(prototypeDir))
  const destination = path.resolve(canonicalRepo, outputDir ?? path.join(prototypeDir, 'handoff'))
  assertSafeDestination(destination, protectedPaths(canonicalRepo, featureDir, prototypeDir))
  const destinationParent = path.dirname(destination)
  await mkdir(destinationParent, { recursive: true })

  const exists = await assertRegularDir(destination)
  if (exists) {
    const entries = await readdir(destination)
    if (entries.length > 0 && !force) {
      throw new Error(`Destination exists and is not empty: ${destination}. Pass --force only to replace a verified tool-owned hand-off.`)
    }
    if (entries.length > 0 && force) {
      await verifyExistingHandoff(destination, prototypeId)
    }
  }

  // 3. Stage under the destination parent, never pointing Vite at the final destination.
  const staging = await mkdtemp(path.join(destinationParent, '.prototype-playground-stage-'))
  try {
    await runViteHandoff(staging, canonicalRepo, prototypeId)

    // 4. Inspectable source copies.
    const resolver = new PathResolver(canonicalRepo)
    const { loadVariant, ...summaryJson } = record
    void loadVariant
    await writeFile(path.join(staging, 'prototype.json'), `${JSON.stringify(summaryJson, null, 2)}\n`)
    const prdFile = await resolver.resolveFile({ kind: 'feature-prd', featureDir }, record.source.prd, 100 * 1024 * 1024)
    await mkdir(path.join(staging, 'source', 'prd'), { recursive: true })
    await writeFile(path.join(staging, 'source', 'prd', path.basename(record.source.prd)), prdFile.bytes)
    await mkdir(path.join(staging, 'source', 'design-system'), { recursive: true })
    await cp(path.join(canonicalRepo, path.dirname(profile.runtimeCssPath)), path.join(staging, 'source', 'design-system'), { recursive: true })
    await mkdir(path.join(staging, 'source', 'variants'), { recursive: true })
    for (const variant of record.variants) {
      const entry = await resolver.resolveFile({ kind: 'prototype-variants', prototypeDir }, variant.entry, 10 * 1024 * 1024)
      await writeFile(path.join(staging, 'source', 'variants', path.basename(variant.entry)), entry.bytes)
    }
    // Review companions: verbatim design notes and the amendments log.
    const extraChecks: Array<[string, string]> = []
    const notesCompanion = record.companions.find((companion) => companion.kind === 'design-notes')
    if (notesCompanion) {
      const notesFile = await resolver.resolveFile({ kind: 'prototype-companions', prototypeDir }, notesCompanion.path, 10 * 1024 * 1024)
      await writeFile(path.join(staging, 'source', 'design-notes.json'), notesFile.bytes)
      extraChecks.push([notesCompanion.path, path.join('source', 'design-notes.json')])
    }
    const amendmentsRel = `${prototypeDir.replaceAll(path.sep, '/')}/amendments.json`
    const amendmentsFile = await resolver
      .resolveFile({ kind: 'prototype-amendments', prototypeDir }, amendmentsRel, 10 * 1024 * 1024)
      .catch((error: unknown) => {
        if ((error as PathError).code === 'SOURCE_NOT_FOUND') return null
        throw error
      })
    if (amendmentsFile) {
      await writeFile(path.join(staging, 'source', 'amendments.json'), amendmentsFile.bytes)
      extraChecks.push([amendmentsRel, path.join('source', 'amendments.json')])
    }
    // 5. Marker: every generated file except the marker itself, sorted.
    const generated = await listFiles(staging)
    const marker: HandoffMarkerManifest = {
      schemaVersion: 1,
      generator: 'product-owner-toolkit/prototype-playground',
      prototypeId,
      files: await Promise.all(
        generated.map(async (rel) => ({ path: rel, sha256: digest(await readFile(path.join(staging, rel))) })),
      ),
    }
    marker.files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    await writeFile(path.join(staging, HANDOFF_MARKER_NAME), `${JSON.stringify(marker, null, 2)}\n`)

    // 6. Snapshot re-check: staged bytes still match the repository sources.
    await recheckSources(resolver, record, staging, extraChecks)

    // 7. Verified replacement, re-checked immediately before commit.
    const destinationStats = await lstat(destination).catch(() => null)
    if (destinationStats && (destinationStats.isSymbolicLink() || !destinationStats.isDirectory())) {
      throw new Error(`Destination is not a plain directory: ${destination}`)
    }
    await rm(destination, { recursive: true, force: true })
    await rename(staging, destination)
    return destination
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
}

async function recheckSources(
  resolver: PathResolver,
  record: { manifestPath: string; source: { prd: string }; variants: Array<{ entry: string }> },
  staging: string,
  extraChecks: Array<[string, string]> = [],
): Promise<void> {
  const checks: Array<[string, string]> = [
    [record.source.prd, path.join('source', 'prd', path.basename(record.source.prd))],
    ...record.variants.map((variant) => [variant.entry, path.join('source', 'variants', path.basename(variant.entry))] as [string, string]),
    ...extraChecks,
  ]
  for (const [sourceRel, stagedRel] of checks) {
    const source = await resolver.digestFile(sourceRel)
    const staged = digest(await readFile(path.join(staging, stagedRel)))
    if (source !== staged) throw new Error(`Source drifted during hand-off generation: ${sourceRel}`)
  }
}

async function runViteHandoff(outDir: string, repoRoot: string, prototypeId: string): Promise<void> {
  await build({
    root: appRoot,
    mode: 'handoff',
    configFile: false,
    base: './',
    plugins: [react(), prototypeRegistryPlugin({ repoRoot, selectedPrototypeId: prototypeId, eager: true }), viteSingleFile()],
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: false,
      target: 'es2022',
    },
    logLevel: 'warn',
  })
  // Host CSP as the first policy statement of the generated document.
  const indexPath = path.join(outDir, 'index.html')
  let html = await readFile(indexPath, 'utf8')
  if (!html.includes('http-equiv="Content-Security-Policy"')) {
    html = html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${HOST_CSP}">`)
    await writeFile(indexPath, html)
  }
}
