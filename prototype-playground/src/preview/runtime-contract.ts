/**
 * Frozen declarative interaction contract shared by the registry validator
 * (`src/validation/html-entry.ts`), the sandbox runtime (`src/preview/`), and
 * the `prototype-builder` skill reference. Generated variant HTML contains no
 * executable JavaScript; behaviour is expressed only through the attributes
 * and value grammar defined here.
 *
 * This module is a shared boundary owned by the integration owner. Registry
 * and preview code consume it; they must not redefine or extend it.
 */

/** Matches an ID declared for a screen, region, form, control, theme, scenario, variant, or prototype. */
export const KEBAB_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const RUNTIME_ATTRIBUTE_PREFIX = 'data-prototype-'

/** Every `data-prototype-*` attribute the runtime understands. Anything else with the prefix is invalid. */
export const RUNTIME_ATTRIBUTES = {
  /** `<body data-prototype-start="screen-id">` — the single start screen. */
  start: 'data-prototype-start',
  /** `data-prototype-screen="screen-id"` — one section per screen. */
  screen: 'data-prototype-screen',
  /** `data-prototype-go="screen-id"` — transition to a screen. */
  go: 'data-prototype-go',
  /**
   * `data-prototype-go-by-scenario="scenario-id:screen-id,scenario-id:screen-id,*:screen-id"` —
   * scenario-resolved transition; `*` is the mandatory fallback branch.
   */
  goByScenario: 'data-prototype-go-by-scenario',
  /** `data-prototype-back` — pop the in-memory back stack. */
  back: 'data-prototype-back',
  /** `data-prototype-reset` — restore the document to its initial declarative state. */
  reset: 'data-prototype-reset',
  /** `data-prototype-toggle="region-id"` — show/hide a same-document region. */
  toggle: 'data-prototype-toggle',
  /** `data-prototype-validate="form-id"` — gate the transition on native form validity. */
  validate: 'data-prototype-validate',
  /** `data-prototype-error="bounded user copy"` — message shown when validation fails. */
  error: 'data-prototype-error',
  /** `data-prototype-validation-for="control-name"` — element receiving the validation message. */
  validationFor: 'data-prototype-validation-for',
  /** `data-prototype-bind="control-name"` — mirror a control's text/selected value. */
  bind: 'data-prototype-bind',
  /** `data-prototype-scenario="scenario-id"` — element exposed only in that scenario. */
  scenario: 'data-prototype-scenario',
} as const

export type RuntimeAttributeName = (typeof RUNTIME_ATTRIBUTES)[keyof typeof RUNTIME_ATTRIBUTES]

/** An action element (button) may carry exactly one of these. */
export const ACTION_ATTRIBUTE_NAMES = [
  RUNTIME_ATTRIBUTES.go,
  RUNTIME_ATTRIBUTES.goByScenario,
  RUNTIME_ATTRIBUTES.back,
  RUNTIME_ATTRIBUTES.reset,
  RUNTIME_ATTRIBUTES.toggle,
] as const

/** Input types generated prototypes may use. Everything else is rejected. */
export const ALLOWED_INPUT_TYPES = [
  'text',
  'email',
  'tel',
  'number',
  'range',
  'date',
  'radio',
  'checkbox',
] as const

/** Input types whose `maxlength` is capped at 512. */
export const TEXTUAL_INPUT_TYPES = ['text', 'email', 'tel'] as const

export const MAX_TEXTUAL_INPUT_LENGTH = 512

export const MAX_TEXTAREA_LENGTH = 8192

/** CSS custom properties the injected runtime sets on the document element. */
export const RUNTIME_SURFACE_VARIABLES = {
  safeAreaTop: '--prototype-safe-area-top',
  safeAreaBottom: '--prototype-safe-area-bottom',
  safeAreaLeft: '--prototype-safe-area-left',
  safeAreaRight: '--prototype-safe-area-right',
} as const

/** Attribute the runtime sets on the document element for the active theme. */
export const DESIGN_THEME_ATTRIBUTE = 'data-design-theme'

/**
 * Parse a `data-prototype-go-by-scenario` map. Returns branch entries in
 * source order; callers enforce the mandatory `*` fallback, ID syntax, and
 * target existence. Exposed so validator and runtime agree on the grammar.
 */
export function parseScenarioMap(value: string): Array<{ scenarioId: string; screenId: string }> {
  return value
    .split(',')
    .map((entry) => {
      const separator = entry.indexOf(':')
      if (separator <= 0 || separator === entry.length - 1) {
        throw new Error(`Invalid scenario map entry: ${entry}`)
      }
      return {
        scenarioId: entry.slice(0, separator),
        screenId: entry.slice(separator + 1),
      }
    })
}
