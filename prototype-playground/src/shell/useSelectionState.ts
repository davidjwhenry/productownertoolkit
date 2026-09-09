/**
 * Shareable selection state encoded solely in query parameters:
 * `prototype`, `variant`, `surface`, `scenario`, `theme`, optional
 * `screen`, optional `compare`, and optional `examples=1`. Browser
 * back/forward restores valid selections; unknown values fall back to
 * manifest defaults via `history.replaceState` and surface a warning
 * diagnostic instead of constructing paths from URL input.
 *
 * Variant switches keep the equivalent screen when the target variant
 * declares it (screen retention); scenario switches keep it only when
 * the screen is also declared for the new scenario.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { CatalogueResult, Diagnostic, PrototypeRecord, SurfaceId } from '../contracts'

export type Selection = {
  prototypeId: string
  variantId: string
  surfaceId: SurfaceId
  scenarioId: string
  themeId: string
  /** Addressable screen within the variant; `null` is the entry screen. */
  screenId: string | null
  compareVariantId: string | null
  showExamples: boolean
}

export type SelectionResolution = {
  selection: Selection
  record: PrototypeRecord | null
  /** Warnings for unknown query values that fell back to defaults. */
  warnings: Diagnostic[]
}

function readSnapshot(): string {
  return window.location.search
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}

function queryToRecord(query: string): Record<string, string> {
  const params = new URLSearchParams(query)
  const out: Record<string, string> = {}
  for (const key of ['prototype', 'variant', 'surface', 'scenario', 'theme', 'screen', 'compare', 'examples']) {
    const value = params.get(key)
    if (value !== null) out[key] = value
  }
  return out
}

/** Resolve the query parameters against the catalogue, falling back to defaults. */
export function resolveSelection(query: string, catalogue: CatalogueResult): SelectionResolution {
  const params = queryToRecord(query)
  const warnings: Diagnostic[] = []
  const warn = (message: string): void => {
    warnings.push({ severity: 'warning', code: 'SELECTION_FALLBACK', path: '(query parameters)', message })
  }

  const showExamples = params.examples === '1'
  const pool = catalogue.records.filter((record) => showExamples || record.origin === 'requirement')
  const requested = params.prototype
  const record =
    (requested !== undefined ? pool.find((candidate) => candidate.id === requested) : undefined) ??
    pool[0] ??
    null
  if (requested !== undefined && record !== null && record.id !== requested) {
    warn(`Unknown prototype "${requested}"; fell back to "${record.id}"`)
  }

  if (!record) {
    return {
      selection: {
        prototypeId: '',
        variantId: '',
        surfaceId: 'desktop',
        scenarioId: '',
        themeId: catalogue.activeProfile?.defaultTheme ?? 'light',
        screenId: null,
        compareVariantId: null,
        showExamples,
      },
      record: null,
      warnings,
    }
  }

  const variant = record.variants.find((v) => v.id === params.variant)
  if (params.variant !== undefined && !variant) warn(`Unknown variant "${params.variant}"; fell back to "${record.defaults.variant}"`)
  const surface = record.surfaces.find((s) => s === params.surface)
  if (params.surface !== undefined && !surface) warn(`Unknown surface "${params.surface}"; fell back to "${record.defaults.surface}"`)
  const scenario = record.scenarios.find((s) => s.id === params.scenario)
  if (params.scenario !== undefined && !scenario) warn(`Unknown scenario "${params.scenario}"; fell back to "${record.defaults.scenario}"`)
  const themes = catalogue.profiles[`${record.designSystem.id}@${record.designSystem.version}`]?.themes ?? []
  const theme = themes.find((t) => t.id === params.theme)?.id
  if (params.theme !== undefined && !theme) warn(`Unknown theme "${params.theme}"; fell back to "${record.defaults.theme}"`)

  const variantId = variant?.id ?? record.defaults.variant
  const compareRequested = params.compare
  const compare =
    compareRequested !== undefined && compareRequested !== variantId
      ? (record.variants.find((v) => v.id === compareRequested)?.id ?? null)
      : null
  if (compareRequested !== undefined && !compare && compareRequested !== variantId) {
    warn(`Unknown compare variant "${compareRequested}"; comparison disabled`)
  }

  const declaredScreen = variant?.screens?.find((screen) => screen.id === params.screen)?.id ?? null
  if (params.screen !== undefined && !declaredScreen) {
    warn(`Unknown screen "${params.screen}"; fell back to the variant's entry screen`)
  }

  return {
    selection: {
      prototypeId: record.id,
      variantId,
      surfaceId: surface ?? record.defaults.surface,
      scenarioId: scenario?.id ?? record.defaults.scenario,
      themeId: theme ?? record.defaults.theme,
      screenId: declaredScreen,
      compareVariantId: compare,
      showExamples,
    },
    record,
    warnings,
  }
}

