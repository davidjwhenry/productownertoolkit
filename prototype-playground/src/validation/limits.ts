/**
 * Repository-wide byte/count bounds enforced by the validation runtime.
 * Schemas encode per-field caps (IDs, labels, free text); these constants
 * cover file- and aggregate-level limits the schemas cannot express.
 */

/** Maximum size of any schema or catalogue JSON file. */
export const MAX_JSON_BYTES = 1024 * 1024

/** Maximum size of `tokens.css` or any other profile runtime CSS file. */
export const MAX_RUNTIME_CSS_BYTES = 1024 * 1024

/** Maximum size of a declarative variant HTML entry. */
export const MAX_VARIANT_HTML_BYTES = 10 * 1024 * 1024

/** Maximum size of an individual guidance file inside a profile version. */
export const MAX_GUIDANCE_FILE_BYTES = 5 * 1024 * 1024

/** Maximum size of an individual generated asset inside a profile version. */
export const MAX_ASSET_BYTES = 25 * 1024 * 1024

/** Maximum number of regular files in one profile version directory. */
export const MAX_PROFILE_VERSION_FILES = 1000

/** Maximum total bytes across one profile version directory. */
export const MAX_PROFILE_VERSION_TOTAL_BYTES = 100 * 1024 * 1024

/** Maximum size of one local raw design source file. */
export const MAX_RAW_SOURCE_BYTES = 100 * 1024 * 1024

/** Maximum total bytes across all local raw design sources of a profile. */
export const MAX_RAW_SOURCE_TOTAL_BYTES = 250 * 1024 * 1024

/** Maximum total decoded HTML held by a selected two-up comparison. */
export const MAX_COMPARISON_HTML_BYTES = 20 * 1024 * 1024

/** Maximum number of diagnostics surfaced to consumers; totals stay exact. */
export const MAX_SURFACED_DIAGNOSTICS = 200
