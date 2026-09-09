/**
 * Repository catalogue runtime. Discovers prototype manifests via the
 * four fixed glob patterns, validates every manifest, entry, and pinned
 * design profile, and returns valid records with lazy `loadVariant`
 * functions plus bounded diagnostics. Invalid prototypes are excluded in
 * every mode so one bad prototype cannot break the catalogue; strict
 * consumers fail on `totals.errors`.
 */
import { glob } from 'tinyglobby'
import type {
  AmendmentsManifest,
  Amendment,
  CatalogueResult,
  DesignNotesManifest,
  Diagnostic,
  PrdMap,
  PrototypeManifest,
  PrototypeRecord,
  PrototypeSummary,
  ResolvedDesignProfile,
  SurfaceId,
} from '../contracts'
import { MAX_JSON_BYTES, MAX_PRD_BYTES, MAX_SURFACED_DIAGNOSTICS, MAX_VARIANT_HTML_BYTES } from '../validation/limits'
import { parsePrdMap } from '../validation/prd-map'
import { PathError, PathResolver } from '../validation/paths'
import { validateManifest } from '../validation/schemas'
import { loadActiveDesignProfile, loadDesignProfileVersion } from '../validation/profile'
import { validateHtmlEntry } from '../validation/html-entry'

export type CatalogueOptions = {
  includeExamples?: boolean
  strict?: boolean
  selectedPrototypeId?: string
}

const MANIFEST_GLOBS = [
  'requirements/platform-requirements/*/prototypes/*/prototype.json',
  'requirements/customer-functional-requirements/*/prototypes/*/prototype.json',
  'requirements/internal-functional-requirements/*/prototypes/*/prototype.json',
  'examples/*/prototypes/*/prototype.json',
] as const

type Classification = 'platform' | 'customer' | 'internal'

type DiscoveredManifest = {
  relPath: string
  origin: 'requirement' | 'example'
  classification: Classification | null
  feature: string
  featureDir: string
  prototypeDir: string
  prototypeDirName: string
}

const CLASSIFICATION_ROOTS: Record<string, Classification> = {
  'requirements/platform-requirements': 'platform',
  'requirements/customer-functional-requirements': 'customer',
  'requirements/internal-functional-requirements': 'internal',
}

/** Derive origin, classification, and feature from the validated path. */
export function classifyManifestPath(relPath: string): DiscoveredManifest | null {
  const segments = relPath.split('/')
  for (const [root, classification] of Object.entries(CLASSIFICATION_ROOTS)) {
    if (relPath.startsWith(`${root}/`) && segments.length === 6 && segments[5] === 'prototype.json') {
      return {
        relPath,
        origin: 'requirement',
        classification,
        feature: segments[2] ?? '',
        featureDir: segments.slice(0, 3).join('/'),
        prototypeDir: segments.slice(0, 5).join('/'),
        prototypeDirName: segments[4] ?? '',
      }
    }
  }
  if (relPath.startsWith('examples/') && segments.length === 5 && segments[4] === 'prototype.json') {
    return {
      relPath,
      origin: 'example',
      classification: null,
      feature: segments[1] ?? '',
      featureDir: segments.slice(0, 2).join('/'),
      prototypeDir: segments.slice(0, 4).join('/'),
      prototypeDirName: segments[3] ?? '',
    }
  }
  return null
}

function error(path: string, code: string, message: string): Diagnostic {
  return { severity: 'error', code, path, message }
}

function warning(path: string, code: string, message: string): Diagnostic {
  return { severity: 'warning', code, path, message }
}

/**
 * Load the full repository catalogue. `includeExamples` controls record
 * presentation only: examples are always scanned so their diagnostics
 * remain available. `selectedPrototypeId` restricts record discovery to
 * one prototype (hand-off builds).
 */