export function selectionToQuery(selection: Selection): string {
  const params = new URLSearchParams()
  params.set('prototype', selection.prototypeId)
  params.set('variant', selection.variantId)
  params.set('surface', selection.surfaceId)
  params.set('scenario', selection.scenarioId)
  params.set('theme', selection.themeId)
  if (selection.screenId) params.set('screen', selection.screenId)
  if (selection.compareVariantId) params.set('compare', selection.compareVariantId)
  if (selection.showExamples) params.set('examples', '1')
  return `?${params.toString()}`
}

/** Keep the screen only when the target context still declares it. */
function retainedScreenId(record: PrototypeRecord | null, selection: Selection, next: Partial<Selection>): string | null {
  const screenId = next.screenId !== undefined ? next.screenId : selection.screenId
  if (screenId === null || !record) return screenId ?? null
  const variantId = next.variantId ?? selection.variantId
  const scenarioId = next.scenarioId ?? selection.scenarioId
  const variantSwitched = next.variantId !== undefined && next.variantId !== selection.variantId
  const scenarioSwitched = next.scenarioId !== undefined && next.scenarioId !== selection.scenarioId
  if (!variantSwitched && !scenarioSwitched) return screenId
  const target = record.variants.find((variant) => variant.id === variantId)
  const declarations = target?.screens?.filter((screen) => screen.id === screenId) ?? []
  if (declarations.length === 0) return null
  if (scenarioSwitched && !declarations.some((screen) => screen.scenarioId === scenarioId)) return null
  return screenId
}

export type SelectionUpdateOptions = {
  /** `push` adds a history entry (default); `replace` keeps the current one. */
  history?: 'push' | 'replace'
}

/** Query-parameter selection state with back/forward support. */
export function useSelectionState(catalogue: CatalogueResult): {
  resolution: SelectionResolution
  update: (next: Partial<Selection>, options?: SelectionUpdateOptions) => void
} {
  const query = useSyncExternalStore(subscribe, readSnapshot, () => '')
  const resolution = useMemo(() => resolveSelection(query, catalogue), [query, catalogue])
  const [stickyWarnings, setStickyWarnings] = useState<Diagnostic[]>([])

  const update = useCallback(
    (next: Partial<Selection>, options: SelectionUpdateOptions = {}) => {
      if (options.history !== 'replace') setStickyWarnings([])
      const merged: Selection = { ...resolution.selection, ...next }
      merged.screenId = retainedScreenId(resolution.record, resolution.selection, next)
      const target = selectionToQuery(merged)
      if (target !== window.location.search) {
        if (options.history === 'replace') {
          window.history.replaceState({}, '', target)
        } else {
          window.history.pushState({}, '', target)
        }
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
    },
    [resolution],
  )

  // Normalise unknown values in the address bar without extra history
  // entries, keeping the fallback warnings visible until the next
  // explicit selection change.
  const normalisedQuery = useMemo(() => selectionToQuery(resolution.selection), [resolution.selection])
  useEffect(() => {
    if (query !== normalisedQuery && query !== '') {
      setStickyWarnings(resolution.warnings)
      window.history.replaceState({}, '', normalisedQuery)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }, [query, normalisedQuery, resolution])

  const withWarnings = useMemo(
    () => ({ ...resolution, warnings: resolution.warnings.length > 0 ? resolution.warnings : stickyWarnings }),
    [resolution, stickyWarnings],
  )

  return { resolution: withWarnings, update }
}

/** The exact revision-brief template with the current selection substituted. */
export function buildRevisionBrief(selection: Selection, manifestPath: string): string {
  const screen = selection.screenId ? `, screen \`${selection.screenId}\`` : ''
  return `Revise prototype \`${selection.prototypeId}\` at \`${manifestPath}\`.
Current view: variant \`${selection.variantId}\`, surface \`${selection.surfaceId}\`, scenario \`${selection.scenarioId}\`${screen}, theme \`${selection.themeId}\`.
Feedback: [describe the requested change]
Preserve the other declared variants and scenarios, keep the pinned design profile unless explicitly changing it, and run \`npm run validate\` from \`prototype-playground/\`.`
}
