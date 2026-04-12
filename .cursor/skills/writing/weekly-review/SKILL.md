---
name: weekly-review
description: Review the last week of work and produce a structured weekly summary across personal work in `personal/` and corporate work in the repo. Use when the user asks for a weekly review, weekly wrap-up, weekly summary, what changed this week, or a recap of progress over the last 7 days. Defaults to the last 7 days ending today unless the user supplies a different window. Writes the final report to `personal/reports/` after showing a proposed summary for confirmation. Corporate review should include committed git history in the period plus current staged and unstaged local changes.
---

# Weekly Review

## Workflow

### Phase 1: Set The Review Window

- Default to the last 7 days ending today.
- If the user gives a specific week, date range, or anchor date, use that instead.
- If "this week" is ambiguous and the distinction matters, ask whether they mean calendar week or rolling 7 days.

### Phase 2: Gather Personal Evidence

Review `personal/` first.

Prioritise:
- `personal/notes/`
- `personal/to-dos/not-done/`
- `personal/to-dos/done/`

What to look for:
- new or updated notes
- completed to-dos
- recurring themes
- unfinished threads that still matter

Rules:
- Use file dates, filenames, and content together; do not infer progress from timestamps alone.
- Treat personal notes as lightweight working material, not canonical product decisions.
- If there is little or no recent personal activity, say that plainly.

### Phase 3: Gather Corporate Evidence

Review corporate work from two sources:

1. **Committed work in the review window**
2. **Current local work not yet committed**

Use git evidence for both.

For committed work, inspect:
- commit history in the review window
- changed files and directories
- whether work clusters around a feature, requirement area, report, or skill

For current local work, inspect:
- staged changes
- unstaged changes
- untracked files that appear relevant

Rules:
- Distinguish clearly between shipped/committed progress and current in-progress local work.
- Do not describe local changes as finished work unless the evidence supports that.
- Group related changes into themes rather than listing every file mechanically.
- If the worktree is noisy or contains unrelated changes, say so and limit confidence accordingly.

### Phase 4: Synthesize

Build the review around two top-level lenses:

1. **Personal**
2. **Corporate**

Inside **Corporate**, keep two sub-lenses:
- **Committed this week**
- **Added locally / in progress**

Aim to answer:
- What actually moved this week?
- What themes show up across the work?
- What is still open or unfinished?
- What deserves attention next week?

### Phase 5: Play Back Before Writing

Before writing the report, show a concise proposed summary and ask for confirmation.

Use this structure:

```markdown
## Proposed Weekly Review

**File:** `personal/reports/2026-04-12-weekly-review.md`

### Personal
- ...

### Corporate — committed this week
- ...

### Corporate — added locally / in progress
- ...

### Likely focus for next week
- ...

Shall I write this report?
```

Do not show empty sections. If one section has no evidence, say that briefly instead of padding it.

### Phase 6: Write

On confirmation:

1. Create `personal/reports/` if it does not exist.
2. Write the weekly review markdown file.

Use filename:

`YYYY-MM-DD-weekly-review.md`

If the user asks for a custom label, use:

`YYYY-MM-DD-[short-slug].md`

## Report Structure

Use this as the default format:

```markdown
# Weekly Review

Date range: [start] to [end]

## Executive summary

[Short paragraph on the week]

## Personal

### Progress
- ...

### Open threads
- ...

## Corporate

### Committed this week
- ...

### Added locally / in progress
- ...

### Risks or loose ends
- ...

## Next week

- ...
```

Adapt section density to the evidence. Keep it sharp and scannable.

## Maintenance

Keep the `.cursor` and `.claude` copies of this skill aligned.