export async function loadRepositoryCatalogue(
  repoRoot: string,
  options: CatalogueOptions = {},
): Promise<CatalogueResult> {
  const { includeExamples = true, selectedPrototypeId } = options
  const resolver = new PathResolver(repoRoot)
  const diagnostics: Diagnostic[] = []
  const profiles: Record<string, ResolvedDesignProfile> = {}
  const profileCache = new Map<string, { resolved: ResolvedDesignProfile | null; diagnostics: Diagnostic[] }>()

  const loadProfile = async (version: string) => {
    const cached = profileCache.get(version)
    if (cached) return cached
    const loaded = await loadDesignProfileVersion(resolver, version)
    if (loaded.resolved) profiles[`${loaded.resolved.id}@${loaded.resolved.version}`] = loaded.resolved
    profileCache.set(version, loaded)
    return loaded
  }

  const active = await loadActiveDesignProfile(resolver)
  diagnostics.push(...active.diagnostics)
  if (active.resolved) {
    profiles[`${active.resolved.id}@${active.resolved.version}`] = active.resolved
  }

  const discovered: DiscoveredManifest[] = []
  const paths = await glob([...MANIFEST_GLOBS], {
    cwd: resolver.root,
    followSymbolicLinks: false,
    absolute: false,
    dot: false,
  })
  for (const relPath of paths.sort()) {
    const derived = classifyManifestPath(relPath)
    if (!derived) {
      diagnostics.push(error(relPath, 'PROTOTYPE_SCHEMA_INVALID', 'Manifest was discovered outside the declared layout'))
      continue
    }
    if (selectedPrototypeId !== undefined && derived.prototypeDirName !== selectedPrototypeId) continue
    discovered.push(derived)
  }

  const records: Array<{ derived: DiscoveredManifest; record: PrototypeRecord }> = []
  const idCounts = new Map<string, number>()

  for (const derived of discovered) {
    const loaded = await loadOneManifest(resolver, derived, loadProfile, active.resolved)
    diagnostics.push(...loaded.diagnostics)
    if (loaded.record) {
      idCounts.set(loaded.record.id, (idCounts.get(loaded.record.id) ?? 0) + 1)
      records.push({ derived, record: loaded.record })
    }
  }

  // Duplicate prototype IDs invalidate every duplicate.
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const entry = records[index]
    if (!entry) continue
    if ((idCounts.get(entry.record.id) ?? 0) > 1) {
      diagnostics.push(error(entry.derived.relPath, 'PROTOTYPE_ID_DUPLICATE', `Prototype id "${entry.record.id}" is declared more than once; every duplicate is excluded`))
      records.splice(index, 1)
    }
  }

  records.sort((a, b) => {
    if (a.derived.origin !== b.derived.origin) return a.derived.origin === 'requirement' ? -1 : 1
    if (a.derived.feature !== b.derived.feature) return a.derived.feature < b.derived.feature ? -1 : 1
    return a.record.title < b.record.title ? -1 : a.record.title > b.record.title ? 1 : 0
  })

  const visibleRecords = records
    .filter((entry) => includeExamples || entry.derived.origin === 'requirement')
    .map((entry) => entry.record)

  const totals = {
    errors: diagnostics.filter((d) => d.severity === 'error').length,
    warnings: diagnostics.filter((d) => d.severity === 'warning').length,
  }

  return {
    activeProfile: active.resolved,
    profiles,
    records: visibleRecords,
    diagnostics: diagnostics.slice(0, MAX_SURFACED_DIAGNOSTICS),
    totals,
  }
}

type OneManifestResult = {
  record: PrototypeRecord | null
  diagnostics: Diagnostic[]
}

