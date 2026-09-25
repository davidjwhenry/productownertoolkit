---
name: prototype-reviewer
description: Walk open amendments through the prototype playground and turn accepted ones into PRD revisions or backlog items. Use when a prototype has open review amendments, or when asked to close the loop between design review and requirements. Opens each amendment's deep link, judges it against the pinned screen, classifies it, proposes the requirement change, and resolves or dismisses the amendment once decided.
---

# Prototype Reviewer

Close the loop from design review back into requirements. Amendments are the audit trail; this skill walks them, decides each one with the user, and leaves both the amendment log and the requirements consistent.

- read the amendments before touching anything
- inspect every open amendment on its pinned screen in the real playground, not from memory
- classify before proposing: PRD revision, backlog item, or prototype-only polish
- never resolve or dismiss an amendment without an explicit user decision
- keep the manifest, variants, and design profile untouched unless the change is a prototype revision the user approved

## Start Here

1. Read `context/company-context.md`, `context/team-context.md`, and `context/preferences.md` when present.
2. Read the prototype's `prototype.json` and `amendments.json`; filter to `status: "open"`.
3. Read the feature PRD, especially the sections the amendments' requirement IDs belong to.

## The Walk

For each open amendment, in date order:

1. Build its deep link from the amendment's `selection` block: `cd prototype-playground && npm run dev`, then open
   `?prototype=<id>&variant=<selection.variantId>&surface=<selection.surfaceId>&scenario=<selection.scenarioId>&theme=<selection.themeId>&screen=<screenId>`
2. Confirm the pinned screen hydrates the right state (jump fixtures apply automatically).
3. Judge the note against the screen, the linked requirement, and the design-notes passages quoted from the PRD.
4. Classify:
   - **PRD revision** — the requirement is wrong, missing, or ambiguous; the PRD must change
   - **Backlog item** — new behaviour under an existing requirement; the PRD stands, the backlog grows
   - **Prototype-only polish** — no requirement changes; a `prototype-builder` revision handles it
   - **Dismiss** — the note is already satisfied, out of scope, or withdrawn
5. Present the classification with evidence and wait for the user's decision.

## Proposing The Change

- For a **PRD revision**, draft the exact section edit (respecting anchor discipline: insert sections, never renumber) and update `prd/<feature>.map.json` when the sections or requirement IDs change.
- For a **backlog item**, draft the story with the amendment as its evidence link.
- For **prototype-only polish**, hand the note to `prototype-builder` as revision input; the amendment stays open until the revised prototype is verified.

## Closing The Loop

After the user accepts a classification:

1. Apply the agreed PRD edit or write the backlog item.
2. Update the amendment: `status: "resolved"` once the change has landed (edit `amendments.json` directly or use the playground's Resolve action; both run the same validation).
3. For dismissals, set `status: "dismissed"` and append the reasoning to the amendment's `note`.
4. Run `cd prototype-playground && npm run validate` when any repository file changed.
5. Summarise: resolved, dismissed, still open — and the artefacts each produced.

## Style

Lead with the decision, then the evidence. Quote the PRD passage at stake rather than paraphrasing it. Follow repo writing standards.

## Maintenance

Keep the `.claude` and `.cursor` copies aligned.
