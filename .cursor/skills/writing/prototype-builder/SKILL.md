---
name: prototype-builder
description: Generate or revise feature-local interactive prototypes from a PRD using the repository's pinned design profile and declarative HTML runtime. Use when the user supplies a PRD path and wants clickable variants for review, or asks to update an existing prototype. Establishes user/job/journey/decision, proposes exactly two hypothesis-led variants, waits for approval, writes `prototype.json` with screen-addressable navigation, per-screen fixtures, a design-notes companion, and an amendments scaffold, validates, exercises every scenario in the real playground, and stops at the review gate before any hand-off.
---

# Prototype Builder

Turn an approved PRD into two genuinely different, hypothesis-led prototype variants rendered by the repository's declarative runtime. The output is review material, never production code.

- read the PRD and the pinned profile before designing anything
- default to exactly two variants expressing different hypotheses; a third is allowed only for a genuinely separate decision hypothesis in the PRD
- generate only declarative HTML: no executable JavaScript, no remote URLs, no navigation, no storage
- declare every screen in the manifest with PRD § references and jump fixtures; screens are the addressable review surface
- quote the PRD verbatim in the design-notes companion; never paraphrase at runtime
- preserve unrelated variants and scenarios on update; never edit the PRD or the design profile
- stop at the approval gate before writing, and again before any hand-off

- default to the phone view: declare `surfaces` with `ios` first and `defaults.surface: "ios"` whenever the phone surface is in scope — the playground opens on the phone and offers desktop second

- **[references/prototype-contract.md](references/prototype-contract.md)** — manifest schema, screen declarations, fixtures, companions, amendments, validation outcomes
- **[references/html-runtime-contract.md](references/html-runtime-contract.md)** — the declarative interaction attributes, control rules, and bridge protocol

## Start Here
1. Read `context/company-context.md`, `context/team-context.md`, `context/preferences.md`, and `context/product-language.md` when present.
2. Read the supplied PRD, relevant accepted decisions and requirements, `design-system/profiles/ACTIVE`, the pinned profile's files, and any existing prototype manifest for the feature.
3. Establish before designing: the primary user, the job, the core journey, the decision the variants must help make (the statement the variant deck argues about), in-scope requirement IDs, meaningful unhappy states, and prototype-only shortcuts.
4. From the PRD, note the numbered sections the prototype touches — job (`§` JTBD), trust/goal, rules, scope — with their requirement IDs; these become screen `prdRefs` and the design notes.

Whenever the actor, job, state, boundary, or trade-off stays unclear, invoke `product-grill`: ask exactly one question with **Question**, **Why it matters**, **My recommendation**, and **Artefact impact**, then wait.

## Build Brief Gate

Present a 3–5 bullet brief naming: the source PRD, the output path, the pinned profile (`id@version` plus fingerprint), the exactly two hypotheses, the selected surfaces, and the scenarios (happy path plus meaningful unhappy states) with the screens each will declare. Wait for approval before writing or replacing any file.

## Generating

1. Write `requirements/<classification>/<feature>/prototypes/<prototype-id>/prototype.json` pinning the active profile's id, version, and fingerprint, with requirement traceability to the PRD's IDs.
2. For each variant, declare its `screens` array: every `data-prototype-screen` in the entry, exactly once per scenario that uses it, with a stable `id` (match screen ids across variants wherever the screen is equivalent — switching variants keeps the reviewer on the same ground), a `label`, `order` within the scenario, `prdRefs: [{ section, requirementIds }]` resolving to the PRD's numbered headings, `branch: true` for unhappy-path screens, and a `fixture` (`values`, `checked`, `validation`) whenever a direct jump must land mid-state — the validation-error scenario, for instance, jumps straight to the invalid-amount state.
3. Write `variants/<variant-id>.html` for each variant: full documents with doctype, `<html lang>`, `<title>`, viewport metadata, semantic HTML, the complete pinned token set inlined, local/system font fallbacks, inline CSS/SVG/data assets only, and only the documented runtime attributes.
4. Write `companions/design-notes.json`: 3–5 verbatim, anchored passages quoted from the PRD — the job (§ JTBD), the trust goal, the operating rules, and the scope/rabbit holes. Each note carries `id`, `section`, `label`, the exact `quote` (copy, never paraphrase), and its `requirementIds`.
5. Write an empty `amendments.json` scaffold (`{ "schemaVersion": 1, "amendments": [] }`) beside the manifest so review state has a home from day one.
6. Keep `.pen` exploration artefacts under the prototype's `companions/`; pen.dev may help explore or screenshot but is never required.
7. Run `cd prototype-playground && npm run validate` and fix every error and unexplained warning. Screen cross-checks, § resolution, fixture targets, notes, and amendments are all validated.

## Verification In The Playground

Launch `cd prototype-playground && npm run dev`, open the catalogue, and exercise every declared scenario in both variants on every declared surface, in both themes. Jump to each screen from the scenario sub-menu and confirm fixture hydration (invalid states appear pre-filled, not walked). Confirm back and cancel paths work and entered choices survive validation errors. Confirm switching variants keeps an equivalent screen when one is declared. Capture visual evidence from the actual browser and iterate on feedback.

## Review Gate And Hand-Off

After explicit review approval only, run `npm run handoff -- --prototype <prototype-id>`, open the offline `index.html` directly, and report: paths, hypotheses, the tested matrix, the pinned profile, remaining prototype-only limitations, and open amendments. Without approval, stop at the gate.

## Review Loop (Amendments → Requirements)

When asked to work review feedback after a session:

1. Read the prototype's `amendments.json` and filter to `open`.
2. For each amendment, open its deep link in the playground (`?prototype=<id>&variant=<selection.variantId>&surface=<selection.surfaceId>&scenario=<selection.scenarioId>&theme=<selection.themeId>&screen=<screenId>`) and inspect the pinned screen against the note.
3. Classify each: a PRD revision (the requirement itself is wrong or missing), a backlog item (new behaviour under an existing requirement), or prototype-only polish.
4. Propose the PRD edits or backlog items with the amendment as evidence; after the user accepts, set the amendment `status` to `resolved` (or `dismissed` with reasoning in the note) via the playground or a direct edit, and re-run `npm run validate`.
5. Never resolve an amendment silently; the log is the audit trail from design review back into requirements.

## Maintenance

Keep the `.claude`, `.cursor`, and `.agents` copies aligned.
