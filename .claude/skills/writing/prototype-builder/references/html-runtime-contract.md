# HTML Runtime Contract

The finite declarative interaction contract for generated variants. The runtime is repository-owned and injected by the host; prototype authors express behaviour only through the attributes below. The playground validator rejects anything else.

## Screens

- `<body data-prototype-start="<screen-id>">` declares the single start screen.
- `<section data-prototype-screen="<screen-id>">` declares each screen; the runtime shows only the active screen and keeps an in-memory back stack.

Screen IDs must be unique kebab-case values, and the start screen must reference a declared screen.

## Button Actions

A button carries exactly one action attribute, and actions appear only on `<button type="button">` elements:

- `data-prototype-go="<screen-id>"` — transition to a screen
- `data-prototype-go-by-scenario="<scenario-id>:<screen-id>,…,*:<screen-id>"` — scenario-resolved transition; exactly one `*` fallback branch is mandatory, and every branch key must be a scenario declared in the manifest
- `data-prototype-back` — pop the back stack (no value)
- `data-prototype-reset` — restore the document to its initial declarative state (no value)
- `data-prototype-toggle="<region-id>"` — show or hide a same-document region by element ID

## Native Controls

Controls retain state by `name`; names and element IDs must be kebab-case and IDs unique across the document.

- Allowed input types: `text`, `email`, `tel`, `number`, `range`, `date`, `radio`, `checkbox`. `pattern`, `step`, file, password, and URL controls are rejected, as are unknown types.
- Constraint attributes are limited to `required`, finite numeric `min`/`max`, and explicit `minlength`/`maxlength`.
- Every `text`, `email`, or `tel` input must set `maxlength` between 1 and 512; every `<textarea>` must set `maxlength` between 1 and 8192.

## Validation Binding

- `data-prototype-validate="<form-id>"` on a button gates its transition on native form validity.
- `data-prototype-error="<bounded copy>"` supplies the message shown when validation fails.
- `data-prototype-validation-for="<control-name>"` marks the element that receives the message.

## Value And Scenario Binding

- `data-prototype-bind="<control-name>"` mirrors a control's current text or selected value into the element's text content.
- `data-prototype-scenario="<scenario-id>"` exposes deterministic content only when the host's active scenario matches; every referenced scenario must be declared in the manifest.

No runtime attribute contains code, regular expressions, CSS selectors, HTML, or arbitrary expressions. Any unknown `data-prototype-*` attribute is an error.

## Screen Addressability (Bridge Protocol v2)

The host serialises the scenario's declared screens (with their jump fixtures) and an optional `startScreen` into the frozen per-load context. On top of `prototype:ready` and `prototype:error`:

- the parent may send `prototype:goto { screenId }`; the runtime re-validates the target, restores initial declarative state, applies the screen's fixture (`values`, `checked`, `validation`), clears the back stack, and shows the screen. Unresolvable targets fail with `UNRESOLVED_SCREEN_TARGET`
- the runtime emits `prototype:screen { screenId }` after `ready` and on every subsequent shown screen, so the host keeps the sub-menu highlight, § strip, and the `screen` query parameter in step with in-prototype navigation

Deep links carry the screen in the URL (`&screen=<screen-id>`); variant switches keep the screen when the target variant declares the same id.

## Host Behaviour

The host renders each variant inside a sandboxed iframe with a per-load CSP nonce, injects the frozen context (variant, surface, scenario, theme) and the runtime, and recreates the iframe whenever the selection changes so each review starts from deterministic state. Desktop content viewport is 1440 × 900 with zero safe areas; iOS is 393 × 852 with 59 px top and 34 px bottom safe areas available as `--prototype-safe-area-top` and `--prototype-safe-area-bottom` custom properties (plus left/right variants). On the iOS surface the host hides document scrollbars while keeping the frame scrollable by touch, drag, or wheel. The active theme is exposed as `data-design-theme` on the document element.
