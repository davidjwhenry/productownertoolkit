/**
 * Workspace resolution: decide which directory holds `requirements/`,
 * `examples/`, and `design-system/` (the content root). In a standalone
 * clone that is the playground's parent directory. In an installed
 * repository, `.product-owner-toolkit/installation.json` beside the
 * playground names it through `contentRoot`. A present but unusable
 * manifest is an error, never a silent fallback to standalone mode.
 *
 * Node-only.
 */
import { readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'

export const INSTALLATION_MANIFEST = '.product-owner-toolkit/installation.json'

export type WorkspaceSource = 'option' | 'override' | 'manifest' | 'standalone'

export type Workspace = {
  /** Repository root: the playground's parent, or the content root when given explicitly. */
  repoRoot: string
  /** Directory holding `requirements/`, `examples/`, and `design-system/`. */
  contentRoot: string
  source: WorkspaceSource
}

export type ResolveWorkspaceOptions = {
  /** Explicit content root (plugin option, tests, hand-off). */
  repoRoot?: string
  env?: Record<string, string | undefined>
}

export class WorkspaceError extends Error {
  override name = 'WorkspaceError'
}

export function resolveWorkspace(appRoot: string, options: ResolveWorkspaceOptions = {}): Workspace {
  if (options.repoRoot) {
    const root = path.resolve(options.repoRoot)
    return { repoRoot: root, contentRoot: root, source: 'option' }
  }
  const override = (options.env ?? process.env).PROTOTYPE_PLAYGROUND_ROOT
  if (override) {
    const root = path.resolve(override)
    return { repoRoot: root, contentRoot: root, source: 'override' }
  }

  const repoRoot = realpathSync(path.resolve(appRoot, '..'))
  const manifestPath = path.join(repoRoot, ...INSTALLATION_MANIFEST.split('/'))
  let text: string
  try {
    text = readFileSync(manifestPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { repoRoot, contentRoot: repoRoot, source: 'standalone' }
    }
    throw error
  }

  return { repoRoot, contentRoot: contentRootFromManifest(repoRoot, manifestPath, text), source: 'manifest' }
}

function contentRootFromManifest(repoRoot: string, manifestPath: string, text: string): string {
  let manifest: unknown
  try {
    manifest = JSON.parse(text)
  } catch {
    throw new WorkspaceError(`Installation manifest is not valid JSON: ${manifestPath}`)
  }
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
    throw new WorkspaceError(`Installation manifest must be a JSON object: ${manifestPath}`)
  }
  const { schemaVersion, contentRoot } = manifest as Record<string, unknown>
  if (schemaVersion !== 1) {
    throw new WorkspaceError(`Unsupported installation manifest version ${JSON.stringify(schemaVersion ?? null)} in ${manifestPath}; expected 1`)
  }
  if (typeof contentRoot !== 'string' || contentRoot === '') {
    throw new WorkspaceError(`Installation manifest has no contentRoot string: ${manifestPath}`)
  }
  if (
    contentRoot.includes('\\') ||
    path.posix.isAbsolute(contentRoot) ||
    path.win32.isAbsolute(contentRoot) ||
    contentRoot.split('/').includes('..')
  ) {
    throw new WorkspaceError(`Installation manifest contentRoot must be a relative path inside the repository using "/" separators: ${JSON.stringify(contentRoot)} in ${manifestPath}`)
  }

  let resolved: string
  try {
    resolved = realpathSync(path.resolve(repoRoot, contentRoot))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new WorkspaceError(`Content root "${contentRoot}" named in ${manifestPath} does not exist. Run \`npx productownertoolkit doctor\` to diagnose the installation.`)
    }
    throw error
  }
  const rel = path.relative(repoRoot, resolved)
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new WorkspaceError(`Content root "${contentRoot}" resolves outside the repository (${resolved}): ${manifestPath}`)
  }
  return resolved
}

/** One line for diagnostics: which content root is in use, and why. */
export function describeWorkspace(workspace: Workspace): string {
  const reason = {
    option: 'explicit option',
    override: 'PROTOTYPE_PLAYGROUND_ROOT',
    manifest: INSTALLATION_MANIFEST,
    standalone: 'standalone: parent of the playground',
  }[workspace.source]
  return `Content root: ${workspace.contentRoot} (${reason})`
}
