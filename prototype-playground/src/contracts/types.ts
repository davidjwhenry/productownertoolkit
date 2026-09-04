/**
 * Shared contracts for the prototype playground.
 *
 * These types are the TypeScript mirror of the JSON Schemas in
 * `prototype-playground/schemas/` and the cross-module boundary consumed by
 * the registry, preview, shell, and hand-off code. Schemas are the source of
 * truth; field names here must match them exactly.
 */

export type SurfaceId = 'desktop' | 'ios'

export type DiagnosticSeverity = 'warning' | 'error'

export type ProfileCurrentness = 'active' | 'older'

export type PrototypeContext = {
  protocolVersion: 1
  channelId: string
  prototypeId: string
  variantId: string
  surfaceId: SurfaceId
  scenarioId: string
  themeId: string
}

export type Diagnostic = {
  severity: DiagnosticSeverity
  code: string
  path: string
  message: string
}

export type ResolvedDesignProfile = {
  id: string
  version: string
  name: string
  fingerprint: `sha256:${string}`
  defaultTheme: string
  themes: Array<{ id: string; label: string }>
  runtimeCssPath: string
  componentCataloguePath: string
  assetCataloguePath: string
}

export type PrototypeSummary = {
  origin: 'requirement' | 'example'
  classification: 'platform' | 'customer' | 'internal' | null
  feature: string
  manifestPath: string
  id: string
  title: string
  summary: string
  revision: number
  source: { prd: string; requirementIds: string[] }
  brief: { primaryUser: string; job: string; journey: string; decision: string }
  variants: Array<{ id: string; label: string; hypothesis: string; tradeOffs: string[]; entry: string }>
  surfaces: SurfaceId[]
  scenarios: Array<{ id: string; label: string; description: string; requirementIds: string[] }>
  defaults: { variant: string; surface: SurfaceId; scenario: string; theme: string }
  designSystem: { id: string; version: string; fingerprint: `sha256:${string}`; currentness: ProfileCurrentness }
  companions: Array<{ kind: string; path: string }>
  prototypeOnly: string[]
}

export type PrototypeRecord = PrototypeSummary & {
  loadVariant(variantId: string): Promise<string>
}

export type CatalogueResult = {
  activeProfile: ResolvedDesignProfile | null
  profiles: Record<`${string}@${string}`, ResolvedDesignProfile>
  records: PrototypeRecord[]
  diagnostics: Diagnostic[]
  totals: { errors: number; warnings: number }
}

export const PROTOTYPE_BRIDGE_PROTOCOL_VERSION = 1

export type PrototypeBridgeReadyMessage = {
  type: 'prototype:ready'
  protocolVersion: 1
  channelId: string
}

export type PrototypeBridgeErrorCode =
  | 'RUNTIME_INITIALISATION_FAILED'
  | 'INVALID_DECLARATIVE_TARGET'
  | 'UNEXPECTED_NAVIGATION'

export type PrototypeBridgeErrorMessage = {
  type: 'prototype:error'
  protocolVersion: 1
  channelId: string
  code: PrototypeBridgeErrorCode
}

export type PrototypeBridgeMessage = PrototypeBridgeReadyMessage | PrototypeBridgeErrorMessage