async function loadOneManifest(
  resolver: PathResolver,
  derived: DiscoveredManifest,
  loadProfile: (version: string) => Promise<{ resolved: ResolvedDesignProfile | null; diagnostics: Diagnostic[] }>,
  activeProfile: ResolvedDesignProfile | null,
): Promise<OneManifestResult> {
  const diagnostics: Diagnostic[] = []
  const { relPath } = derived

  let manifest: PrototypeManifest
  try {
    const file = await resolver.readFileChecked(relPath, MAX_JSON_BYTES)
    let parsed: unknown
    try {
      parsed = JSON.parse(file.bytes.toString('utf8'))
    } catch {
      diagnostics.push(error(relPath, 'PROTOTYPE_SCHEMA_INVALID', 'Manifest is not valid JSON'))
      return { record: null, diagnostics }
    }
    const schemaError = validateManifest('prototype', parsed)
    if (schemaError) {
      diagnostics.push(error(relPath, 'PROTOTYPE_SCHEMA_INVALID', schemaError))
      return { record: null, diagnostics }
    }
    manifest = parsed as PrototypeManifest
  } catch (e) {
    diagnostics.push(error(relPath, (e as PathError).code, (e as PathError).message))
    return { record: null, diagnostics }
  }

  // Path-derived identity must agree with the manifest.
  if (manifest.id !== derived.prototypeDirName) {
    diagnostics.push(error(relPath, 'PROTOTYPE_SCHEMA_INVALID', `Manifest id "${manifest.id}" does not match its directory "${derived.prototypeDirName}"`))
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(derived.feature)) {
    diagnostics.push(error(relPath, 'PROTOTYPE_SCHEMA_INVALID', `Feature directory "${derived.feature}" is not kebab-case`))
  }

  // Feature-local PRD: existence and authority only.
  if (!manifest.source.prd.endsWith('.md')) {
    diagnostics.push(error(manifest.source.prd, 'PROTOTYPE_SCHEMA_INVALID', 'PRD path must reference a Markdown file'))
  }
  try {
    await resolver.checkFile({ kind: 'feature-prd', featureDir: derived.featureDir }, manifest.source.prd)
  } catch (e) {
    diagnostics.push(error(manifest.source.prd, (e as PathError).code, (e as PathError).message))
  }

  // Pinned design profile.
  const pinned = manifest.designSystem
  const profile = await loadProfile(pinned.version)
  diagnostics.push(...profile.diagnostics)
  if (profile.resolved) {
    if (profile.resolved.id !== pinned.id) {
      diagnostics.push(error(relPath, 'PROTOTYPE_SCHEMA_INVALID', `Pinned design profile id "${pinned.id}" does not match version ${pinned.version} (found "${profile.resolved.id}")`))
    }
    if (profile.resolved.fingerprint !== pinned.fingerprint) {
      diagnostics.push(error(relPath, 'PROFILE_FINGERPRINT_MISMATCH', `Pinned fingerprint ${pinned.fingerprint} does not match version ${pinned.version} (recomputed ${profile.resolved.fingerprint})`))
    }
    if (!profile.resolved.themes.some((theme) => theme.id === manifest.defaults.theme)) {
      diagnostics.push(error(relPath, 'PROTOTYPE_SCHEMA_INVALID', `Default theme "${manifest.defaults.theme}" is not declared by profile ${pinned.id}@${pinned.version}`))
    }
  } else {
    diagnostics.push(error(`design-system/profiles/${pinned.version}`, 'PROFILE_SCHEMA_INVALID', `Pinned design profile version "${pinned.version}" is invalid; see its diagnostics`))
  }

  // Defaults resolve to declared entities.
  if (!manifest.variants.some((variant) => variant.id === manifest.defaults.variant)) {
    diagnostics.push(error(relPath, 'PROTOTYPE_SCHEMA_INVALID', `Default variant "${manifest.defaults.variant}" is not declared`))
  }
  if (!manifest.surfaces.includes(manifest.defaults.surface as SurfaceId)) {
    diagnostics.push(error(relPath, 'PROTOTYPE_SCHEMA_INVALID', `Default surface "${manifest.defaults.surface}" is not declared`))
  }
  if (!manifest.scenarios.some((scenario) => scenario.id === manifest.defaults.scenario)) {
    diagnostics.push(error(relPath, 'PROTOTYPE_SCHEMA_INVALID', `Default scenario "${manifest.defaults.scenario}" is not declared`))
  }

  const declaredScenarioIds = manifest.scenarios.map((scenario) => scenario.id)

  // Variants: authorised entry paths and declarative HTML validation.
  const entryBytes = new Map<string, Promise<string>>()
  type EntrySurfaces = { screens: Set<string>; controlNames: Set<string>; validationTargets: Set<string> }
  const entrySurfaces = new Map<string, EntrySurfaces>()
  for (const variant of manifest.variants) {
    const basename = variant.entry.split('/').pop()
    if (basename !== `${variant.id}.html`) {
      diagnostics.push(error(variant.entry, 'PROTOTYPE_SCHEMA_INVALID', `Variant "${variant.id}" entry must be named "variants/${variant.id}.html" inside its prototype directory`))
      continue
    }
    try {
      const file = await resolver.resolveFile({ kind: 'prototype-variants', prototypeDir: derived.prototypeDir }, variant.entry, MAX_VARIANT_HTML_BYTES)
      const html = file.bytes.toString('utf8')
      const report = validateHtmlEntry(html, declaredScenarioIds)
      for (const check of report.checks) {
        diagnostics.push(error(variant.entry, 'ENTRY_NOT_SELF_CONTAINED', `${check.where}: ${check.message}`))
      }
      entrySurfaces.set(variant.id, {
        screens: new Set(report.screens),
        controlNames: new Set(report.controlNames),
        validationTargets: new Set(report.validationTargets),
      })
      entryBytes.set(variant.id, Promise.resolve(html))
    } catch (e) {
      diagnostics.push(error(variant.entry, (e as PathError).code, (e as PathError).message))
    }
  }

  // Companions.
  for (const companion of manifest.companions ?? []) {
    try {
      await resolver.checkFile({ kind: 'prototype-companions', prototypeDir: derived.prototypeDir }, companion.path)
    } catch (e) {
      diagnostics.push(error(companion.path, (e as PathError).code, (e as PathError).message))
    }
  }

  // PRD section map: anchors and per-section requirement IDs.
  let prdMap: PrdMap = { url: null, sections: [] }
  try {
    const prdFile = await resolver.resolveFile({ kind: 'feature-prd', featureDir: derived.featureDir }, manifest.source.prd, MAX_PRD_BYTES)
    prdMap = parsePrdMap(prdFile.bytes.toString('utf8'))
  } catch (e) {
    diagnostics.push(error(manifest.source.prd, (e as PathError).code, (e as PathError).message))
  }
  const prdSections = new Map(prdMap.sections.map((section) => [section.section, section]))
  if (prdSections.size === 0) {
    diagnostics.push(warning(manifest.source.prd, 'PRD_SECTION_MAP_EMPTY', 'PRD declares no numbered headings; § references are not resolved'))
  }

  const knownRequirementIds = new Set([
    ...manifest.source.requirementIds,
    ...manifest.scenarios.flatMap((scenario) => scenario.requirementIds),
  ])

  // Screen declarations must mirror each entry's screen graph exactly.
  for (const variant of manifest.variants) {
    const surfaces = entrySurfaces.get(variant.id)
    if (!variant.screens || !surfaces) continue
    const declared = new Set<string>()
    const seenKeys = new Set<string>()
    const seenOrders = new Set<string>()
    for (const screen of variant.screens) {
      const where = `${variant.entry}#screens/${screen.id}`
      if (!declaredScenarioIds.includes(screen.scenarioId)) {
        diagnostics.push(error(where, 'PROTOTYPE_SCHEMA_INVALID', `Screen "${screen.id}" references undeclared scenario "${screen.scenarioId}"`))
      }
      const key = `${screen.scenarioId}/${screen.id}`
      if (seenKeys.has(key)) {
        diagnostics.push(error(where, 'PROTOTYPE_SCHEMA_INVALID', `Screen "${screen.id}" is declared more than once for scenario "${screen.scenarioId}"`))
      }
      seenKeys.add(key)
      const orderKey = `${screen.scenarioId}/${screen.order}`
      if (seenOrders.has(orderKey)) {
        diagnostics.push(error(where, 'PROTOTYPE_SCHEMA_INVALID', `Order ${screen.order} is used more than once in scenario "${screen.scenarioId}"`))
      }
      seenOrders.add(orderKey)
      for (const ref of screen.prdRefs) {
        if (prdSections.size > 0 && !prdSections.has(ref.section)) {
          diagnostics.push(error(where, 'PRD_SECTION_UNRESOLVED', `PRD section "§${ref.section}" does not match any numbered heading in ${manifest.source.prd}`))
        }
        for (const requirementId of ref.requirementIds) {
          if (!knownRequirementIds.has(requirementId)) {
            diagnostics.push(error(where, 'SCREEN_REF_UNKNOWN', `Requirement "${requirementId}" is not declared by the manifest or its scenarios`))
          }
        }
      }
      if (screen.fixture) {
        const fixtureControls = [...Object.keys(screen.fixture.values ?? {}), ...Object.keys(screen.fixture.checked ?? {})]
        for (const name of fixtureControls) {
          if (!surfaces.controlNames.has(name)) {
            diagnostics.push(error(where, 'FIXTURE_CONTROL_UNKNOWN', `Fixture references control "${name}", which is not a control name in ${variant.entry}`))
          }
        }
        for (const name of Object.keys(screen.fixture.validation ?? {})) {
          if (!surfaces.validationTargets.has(name)) {
            diagnostics.push(error(where, 'FIXTURE_VALIDATION_TARGET_UNKNOWN', `Fixture references validation target "${name}", which has no data-prototype-validation-for element in ${variant.entry}`))
          }
        }
      }
      declared.add(screen.id)
    }
    for (const screenId of surfaces.screens) {
      if (!declared.has(screenId)) {
        diagnostics.push(error(variant.entry, 'SCREEN_UNDECLARED', `Entry screen "${screenId}" is not declared in the manifest screens of variant "${variant.id}"`))
      }
    }
    for (const screenId of declared) {
      if (!surfaces.screens.has(screenId)) {
        diagnostics.push(error(`${variant.entry}#screens/${screenId}`, 'SCREEN_NOT_IN_ENTRY', `Declared screen "${screenId}" does not exist in ${variant.entry}`))
      }
    }
  }

  // Design notes companion: verbatim anchored PRD passages.
  const designNotes: PrototypeSummary['designNotes'] = []
  const notesCompanions = (manifest.companions ?? []).filter((companion) => companion.kind === 'design-notes')
  if (notesCompanions.length > 1) {
    diagnostics.push(warning(notesCompanions[1]?.path ?? relPath, 'DESIGN_NOTES_DUPLICATE', 'Multiple design-notes companions declared; the first wins'))
  }
  const notesCompanion = notesCompanions[0]
  if (notesCompanion) {
    try {
      const file = await resolver.resolveFile({ kind: 'prototype-companions', prototypeDir: derived.prototypeDir }, notesCompanion.path, MAX_JSON_BYTES)
      const parsed: unknown = JSON.parse(file.bytes.toString('utf8'))
      const schemaError = validateManifest('design-notes', parsed)
      if (schemaError) {
        diagnostics.push(warning(notesCompanion.path, 'DESIGN_NOTES_INVALID', schemaError))
      } else {
        for (const note of (parsed as DesignNotesManifest).notes) {
          if (prdSections.size > 0 && !prdSections.has(note.section)) {
            diagnostics.push(warning(notesCompanion.path, 'NOTE_SECTION_UNRESOLVED', `Design note "${note.id}" references §${note.section}, which is not a numbered heading in the PRD`))
            continue
          }
          const unknown = note.requirementIds.filter((requirementId) => !knownRequirementIds.has(requirementId))
          if (unknown.length > 0) {
            diagnostics.push(warning(notesCompanion.path, 'NOTE_REF_UNKNOWN', `Design note "${note.id}" references undeclared requirements: ${unknown.join(', ')}`))
          }
          designNotes.push(note)
        }
      }
    } catch (e) {
      diagnostics.push(warning(notesCompanion.path, 'DESIGN_NOTES_INVALID', (e as Error).message))
    }
  }

  // Amendments: writeable review state beside the manifest. Absence is normal.
  const amendments: Amendment[] = []
  const amendmentsPath = `${derived.prototypeDir}/amendments.json`
  const allScreenIds = new Set<string>()
  for (const variant of manifest.variants) {
    for (const screen of variant.screens ?? []) allScreenIds.add(screen.id)
  }
  try {
    const file = await resolver.resolveFile({ kind: 'prototype-amendments', prototypeDir: derived.prototypeDir }, amendmentsPath, MAX_JSON_BYTES)
    const parsed: unknown = JSON.parse(file.bytes.toString('utf8'))
    const schemaError = validateManifest('amendments', parsed)
    if (schemaError) {
      diagnostics.push(warning(amendmentsPath, 'AMENDMENTS_INVALID', schemaError))
    } else {
      for (const amendment of (parsed as AmendmentsManifest).amendments) {
        if (!allScreenIds.has(amendment.screenId)) {
          diagnostics.push(warning(amendmentsPath, 'AMENDMENT_SCREEN_UNKNOWN', `Amendment "${amendment.id}" references screen "${amendment.screenId}", which no variant declares`))
          continue
        }
        if (amendment.requirementId !== null && !knownRequirementIds.has(amendment.requirementId)) {
          diagnostics.push(warning(amendmentsPath, 'AMENDMENT_REF_UNKNOWN', `Amendment "${amendment.id}" references undeclared requirement "${amendment.requirementId}"`))
          continue
        }
        amendments.push(amendment)
      }
    }
  } catch (e) {
    if ((e as PathError).code !== 'SOURCE_NOT_FOUND') {
      diagnostics.push(warning(amendmentsPath, 'AMENDMENTS_INVALID', (e as Error).message))
    }
  }

  if (diagnostics.some((d) => d.severity === 'error')) {
    return { record: null, diagnostics }
  }

  const summary: PrototypeSummary = {
    origin: derived.origin,
    classification: derived.classification,
    feature: derived.feature,
    manifestPath: relPath,
    id: manifest.id,
    title: manifest.title,
    summary: manifest.summary,
    revision: manifest.revision,
    source: manifest.source,
    brief: manifest.brief,
    variants: manifest.variants,
    surfaces: manifest.surfaces,
    scenarios: manifest.scenarios,
    defaults: manifest.defaults,
    designSystem: {
      id: pinned.id,
      version: pinned.version,
      fingerprint: pinned.fingerprint,
      currentness: activeProfile && activeProfile.version === pinned.version ? 'active' : 'older',
    },
    companions: manifest.companions ?? [],
    prototypeOnly: manifest.prototypeOnly,
    prdMap,
    designNotes,
    amendments,
  }

  const record: PrototypeRecord = {
    ...summary,
    loadVariant(variantId: string): Promise<string> {
      const cached = entryBytes.get(variantId)
      if (cached) return cached
      const variant = manifest.variants.find((v) => v.id === variantId)
      if (!variant) return Promise.reject(new Error(`Unknown variant "${variantId}" for prototype "${manifest.id}"`))
      const promise = resolver
        .resolveFile({ kind: 'prototype-variants', prototypeDir: derived.prototypeDir }, variant.entry, MAX_VARIANT_HTML_BYTES)
        .then((file) => file.bytes.toString('utf8'))
      entryBytes.set(variantId, promise)
      return promise
    },
  }

  return { record, diagnostics }
}
