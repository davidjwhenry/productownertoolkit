/**
 * Shared contracts for the prototype playground.
 *
 * These types are the TypeScript mirror of the JSON Schemas in
 * `prototype-playground/schemas/` and the cross-module boundary consumed by
 * the registry, preview, shell, and hand-off code. Schemas are the source of
 * truth; field names here must match them exactly.
 */

import type { Amendment, DeviceChrome, ProfileLayout, ScreenDeclaration, ScreenFixture } from './manifests'

export type SurfaceId = 'desktop' | 'ios'

export type DiagnosticSeverity = 'warning' | 'error'

export type ProfileCurrentness = 'active' | 'older'

export type ScreenRuntimeDeclaration = {
  id: string
  fixture?: ScreenFixture
}
export type PrototypeContext = {
  protocolVersion: 2
  channelId: string
  prototypeId: string
  variantId: string
  surfaceId: SurfaceId
  scenarioId: string
  themeId: string
  /** Addressable screens of this variant/scenario, with optional jump fixtures. */
  screens: ScreenRuntimeDeclaration[]
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
  /** Frame geometry override for both surfaces; absent = contract presets. */
  deviceChrome?: DeviceChrome
  /** Shell column rhythm the profile records as canonical. */
  layout?: ProfileLayout
}

/** One resolvable numbered heading of the source PRD. */
export type PrdSectionRef = {
  section: string
  heading: string
  /** Heading anchor valid against the hosted copy when `url` is present. */
  anchor: string
  requirementIds: string[]
}

export type PrdMap = {
  /** Hosted copy URL from the PRD frontmatter, when present. */
  url: string | null
  sections: PrdSectionRef[]
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
  variants: Array<{
    id: string
    label: string
    hypothesis: string
    tradeOffs: string[]
    entry: string
    screens?: ScreenDeclaration[]
  }>
  surfaces: SurfaceId[]
  scenarios: Array<{ id: string; label: string; description: string; requirementIds: string[] }>
  defaults: { variant: string; surface: SurfaceId; scenario: string; theme: string }
  designSystem: { id: string; version: string; fingerprint: `sha256:${string}`; currentness: ProfileCurrentness }
  companions: Array<{ kind: string; path: string }>
  prototypeOnly: string[]
  /** Section map of the source PRD; `sections` is empty when it has no numbered headings. */
  prdMap: PrdMap
  /** Verbatim PRD passages from the `design-notes` companion; empty when absent or invalid. */
  designNotes: Array<{ id: string; section: string; label: string; quote: string; requirementIds: string[] }>
  /** Review amendments from `amendments.json`; empty when absent or invalid. */
  amendments: Amendment[]
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

export const PROTOTYPE_BRIDGE_PROTOCOL_VERSION = 2

export type PrototypeBridgeReadyMessage = {
  type: 'prototype:ready'
  protocolVersion: 2
  channelId: string
}

export type PrototypeBridgeScreenMessage = {
  type: 'prototype:screen'
  protocolVersion: 2
  channelId: string
  screenId: string
}

export type PrototypeBridgeErrorCode =
  | 'RUNTIME_INITIALISATION_FAILED'
  | 'INVALID_DECLARATIVE_TARGET'
  | 'UNEXPECTED_NAVIGATION'
  | 'UNRESOLVED_SCREEN_TARGET'

export type PrototypeBridgeErrorMessage = {
  type: 'prototype:error'
  protocolVersion: 2
  channelId: string
  code: PrototypeBridgeErrorCode
}

/** Parent-to-child navigation command; the child re-validates screen existence. */
export type PrototypeBridgeGotoMessage = {
  type: 'prototype:goto'
  protocolVersion: 2
  channelId: string
  screenId: string
}

export type PrototypeBridgeMessage =
  | PrototypeBridgeReadyMessage
  | PrototypeBridgeScreenMessage
  | PrototypeBridgeErrorMessage
