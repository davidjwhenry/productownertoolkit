/**
 * Type declarations for the Vite virtual modules supplied by the registry
 * plugin (`src/registry/vite-plugin.ts`).
 *
 * `virtual:prototype-registry` default-exports the complete catalogue result,
 * including lazy `loadVariant` functions on every record. Variant payloads
 * are base64-encoded inside the generated module graph and decoded only
 * after module load.
 */
declare module 'virtual:prototype-registry' {
  import type { CatalogueResult } from './types'
  const catalogue: CatalogueResult
  export default catalogue
}

declare module 'virtual:prototype-variant/*' {
  const variantHtml: string
  export default variantHtml
}
