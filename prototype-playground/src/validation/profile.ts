/**
 * Design-profile runtime validation: the `ACTIVE` pointer grammar, the
 * immutable version fingerprint, and per-version manifest/catalogue
 * checks. Runtime validation never fetches Figma and never rebuilds
 * source material; a missing or hash-drifted raw source is a `SOURCE_DRIFT`
 * warning because the immutable generated profile remains usable.
 */
import { createHash } from 'node:crypto'
import type { AssetsManifest, ComponentsManifest, DesignProfileManifest, Diagnostic, ResolvedDesignProfile } from '../contracts'
import {
  MAX_ASSET_BYTES,
  MAX_GUIDANCE_FILE_BYTES,
  MAX_JSON_BYTES,
  MAX_PROFILE_VERSION_FILES,
  MAX_PROFILE_VERSION_TOTAL_BYTES,
  MAX_RAW_SOURCE_BYTES,
  MAX_RAW_SOURCE_TOTAL_BYTES,
  MAX_RUNTIME_CSS_BYTES,
} from './limits'
import { PathError, type PathResolver } from './paths'
import { validateManifest } from './schemas'

export const ACTIVE_POINTER_PATH = 'design-system/profiles/ACTIVE'

export type ActivePointer = {
  version: string
  fingerprint: `sha256:${string}`
}

const VERSION_PATTERN = /^v[0-9]{3}$/
const FINGERPRINT_LINE = /^sha256:[0-9a-f]{64}$/

export type ProfileLoadResult = {
  resolved: ResolvedDesignProfile | null
  diagnostics: Diagnostic[]
}

function error(path: string, code: string, message: string): Diagnostic {
  return { severity: 'error', code, path, message }
}

function warning(path: string, code: string, message: string): Diagnostic {
  return { severity: 'warning', code, path, message }
}

/** Parse the exact two-line `ACTIVE` grammar: `vNNN\nsha256:<64 hex>\n`. */
export function parseActivePointer(content: string): ActivePointer | null {
  if (!content.endsWith('\n')) return null
  const lines = content.slice(0, -1).split('\n')
  if (lines.length !== 2) return null
  if (!VERSION_PATTERN.test(lines[0] ?? '')) return null
  if (!FINGERPRINT_LINE.test(lines[1] ?? '')) return null
  return { version: lines[0] as string, fingerprint: lines[1] as `sha256:${string}` }
}

/**
 * Compute a profile-version fingerprint: every regular file under the
 * version directory, sorted lexically by POSIX relative path, fed to
 * SHA-256 as `path + NUL + raw bytes + NUL` per file. Raw bytes enter
 * the hash through bounded streams so nothing is buffered.
 */
export async function computeProfileFingerprint(
  resolver: PathResolver,
  version: string,
): Promise<`sha256:${string}`> {
  const files = await resolver.listProfileVersionFiles(version)
  files.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0))
  const hash = createHash('sha256')
  for (const file of files) {
    const relative = file.relPath.slice(`design-system/profiles/${version}/`.length)
    hash.update(relative)
    hash.update('\0')
    await resolver.hashFileInto(file.relPath, hash)
    hash.update('\0')
  }
  return `sha256:${hash.digest('hex')}`
}

