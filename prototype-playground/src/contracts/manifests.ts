/**
 * TypeScript mirrors of the repository manifest JSON documents validated by
 * the schemas in `prototype-playground/schemas/`. Schemas are the source of
 * truth; field names here must match them exactly.
 */

export type DesignSourceKind = 'pen' | 'css' | 'dtcg' | 'markdown' | 'figma'

export type DesignSourceRole = 'tokens' | 'components' | 'assets' | 'guidance'

export type LocalDesignSource = {
  id: string
  kind: Exclude<DesignSourceKind, 'figma'>
  roles: DesignSourceRole[]
  required: boolean
  /** Repository-root-relative POSIX path. */
  path: string
  /** Lowercase hexadecimal SHA-256 of the raw source bytes. */
  sha256: string
}

export type FigmaDesignSource = {
  id: string
  kind: 'figma'
  roles: DesignSourceRole[]
  required: boolean
  /** HTTPS Figma file or node URI. */
  uri: string
  /** Recorded source/version key from the last extraction. */
  sourceKey: string
}

export type DesignSource = LocalDesignSource | FigmaDesignSource

export type DesignProfileManifest = {
  schemaVersion: 1
  id: string
  version: string
  name: string
  sources: DesignSource[]
  themes: Array<{ id: string; label: string }>
  defaultTheme: string
  /** Version-relative paths inside the containing `vNNN/` directory. */
  runtimeCss: string
  componentCatalogue: string
  assetCatalogue: string
  guidance?: string[]
}

export type ComponentsManifest = {
  schemaVersion: 1
  components: Array<{
    id: string
    name: string
    variants: string[]
    sourceIds: string[]
    usage?: string
  }>
}

export type AssetKind = 'image' | 'icon' | 'font'

export type AssetsManifest = {
  schemaVersion: 1
  assets: Array<{
    id: string
    kind: AssetKind
    /** Version-relative path inside the containing `vNNN/` directory. */
    path: string
    mediaType: string
    sourceIds: string[]
    fontFamily?: string
    fallbacks?: string[]
  }>
}

export type PrototypeManifestVariant = {
  id: string
  label: string
  hypothesis: string
  tradeOffs: string[]
  /** Repository-root-relative POSIX path to the declarative HTML entry. */
  entry: string
}

export type PrototypeManifest = {
  schemaVersion: 1
  id: string
  title: string
  summary: string
  revision: number
  source: {
    /** Repository-root-relative POSIX path to the feature-local PRD. */
    prd: string
    requirementIds: string[]
  }
  designSystem: {
    id: string
    version: string
    fingerprint: `sha256:${string}`
  }
  brief: {
    primaryUser: string
    job: string
    journey: string
    decision: string
  }
  variants: PrototypeManifestVariant[]
  surfaces: Array<'desktop' | 'ios'>
  scenarios: Array<{
    id: string
    label: string
    description: string
    requirementIds: string[]
  }>
  defaults: {
    variant: string
    surface: 'desktop' | 'ios'
    scenario: string
    theme: string
  }
  prototypeOnly: string[]
  companions?: Array<{
    kind: string
    /** Repository-root-relative POSIX path. */
    path: string
  }>
}

export type HandoffMarkerManifest = {
  schemaVersion: 1
  generator: 'product-owner-toolkit/prototype-playground'
  prototypeId: string
  /** Sorted repository-relative generated file paths with their SHA-256 digests. */
  files: Array<{ path: string; sha256: string }>
}
