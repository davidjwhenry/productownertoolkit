/**
 * `.product-owner-toolkit/installation.json`, schema version 1 (UP.1–UP.5,
 * UP.11). The CLI owns every field except `configuration`, which
 * `bootstrap-context` may set and which the CLI carries forward unchanged.
 * The manifest never lists itself in `managedFiles`.
 */
import { isSafeRelativePath } from './fsx.ts'

export const MANIFEST_DIRECTORY = '.product-owner-toolkit'
export const MANIFEST_PATH = `${MANIFEST_DIRECTORY}/installation.json`
export const MANIFEST_SCHEMA_VERSION = 1

export interface Configuration {
  status: 'pending' | 'complete'
  completedAt: string | null
  [key: string]: unknown
}

export interface InstallationManifest {
  schemaVersion: 1
  toolkitVersion: string
  /** User-owned product work, relative to the repository root. */
  contentRoot: string
  /** Toolkit-managed guidance, relative to the repository root. */
  toolkitRoot: string
  /** The prototype playground runtime, when Prototyping is installed (CP.12). */
  playgroundRoot?: string
  agents: string[]
  skillDirectories: string[]
  capabilities: string[]
  /** Managed file path → LF-normalised checksum. */
  managedFiles: Record<string, string>
  /** The managed `AGENTS.md` block and the checksum of its rendered text, delimiters included. */
  managedBlock: { path: string; checksum: string }
  /** The `CLAUDE.md` that received the `@AGENTS.md` import, if the CLI added one. */
  claudeImport?: string
  installedAt: string
  updatedAt: string
  configuration: Configuration
}

export type ManifestRead =
  | { kind: 'valid'; manifest: InstallationManifest }
  | { kind: 'unsupported'; schemaVersion: unknown; message: string }
  | { kind: 'invalid'; message: string }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

/** Parse and validate manifest text. Newer or unknown schema versions are `unsupported`, never guessed at. */
export function parseManifest(text: string): ManifestRead {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { kind: 'invalid', message: `${MANIFEST_PATH} is not valid JSON` }
  }
  if (!isObject(data)) return { kind: 'invalid', message: `${MANIFEST_PATH} must be a JSON object` }
  if (data.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    const newer = typeof data.schemaVersion === 'number' && data.schemaVersion > MANIFEST_SCHEMA_VERSION
    return {
      kind: 'unsupported',
      schemaVersion: data.schemaVersion,
      message: newer
        ? `${MANIFEST_PATH} uses schema version ${data.schemaVersion}, which is newer than this CLI supports (${MANIFEST_SCHEMA_VERSION}). Run the latest version: npx productownertoolkit@latest`
        : `${MANIFEST_PATH} has schema version ${JSON.stringify(data.schemaVersion ?? null)}, which has no supported migration`,
    }
  }

  const problems: string[] = []
  const expect = (ok: boolean, field: string, rule: string) => {
    if (!ok) problems.push(`${field} ${rule}`)
  }
  const relative = (value: unknown) => typeof value === 'string' && (value === '.' || isSafeRelativePath(value))
  expect(typeof data.toolkitVersion === 'string' && data.toolkitVersion !== '', 'toolkitVersion', 'must be a non-empty string')
  expect(relative(data.contentRoot), 'contentRoot', 'must be a relative path inside the repository')
  expect(relative(data.toolkitRoot), 'toolkitRoot', 'must be a relative path inside the repository')
  expect(data.playgroundRoot === undefined || relative(data.playgroundRoot), 'playgroundRoot', 'must be a relative path inside the repository')
  expect(isStringArray(data.agents), 'agents', 'must be a list of agent ids')
  expect(isStringArray(data.skillDirectories) && data.skillDirectories.every(relative), 'skillDirectories', 'must be a list of relative paths')
  expect(isStringArray(data.capabilities), 'capabilities', 'must be a list of capability ids')
  expect(
    isObject(data.managedFiles) &&
      Object.entries(data.managedFiles).every(([key, value]) => isSafeRelativePath(key) && typeof value === 'string' && key !== MANIFEST_PATH),
    'managedFiles',
    'must map relative paths (other than the manifest itself) to checksums',
  )
  expect(
    isObject(data.managedBlock) && typeof data.managedBlock.path === 'string' && typeof data.managedBlock.checksum === 'string',
    'managedBlock',
    'must record the managed block path and checksum',
  )
  expect(data.claudeImport === undefined || relative(data.claudeImport), 'claudeImport', 'must be a relative path')
  expect(typeof data.installedAt === 'string', 'installedAt', 'must be a timestamp')
  expect(typeof data.updatedAt === 'string', 'updatedAt', 'must be a timestamp')
  const configuration = data.configuration
  expect(
    isObject(configuration) &&
      (configuration.status === 'pending' || configuration.status === 'complete') &&
      (configuration.completedAt === null || typeof configuration.completedAt === 'string'),
    'configuration',
    'must have status "pending" or "complete" and a completedAt timestamp or null',
  )
  if (problems.length) return { kind: 'invalid', message: `${MANIFEST_PATH} is invalid: ${problems.join('; ')}` }
  return { kind: 'valid', manifest: data as unknown as InstallationManifest }
}

/** Stable serialisation: fixed key order, sorted managed paths, LF, trailing newline. */
export function serialiseManifest(manifest: InstallationManifest): string {
  const managedFiles = Object.fromEntries(Object.entries(manifest.managedFiles).sort(([a], [b]) => (a < b ? -1 : 1)))
  const ordered = {
    schemaVersion: manifest.schemaVersion,
    toolkitVersion: manifest.toolkitVersion,
    contentRoot: manifest.contentRoot,
    toolkitRoot: manifest.toolkitRoot,
    ...(manifest.playgroundRoot === undefined ? {} : { playgroundRoot: manifest.playgroundRoot }),
    agents: manifest.agents,
    skillDirectories: manifest.skillDirectories,
    capabilities: manifest.capabilities,
    installedAt: manifest.installedAt,
    updatedAt: manifest.updatedAt,
    configuration: manifest.configuration,
    managedBlock: manifest.managedBlock,
    ...(manifest.claudeImport === undefined ? {} : { claudeImport: manifest.claudeImport }),
    managedFiles,
  }
  return `${JSON.stringify(ordered, null, 2)}\n`
}
