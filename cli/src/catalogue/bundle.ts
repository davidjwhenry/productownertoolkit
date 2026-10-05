/**
 * The catalogue and payload shipped with the CLI. The package root holds
 * `package.json`, `toolkit/catalogue.json`, and every catalogue `source`
 * path, so the same code reads a repository checkout and the assembled npm
 * package. The catalogue is schema-validated before release (`npm run check`
 * and package assembly); at run time it is only sanity-checked, which keeps
 * the CLI free of runtime dependencies.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isSafeRelativePath, isText, joinRelative, normalise } from '../fsx.ts'
import { matchesAny } from './glob.ts'
import { renderTokens } from './tokens.ts'
import type { Catalogue, CapabilityDefinition, RootValues } from './types.ts'

const IGNORED_NAMES = new Set(['.DS_Store', 'Thumbs.db'])

export interface Bundle {
  root: string
  version: string
  catalogue: Catalogue
  agentsBlockTemplate: string
}

/** This file is `cli/src/catalogue/` in a checkout and `cli/dist/catalogue/` in the package: three levels below the package root. */
export function defaultBundleRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
}

export class BundleError extends Error {}

export function loadBundle(root = defaultBundleRoot()): Bundle {
  const read = (rel: string) => {
    try {
      return fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8')
    } catch {
      throw new BundleError(`The toolkit package is incomplete: ${rel} is missing`)
    }
  }
  const pkg = JSON.parse(read('package.json')) as { version?: unknown }
  const catalogue = JSON.parse(read('toolkit/catalogue.json')) as Catalogue
  if (catalogue.schemaVersion !== 1 || !Array.isArray(catalogue.capabilities) || !Array.isArray(catalogue.agents)) {
    throw new BundleError('The toolkit package has an unsupported catalogue')
  }
  return {
    root,
    version: typeof pkg.version === 'string' ? pkg.version : '0.0.0',
    catalogue,
    agentsBlockTemplate: read('toolkit/support/agents-block.md'),
  }
}

export type Ownership = 'managed' | 'seed'

export interface DesiredFile {
  /** Install path relative to the target. */
  path: string
  ownership: Ownership
  capability: string
  /** Final bytes: tokens rendered and text normalised to LF. */
  contents: Buffer
  /** Set for files that belong to an installed skill. */
  skill?: string
}

export interface Selection {
  /** Skill folders to write, from `skillDirectoriesFor`. */
  skillDirectories: string[]
  capabilities: string[]
  roots: RootValues
}

/** Required capabilities plus the selected ones, in catalogue order. */
export function selectedCapabilities(catalogue: Catalogue, ids: string[]): CapabilityDefinition[] {
  return catalogue.capabilities.filter((c) => c.required || ids.includes(c.id))
}

function listSource(bundle: Bundle, source: string, prune: (rel: string) => boolean = () => false): string[] {
  const abs = path.join(bundle.root, ...source.split('/'))
  const stat = fs.lstatSync(abs, { throwIfNoEntry: false })
  if (!stat) throw new BundleError(`The toolkit package is incomplete: ${source} is missing`)
  if (stat.isSymbolicLink()) throw new BundleError(`The toolkit package contains a symlink: ${source}`)
  if (stat.isFile()) return ['']
  const out: string[] = []
  const visit = (dir: string, prefix: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORED_NAMES.has(entry.name)) continue
      const rel = joinRelative(prefix, entry.name)
      if (entry.isDirectory() && prune(rel)) continue
      if (entry.isDirectory()) visit(path.join(dir, entry.name), rel)
      else if (entry.isFile()) out.push(rel)
      else throw new BundleError(`The toolkit package contains a symlink or special file: ${source}/${rel}`)
    }
  }
  visit(abs, '')
  return out.sort()
}

function readSource(bundle: Bundle, source: string, rel: string): Buffer {
  return fs.readFileSync(path.join(bundle.root, ...joinRelative(source, rel).split('/')))
}

function render(bytes: Buffer, roots: RootValues): Buffer {
  const text = normalise(bytes)
  return isText(text) ? Buffer.from(renderTokens(text.toString('utf8'), roots)) : text
}

/**
 * Every file the selection installs, with its final contents. Skills are
 * written once per skill folder the selected agents need (CP.10, CP.13);
 * only skills have their path tokens rendered.
 */
export function desiredFiles(bundle: Bundle, selection: Selection): DesiredFile[] {
  const files: DesiredFile[] = []
  const directories = selection.skillDirectories
  const installPath = (pattern: string) => {
    const rel = renderTokens(pattern, selection.roots)
    if (!isSafeRelativePath(rel)) throw new BundleError(`The catalogue install path ${pattern} is unsafe`)
    return rel
  }

  for (const capability of selectedCapabilities(bundle.catalogue, selection.capabilities)) {
    for (const skill of capability.skills) {
      const source = `toolkit/skills/${skill}`
      for (const rel of listSource(bundle, source)) {
        const contents = render(readSource(bundle, source, rel), selection.roots)
        for (const dir of directories) {
          files.push({ path: joinRelative(dir, skill, rel), ownership: 'managed', capability: capability.id, contents, skill })
        }
      }
    }
    for (const [ownership, mappings] of [['managed', capability.managed], ['seed', capability.seed]] as const) {
      for (const { source, install } of mappings) {
        for (const rel of listSource(bundle, source)) {
          files.push({
            path: joinRelative(installPath(install), rel),
            ownership,
            capability: capability.id,
            contents: normalise(readSource(bundle, source, rel)),
          })
        }
      }
    }
    const runtime = capability.runtime
    if (runtime) {
      // Never descend into dependency or build output, which can be large.
      const prune = (dir: string) => matchesAny(`${dir}/-`, runtime.unmanaged)
      for (const packaged of listSource(bundle, runtime.source, prune)) {
        // npm drops `.gitignore` from tarballs, so packaging stores it as `_gitignore`.
        const rel = packaged === '_gitignore' ? '.gitignore' : packaged
        if (!matchesAny(rel, runtime.include)) continue
        if (matchesAny(rel, runtime.exclude) || matchesAny(rel, runtime.unmanaged)) continue
        files.push({
          path: joinRelative(installPath(runtime.install), rel),
          ownership: matchesAny(rel, runtime.seed ?? []) ? 'seed' : 'managed',
          capability: capability.id,
          contents: normalise(readSource(bundle, runtime.source, packaged)),
        })
      }
    }
  }
  return files
}
