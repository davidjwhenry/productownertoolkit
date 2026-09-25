# UAT Conventions — Schema & Worked Examples

Full reference for the UAT test-case library. Read before drafting the first case of a session.

## Contents

- [Two-layer model](#two-layer-model)
- [File schema](#file-schema)
- [Case schema](#case-schema)
- [ID allocation](#id-allocation)
- [Priority guide](#priority-guide)
- [Test-type guide](#test-type-guide)
- [Step-writing patterns](#step-writing-patterns)
- [Worked example — happy path](#worked-example--happy-path)
- [Worked example — unhappy path](#worked-example--unhappy-path)
- [Worked example — chained flow](#worked-example--chained-flow)
- [New feature-area file](#new-feature-area-file)

## Two-layer model

Keep authored cases separate from execution results:

| Layer | Where | What |
|---|---|---|
| Test case library | Productownertoolkit, `testing/uat/test_cases/` | Reusable scenarios — the source of truth |
| Execution | External tracking system (test runner, spreadsheet, or tool of choice) | Build cycles, per-tester executions, pass/fail |

Cases are authored here and synced to the execution system before a UAT cycle. If the execution system has its own schema, keep field names below aligned 1:1 with it so the sync is lossless.

## File schema

One file per feature area. Root object:

| Key | Type | Notes |
|---|---|---|
| `feature_area` | string | Human name, matches the case-level `feature_area` |
| `description` | string | One line — the feature area's scope |
| `notes` | string (optional) | Scope boundaries + cross-references; cite other files and `TC-XXX` ids to prevent duplicate coverage |
| `test_cases` | array | Case objects (may be `[]` for a placeholder file) |

## Case schema

| Key | Type | Notes |
|---|---|---|
| `id` | string | `TC-XXX`, globally unique across all files |
| `description` | string | One sentence: scenario + outcome |
| `feature_area` | string | Repeat the file's area name |
| `priority` | enum | `P0` \| `P1` \| `P2` |
| `test_type` | enum | `Happy path` \| `Unhappy path` \| `Edge case` |
| `active` | bool | `true` for live cases; `false` retires without deleting |
| `pre_conditions` | string[] | Declarative state before step 1 |
| `steps` | object[] | `{ step:int, action:string, expected_result:string }` |

## ID allocation

- Globally unique across **every** file — not per file.
- Feature areas own contiguous ranges, recorded in the folder `README.md` table (e.g. first area `TC-001…`, Login `TC-050…`, Payments `TC-100…`). New areas take the next open block after the highest range in that table.
- To find the next id: read the target area's range from the README. If the README is missing or stale, search all `test_cases/*.json` for `"id"` values, take the max, add 1. Continue the target file's range if it has headroom; otherwise take the next free block.
- Never renumber existing cases. Never delete — set `"active": false` (execution history references the id).
- Validate with `references/validate.py`, which enforces uniqueness against `references/case.schema.json` and flags any duplicate id across files.

## Priority guide

| Priority | Use for |
|---|---|
| `P0` | Core happy paths; authentication, lockout, session security; confirmation/authorization of irreversible or high-value actions; anything whose failure blocks release |
| `P1` | Supporting flows; common error handling; limit/validation messaging; recoverable failures |
| `P2` | Minor, cosmetic, or rarely-hit supporting behaviour |

## Test-type guide

| Type | Use for |
|---|---|
| `Happy path` | The intended flow completing successfully |
| `Unhappy path` | Wrong input, cancellation, limits exceeded, timeouts, backend failures, reversals |
| `Edge case` | Rare boundary conditions worth an explicit check (use sparingly) |

Cover happy paths first, then the unhappy paths that carry real risk. Don't manufacture edge cases for completeness.

## Step-writing patterns

- **Atomic:** one `action` → one observable `expected_result`. Split compound actions into separate steps.
- **Imperative verbs:** `Tap`, `Enter`, `Select`, `Navigate to`, `Complete`, `Allow`, `Observe`.
- **Terminal assertion idiom:** a final `Observe the screen` / `Observe navigation` step to check the end state after an action.
- **Guardrail via em-dash:** append the critical negative/recovery assertion to `expected_result` after ` — `:
  - `"The app falls back to the login screen — the user is not logged out or shown an error wall"`
  - `"Field is cleared and the user can re-enter a new code — without restarting the flow"`
  - `"User is notified of the failure — the action is reversed and state is restored"`
- **Black-box only:** describe what the tester does and sees. No API names, DB fields, or internal state — except a `pre_conditions` line that names a backend response an unhappy path must simulate.
- **Unhappy paths assert recoverability:** state what remains possible (retry, cleared field, reversal, fallback), not merely that an error shows.

## Worked example — happy path

```json
{
  "id": "TC-052",
  "description": "Returning user logs in successfully via PIN on a registered device",
  "feature_area": "Login",
  "priority": "P0",
  "test_type": "Happy path",
  "active": true,
  "pre_conditions": [
    "User has completed onboarding with a known PIN",
    "User is on a registered device",
    "Biometrics are disabled or unavailable so the PIN screen is shown directly"
  ],
  "steps": [
    { "step": 1, "action": "Enter the correct PIN", "expected_result": "PIN is accepted without error" },
    { "step": 2, "action": "Observe the screen after PIN entry", "expected_result": "User is logged in and lands on the home dashboard" }
  ]
}
```

## Worked example — unhappy path

Note the simulated-state pre-condition and the recoverability in the expected result.

```json
{
  "id": "TC-118",
  "description": "Failed payment shows failure state with reversal in transaction history",
  "feature_area": "Payments",
  "priority": "P1",
  "test_type": "Unhappy path",
  "active": true,
  "pre_conditions": [
    "Test environment can simulate a payment failure with reversal to the account"
  ],
  "steps": [
    { "step": 1, "action": "Submit a payment that fails during processing", "expected_result": "User is notified of the failure — the amount is reversed to the account" },
    { "step": 2, "action": "Open the failed transaction in transaction history", "expected_result": "Transaction detail shows failed status with strikethrough amount and confirmation that funds have been returned to the account" }
  ]
}
```

## Worked example — chained flow

Pre-conditions reference the upstream case rather than re-listing its steps.

```json
{
  "id": "TC-007",
  "description": "OTP is delivered to the registered contact method during enhanced login",
  "feature_area": "App Launch",
  "priority": "P0",
  "test_type": "Happy path",
  "active": true,
  "pre_conditions": [
    "Enhanced login has been triggered (see TC-006)",
    "User has access to their registered phone or email"
  ],
  "steps": [
    { "step": 1, "action": "Observe the OTP prompt on screen", "expected_result": "App shows an OTP entry screen indicating where the code has been sent" },
    { "step": 2, "action": "Check the registered contact method (phone/email) for the OTP", "expected_result": "OTP message is received within a reasonable time (under 60 seconds)" }
  ]
}
```

## New feature-area file

When a feature area has no file yet, create it with the wrapper and an empty (or first-case) array, then add a row to the folder's `README.md` feature-area table:

```json
{
  "feature_area": "Notifications",
  "description": "Push, in-app, and email notification delivery and preferences",
  "notes": "Notification-triggered deep links are covered in navigation.json.",
  "test_cases": []
}
```
