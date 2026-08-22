---
name: uat-writer
description: Write and maintain User Acceptance Testing (UAT) test cases following a reusable-test-case library format. Produces black-box, tester-executable scenarios as structured JSON — one file per feature area, each case with a globally-unique `TC-XXX` id, priority, test type, pre-conditions, and atomic action/expected-result steps. Use when asked to "write UAT cases", "add test cases", "create test scenarios", "write acceptance tests", "cover [feature] for UAT", "add UAT for this PRD/build", "write happy/unhappy path tests", or when populating or extending files under `testing/uat/` in the Productownertoolkit repo.
---

# UAT Writer

Author reusable UAT test cases in the Productownertoolkit test-case library. Cases are **black-box and tester-executable**: a tester who has never seen the code must be able to run each step and judge pass/fail without asking a follow-up. Implementation detail (APIs, internal state, code paths) does not belong in a case — the one exception is naming a backend response an unhappy-path pre-condition must simulate.

Before drafting the first case of a session, read `references/uat_conventions.md` for the full JSON schema, ID rules, and worked happy/unhappy-path examples.

## Where cases live

Cases are organised by feature area under `testing/uat/`:

```
testing/uat/test_cases/<feature_area>.json
```

- **One JSON file per feature area.** Do not scatter a feature across files or mix features in one file.
- The repo is the source of truth. If cases are synced to an external execution/tracking system before a cycle, keep field names aligned 1:1 with that system's schema — document the mapping in the folder's `README.md`.

## File shape

Each feature-area file wraps its cases with area-level metadata:

```json
{
  "feature_area": "Login",
  "description": "One line — the scope of this feature area",
  "notes": "Optional — scope boundaries and cross-references (e.g. 'Registration is covered in profile_creation.json'). Cite other files/cases by TC id.",
  "test_cases": [ /* case objects */ ]
}
```

`notes` is where scope is fenced off: state what this file does *not* cover and point at the file/`TC-XXX` that does. Use it to prevent duplicate coverage across files.

## The folder README

`testing/uat/test_cases/README.md` holds one table listing every feature-area file, its id range, and its status. It is the fast path for the next-id lookup and the map of what coverage exists. Add a row whenever you create a feature-area file:

```markdown
| Feature area | File | ID range | Cases | Status |
|---|---|---|---|---|
| App Launch | app_launch.json | TC-001–049 | 12 | Active |
| Login | login.json | TC-050–099 | 8 | Active |
| Payments | payments.json | TC-100–149 | 0 | Placeholder |
```

- **ID range** is the block reserved for that area (see ID allocation), not the count in use — leave headroom.
- **Status** is `Active` or `Placeholder` (empty `test_cases`).
- Keep the ranges non-overlapping. To allocate a new area, take the next open block after the highest range in the table.

## Test case object

```json
{
  "id": "TC-207",
  "description": "Incorrect PIN shows an error with remaining attempts before lockout",
  "feature_area": "Login",
  "priority": "P0",
  "test_type": "Unhappy path",
  "active": true,
  "pre_conditions": [
    "User is on the PIN login screen on a registered device",
    "Account is not currently locked"
  ],
  "steps": [
    { "step": 1, "action": "Enter an incorrect PIN", "expected_result": "An error is displayed indicating the PIN is incorrect and showing how many attempts remain before lockout" }
  ]
}
```

## Field rules

- **`id`** — `TC-XXX`, **globally unique across every file in the library** (not per-file). Feature areas hold contiguous ranges recorded in the folder README (e.g. App Launch `TC-001…`, Login `TC-050…`). Before adding cases, take the next id from the target area's range in the README; if the file is new, allocate the next open block after the README's highest range. If the README is missing or stale, fall back to scanning `test_cases/` for the current max id. Never renumber. Never delete a case — retire it with `"active": false` so execution history is preserved.
- **`description`** — a single sentence naming the *scenario and its outcome*, not just the action ("Account is locked after exceeding the maximum failed PIN attempts", not "Test PIN lockout"). Present tense.
- **`feature_area`** — repeat the file's area name on every case.
- **`priority`** — `P0` critical (core happy paths, authentication/lockout/security, irreversible or high-value actions), `P1` important (supporting flows, common error handling, limits/validation), `P2` supporting (minor/cosmetic).
- **`test_type`** — `Happy path` (the intended flow), `Unhappy path` (errors, invalid input, limits, failures, cancellation), `Edge case` (rare boundary conditions). Cover happy paths first, then the unhappy paths that matter.
- **`active`** — `true` for new cases.
- **`pre_conditions`** — declarative state that must be true before step 1. For chained flows, reference the upstream case: `"Enhanced login has been triggered (see TC-006)"`. For unhappy paths needing a forced backend state, say so plainly: `"Test environment can simulate a timeout response from the payment provider"`.
- **`steps`** — usually 1–3. Each is one `action` → one observable `expected_result`.

## Writing steps

- **Actions are imperative and single-purpose:** `Tap…`, `Enter…`, `Select…`, `Navigate to…`, `Complete…`, `Allow…`, `Observe…`. One thing per step.
- **A closing `Observe the screen / Observe navigation` step** is the idiom for asserting the terminal state after an action.
- **`expected_result` describes observable state**, and uses an em-dash to append the critical guardrail or negative assertion: `"…falls back to the login screen — the user is not logged out or shown an error wall"`, `"…re-enter a new code — without restarting the flow"`.
- **Unhappy paths must assert recoverability** — what the user can still do (retry, field cleared, funds refunded), not just that an error appears.
- No implementation detail in `action`/`expected_result`. Test what the user sees and does.

## Workflow

1. Identify the feature area → target file. If the file doesn't exist, create it with the file-shape wrapper; add a row to the folder's `README.md` feature-area table with its allocated ID range.
2. Read the existing file (or a sibling) to match its style and confirm the area's ID range.
3. Find the next free global `TC-XXX` — take it from the target area's range in the README (fall back to max across all `test_cases/` + 1).
4. Draft happy paths first, then unhappy paths, then edge cases only where they earn their place.
5. Keep steps atomic; every `expected_result` must be pass/fail-able by a tester with no code access.
6. Validate: run `python references/validate.py testing/uat/test_cases` — it checks each file against `references/case.schema.json`, enforces globally-unique ids, and confirms every case's `feature_area` matches its file. Update the README row's case count and status.

## Review before finishing

- Every `id` is globally unique and continues the range; nothing renumbered or deleted (retired via `active:false` only).
- Each `description` names a scenario + outcome in one sentence.
- `priority` and `test_type` set on every case and consistent with the rules above.
- Pre-conditions cover chained-flow references and any required simulated states.
- Steps atomic; unhappy paths assert recoverability; no implementation leakage.
- File-level `notes` fences scope against sibling files where overlap is possible.
- The README table has a row for every file with a non-overlapping ID range and current case count.
- `python references/validate.py testing/uat/test_cases` passes (valid JSON, schema-conformant, unique ids, consistent feature_area).

## Preference hook

If the user redirects structure, tone, id conventions, priority/type definitions, or coverage depth in a repeatable way, propose a durable entry for `context/preferences.md` under a **UAT** heading (or the closest existing one). Confirm before writing — record durable patterns only, not one-off instructions.
