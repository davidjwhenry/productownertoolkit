---
name: meeting-distillation
description: Ingest a meeting transcript or notes and produce structured outputs: action items, key decisions, open questions, and a markdown note file. Use when the user pastes or shares meeting notes, a transcript, or asks to process/distill/summarise/extract action items from a meeting. Writes to `personal/notes/` for general meetings or to a live feature's `notes/` directory when the meeting is clearly about that feature. Always play back the proposed output for explicit user confirmation before writing. Can also update `context/team-context.md` with durable, non-sensitive observations about working styles or stakeholder dynamics.
---

# Meeting Distillation

## Workflow

### Phase 0: Load context

- Read `context/preferences.md` — apply any relevant entries to note structure, action item formatting, level of detail, and how team observations are framed.

### Phase 1: Parse

Extract from the transcript or notes:
- **Date** — infer from context; ask if unclear
- **Participants** with roles if identifiable
- **Key decisions** made
- **Action items** — owner, task, due date where mentioned
- **Open questions** — unresolved items
- **Team observations** — preferences, concerns, working styles observed

Rules while parsing:
- Do not invent owners, deadlines, or decisions when the source is ambiguous
- If an owner or due date is unclear, keep the action item but mark the missing detail as unknown
- If something sounds like a possible decision but was not clearly agreed, capture it under **Open questions** or **Notes**, not **Key decisions**

### Phase 2: Determine Destination

1. **Feature notes** — if the meeting is primarily about a specific live feature or initiative with its own working directory, save to `[feature-dir]/notes/`. Prefer feature directories under `requirements/` or another real working area of the repo. Create the `notes/` directory if it doesn't exist.
2. **Personal notes** — for general team, planning, or status meetings not tied to a specific feature, save to `personal/notes/`.

Do not write meeting notes into `examples/` unless the user explicitly asks.

If ambiguous, ask the user before proceeding.

### Phase 3: Play Back

Before writing anything, present a clear summary for confirmation:

```
## Proposed Output

**File:** `personal/notes/2024-03-15-q2-planning.md`

**Action items:**
- [ ] @alice — Review auth PR by Friday
- [ ] @david — Draft API spec by EOD

**Key decisions:**
- Defer mobile launch to Q2
- Use Stripe for payments

**Open questions:**
- Who owns the migration checklist?

**Team context updates (`context/team-context.md`):**
- Alice: prefers async reviews, concerned about timeline pressure

Shall I write these files?
```

Wait for explicit confirmation before writing.

Do not show empty sections in the playback. If there are no clear decisions, actions, open questions, or context updates, omit that section entirely.

### Phase 4: Write

On confirmation:
1. Write the meeting note .md file — see [references/meeting-note-format.md](references/meeting-note-format.md) for the template
2. Update `context/team-context.md` if there are meaningful observations (create the file if it doesn't exist)

## Team Context File

Location: `context/team-context.md`

Add or update entries under a `## [Name]` heading with:
- Role (if known)
- Preferences and working style
- Key concerns or priorities surfaced in meetings

Rules:
- Summarise durable patterns, not one-off frustrations
- Do not record sensitive personal information
- Do not copy verbatim quotes into the context file
- If the observation is temporary or meeting-specific, keep it in the meeting note instead of promoting it into team context

## File Naming

`YYYY-MM-DD-[brief-slug].md` — e.g. `2024-03-15-q2-planning.md`

## Preference Observation

At the end of the session, if the user corrected note structure, changed action item formatting, adjusted how decisions or open questions are captured, or expressed a repeatable preference:

- Propose adding it to `context/preferences.md` under the most relevant heading
- Confirm with the user before writing — never write silently
- Only record durable patterns, not one-off task instructions

## Maintenance

Keep the `.cursor` and `.claude` copies of this skill and its reference files aligned.