/** Load and validate one immutable profile version directory. */
export async function loadDesignProfileVersion(
  resolver: PathResolver,
  version: string,
): Promise<ProfileLoadResult> {
  const diagnostics: Diagnostic[] = []
  const dirRel = `design-system/profiles/${version}`
  const versionPrefix = `${dirRel}/`
  const member = (name: string): string => `${versionPrefix}${name}`

  if (!VERSION_PATTERN.test(version)) {
    diagnostics.push(error(dirRel, 'PROFILE_POINTER_INVALID', `Profile version directory "${version}" does not match vNNN`))
    return { resolved: null, diagnostics }
  }

  let files: Awaited<ReturnType<PathResolver['listProfileVersionFiles']>>
  try {
    files = await resolver.listProfileVersionFiles(version)
  } catch (e) {
    const err = e as PathError
    diagnostics.push(error(dirRel, err.code, err.message))
    return { resolved: null, diagnostics }
  }
  if (files.length > MAX_PROFILE_VERSION_FILES) {
    diagnostics.push(error(dirRel, 'PROFILE_TOO_LARGE', `Profile version has ${files.length} files; limit is ${MAX_PROFILE_VERSION_FILES}`))
  }
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  if (totalBytes > MAX_PROFILE_VERSION_TOTAL_BYTES) {
    diagnostics.push(error(dirRel, 'PROFILE_TOO_LARGE', `Profile version totals ${totalBytes} bytes; limit is ${MAX_PROFILE_VERSION_TOTAL_BYTES}`))
  }
  const memberNames = new Set(files.map((file) => file.relPath))

  // profile.json
  const profileRel = member('profile.json')
  let profile: DesignProfileManifest
  try {
    const file = await resolver.resolveFile({ kind: 'profile-version', version }, profileRel, MAX_JSON_BYTES)
    let parsed: unknown
    try {
      parsed = JSON.parse(file.bytes.toString('utf8'))
    } catch {
      diagnostics.push(error(profileRel, 'PROFILE_SCHEMA_INVALID', 'profile.json is not valid JSON'))
      return { resolved: null, diagnostics }
    }
    const schemaError = validateManifest('design-profile', parsed)
    if (schemaError) {
      diagnostics.push(error(profileRel, 'PROFILE_SCHEMA_INVALID', schemaError))
      return { resolved: null, diagnostics }
    }
    profile = parsed as DesignProfileManifest
  } catch (e) {
    const err = e as PathError
    diagnostics.push(error(profileRel, err.code, err.message))
    return { resolved: null, diagnostics }
  }

  if (profile.version !== version) {
    diagnostics.push(error(profileRel, 'PROFILE_POINTER_INVALID', `profile.json version "${profile.version}" does not match containing directory "${version}"`))
  }

  // Duplicate source IDs and default-theme agreement.
  const sourceIds = new Set<string>()
  for (const source of profile.sources) {
    if (sourceIds.has(source.id)) {
      diagnostics.push(error(profileRel, 'PROFILE_SCHEMA_INVALID', `Duplicate source id "${source.id}"`))
    }
    sourceIds.add(source.id)
  }
  if (!profile.themes.some((theme) => theme.id === profile.defaultTheme)) {
    diagnostics.push(error(profileRel, 'PROFILE_SCHEMA_INVALID', `defaultTheme "${profile.defaultTheme}" is not a declared theme`))
  }

  // Catalogue contents.
  const componentCatalogueRel = member(profile.componentCatalogue)
  const assetCatalogueRel = member(profile.assetCatalogue)
  try {
    const componentsText = (
      await resolver.resolveFile({ kind: 'profile-version', version }, componentCatalogueRel, MAX_JSON_BYTES)
    ).bytes.toString('utf8')
    const componentsError = validateManifest('components', JSON.parse(componentsText))
    if (componentsError) {
      diagnostics.push(error(componentCatalogueRel, 'PROFILE_SCHEMA_INVALID', componentsError))
    } else {
      const seen = new Set<string>()
      for (const component of (JSON.parse(componentsText) as ComponentsManifest).components) {
        if (seen.has(component.id)) {
          diagnostics.push(error(componentCatalogueRel, 'PROFILE_SCHEMA_INVALID', `Duplicate component id "${component.id}"`))
        }
        seen.add(component.id)
      }
    }
  } catch (e) {
    diagnostics.push(error(componentCatalogueRel, (e as PathError).code, (e as PathError).message))
  }
  try {
    const assetsText = (
      await resolver.resolveFile({ kind: 'profile-version', version }, assetCatalogueRel, MAX_JSON_BYTES)
    ).bytes.toString('utf8')
    const assetsError = validateManifest('assets', JSON.parse(assetsText))
    if (assetsError) {
      diagnostics.push(error(assetCatalogueRel, 'PROFILE_SCHEMA_INVALID', assetsError))
    } else {
      const seen = new Set<string>()
      for (const asset of (JSON.parse(assetsText) as AssetsManifest).assets) {
        if (seen.has(asset.id)) {
          diagnostics.push(error(assetCatalogueRel, 'PROFILE_SCHEMA_INVALID', `Duplicate asset id "${asset.id}"`))
        }
        seen.add(asset.id)
        if (!memberNames.has(member(asset.path))) {
          diagnostics.push(error(member(asset.path), 'SOURCE_NOT_FOUND', `Asset file "${asset.path}" is missing from the profile version`))
        }
      }
    }
  } catch (e) {
    diagnostics.push(error(assetCatalogueRel, (e as PathError).code, (e as PathError).message))
  }

  // Runtime and guidance files must exist; every member respects its size cap.
  const runtimeCssRel = member(profile.runtimeCss)
  if (!memberNames.has(runtimeCssRel)) {
    diagnostics.push(error(runtimeCssRel, 'SOURCE_NOT_FOUND', `runtimeCss "${profile.runtimeCss}" is missing from the profile version`))
  }
  const guidanceSet = new Set((profile.guidance ?? []).map((g) => member(g)))
  for (const guidance of profile.guidance ?? []) {
    if (!memberNames.has(member(guidance))) {
      diagnostics.push(error(member(guidance), 'SOURCE_NOT_FOUND', `Guidance file "${guidance}" is missing from the profile version`))
    }
  }
  for (const file of files) {
    const name = file.relPath.slice(versionPrefix.length)
    let cap: number
    if (name === profile.runtimeCss) {
      cap = MAX_RUNTIME_CSS_BYTES
    } else if (name === 'profile.json' || name === profile.componentCatalogue || name === profile.assetCatalogue) {
      cap = MAX_JSON_BYTES
    } else if (guidanceSet.has(file.relPath)) {
      cap = MAX_GUIDANCE_FILE_BYTES
    } else {
      cap = MAX_ASSET_BYTES
    }
    if (file.size > cap) {
      diagnostics.push(error(file.relPath, 'PROFILE_TOO_LARGE', `Profile member "${name}" is ${file.size} bytes; limit is ${cap}`))
    }
  }

  // Raw local sources: existence and hash drift are warnings.
  let rawTotal = 0
  for (const source of profile.sources) {
    if (source.kind === 'figma') continue
    const local = source as { id: string; path: string; sha256: string }
    try {
      const raw = await resolver.resolveFile({ kind: 'design-system' }, local.path, MAX_RAW_SOURCE_BYTES)
      rawTotal += raw.size
      if (raw.sha256 !== local.sha256) {
        diagnostics.push(warning(local.path, 'SOURCE_DRIFT', `Source "${local.id}" drifted: recorded ${local.sha256.slice(0, 12)}…, found ${raw.sha256.slice(0, 12)}…`))
      }
    } catch (e) {
      const err = e as PathError
      diagnostics.push(warning(local.path, 'SOURCE_DRIFT', `Source "${local.id}" could not be read (${err.code}): ${err.message}`))
    }
  }
  if (rawTotal > MAX_RAW_SOURCE_TOTAL_BYTES) {
    diagnostics.push(error(dirRel, 'FILE_TOO_LARGE', `Local raw sources total ${rawTotal} bytes; limit is ${MAX_RAW_SOURCE_TOTAL_BYTES}`))
  }

  const fingerprint = await computeProfileFingerprint(resolver, version)
  if (diagnostics.some((d) => d.severity === 'error')) {
    return { resolved: null, diagnostics }
  }
  return {
    resolved: {
      id: profile.id,
      version: profile.version,
      name: profile.name,
      fingerprint,
      defaultTheme: profile.defaultTheme,
      themes: profile.themes,
      runtimeCssPath: runtimeCssRel,
      componentCataloguePath: componentCatalogueRel,
      assetCataloguePath: assetCatalogueRel,
      ...(profile.deviceChrome ? { deviceChrome: profile.deviceChrome } : {}),
      ...(profile.layout ? { layout: profile.layout } : {}),
    },
    diagnostics,
  }
}

