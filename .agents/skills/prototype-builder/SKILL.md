---
name: prototype-builder
description: Generate or revise feature-local interactive prototypes from a PRD using the repository's pinned design profile and declarative HTML runtime. Use when the user supplies a PRD path and wants clickable variants for review, or asks to update an existing prototype. Establishes user/job/journey/decision, proposes exactly two hypothesis-led variants, waits for approval, writes `prototype.json` plus variant HTML, validates, exercises every scenario in the real playground, and stops at the review gate before any hand-off.
---

# Prototype Builder

Turn an approved PRD into two genuinely different, hypothesis-led prototype variants rendered by the repository's declarative runtime. The output is review material, never production code.

- read the PRD and the pinned profile before designing anything
- default to exactly two variants expressing different hypotheses; a third is allowed only for a genuinely separate decision hypothesis in the PRD
- generate only declarative HTML: no executable JavaScript, no remote URLs, no navigation, no storage
- preserve unrelated variants and scenarios on update; never edit the PRD or the design profile
- stop at the approval gate before writing, and again before any hand-off

## References

Read both before generating:

- **[references/prototype-contract.md](references/prototype-contract.md)** — manifest schema, feature-local layout, validation outcomes
- **[references/html-runtime-contract.md](references/html-runtime-contract.md)** — the declarative interaction attributes and control rules

## Start Here

1. Read `context/company-context.md`, `context/team-context.md`, `context/preferences.md`, and `context/product-language.md` when present.
2. Read the supplied PRD, relevant accepted decisions and requirements, `design-system/profiles/ACTIVE`, the pinned profile's files, and any existing prototype manifest for the feature.
3. Establish before designing: the primary user, the job, the core journey, the decision the variants must help make, in-scope requirement IDs, meaningful unhappy states, and prototype-only shortcuts.

Whenever the actor, job, state, boundary, or trade-off stays unclear, invoke `product-grill`: ask exactly one question with **Question**, **Why it matters**, **My recommendation**, and **Artefact impact**, then wait.

## Build Brief Gate

Present a 3–5 bullet brief naming: the source PRD, the output path, the pinned profile (`id@version` plus fingerprint), the exactly two hypotheses, the selected surfaces, and the scenarios (happy path plus meaningful unhappy states). Wait for approval before writing or replacing any file.

## Generating

1. Write `requirements/<classification>/<feature>/prototypes/<prototype-id>/prototype.json` pinning the active profile's id, version, and fingerprint, with requirement traceability to the PRD's IDs.
2. Write `variants/<variant-id>.html` for each variant: full documents with doctype, `<html lang>`, `<title>`, viewport metadata, semantic HTML, the complete pinned token set inlined, local/system font fallbacks, inline CSS/SVG/data assets only, and only the documented runtime attributes.
3. Keep `.pen` exploration artefacts under the prototype's `companions/`; pen.dev may help explore or screenshot but is never required.
4. Run `cd prototype-playground && npm run validate` and fix every error and unexplained warning.

## Verification In The Playground

Launch `cd prototype-playground && npm run dev`, open the catalogue, and exercise every declared scenario in both variants on every declared surface, in both themes. Capture visual evidence from the actual browser and iterate on feedback. Confirm back and cancel paths work and entered choices survive validation errors.

## Review Gate And Hand-Off

After explicit review approval only, run `npm run handoff -- --prototype <prototype-id>`, open the offline `index.html` directly, and report: paths, hypotheses, the tested matrix, the pinned profile, and remaining prototype-only limitations. Without approval, stop at the gate.

## Maintenance

Keep the `.claude`, `.cursor`, and `.agents` copies aligned.