export type ActiveProfileResult = {
  pointer: ActivePointer | null
  resolved: ResolvedDesignProfile | null
  diagnostics: Diagnostic[]
}

/** Load the active profile: pointer grammar, version agreement, fingerprint. */
export async function loadActiveDesignProfile(resolver: PathResolver): Promise<ActiveProfileResult> {
  const diagnostics: Diagnostic[] = []
  let pointerContent: string
  try {
    const file = await resolver.resolveFile({ kind: 'profile-active' }, ACTIVE_POINTER_PATH, 1024)
    pointerContent = file.bytes.toString('utf8')
  } catch (e) {
    diagnostics.push(error(ACTIVE_POINTER_PATH, (e as PathError).code, (e as PathError).message))
    return { pointer: null, resolved: null, diagnostics }
  }
  const pointer = parseActivePointer(pointerContent)
  if (!pointer) {
    diagnostics.push(error(ACTIVE_POINTER_PATH, 'PROFILE_POINTER_INVALID', 'ACTIVE must be exactly two LF-terminated lines: vNNN, then sha256:<64 lowercase hex>'))
    return { pointer: null, resolved: null, diagnostics }
  }
  const loaded = await loadDesignProfileVersion(resolver, pointer.version)
  diagnostics.push(...loaded.diagnostics)
  if (!loaded.resolved) {
    return { pointer, resolved: null, diagnostics }
  }
  if (loaded.resolved.fingerprint !== pointer.fingerprint) {
    diagnostics.push(
      error(
        ACTIVE_POINTER_PATH,
        'PROFILE_FINGERPRINT_MISMATCH',
        `ACTIVE records ${pointer.fingerprint} but the version directory recomputes to ${loaded.resolved.fingerprint}`,
      ),
    )
    return { pointer, resolved: null, diagnostics }
  }
  return { pointer, resolved: loaded.resolved, diagnostics }
}
