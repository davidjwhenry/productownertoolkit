# Context

This folder holds the canonical working context for the toolkit.

## Files

- `company-context.md` stores stable company defaults such as stack, geographies, regulation, documentation workflow, and business context.
- `team-context.md` stores current team, stakeholders, decision-makers, and working relationships that may change more often.
- `preferences.md` stores learned user preferences observed during working sessions — tone, detail level, formatting habits, naming conventions, and workflow choices that skills should respect in future sessions.

`team-context.md` may also include durable per-person notes under headings like `## Name` when those observations help future drafting, review, or stakeholder comms.

`preferences.md` is updated by skills at the end of a session when a clear, reusable preference is observed. Skills always confirm with the user before writing. Preferences override generic defaults but not explicit per-task instructions from the user.

## Rules

- Put reusable facts here, not one-off task notes.
- Prefer updating an existing context file over duplicating the same information in PRDs, examples, or reports.
- Skills should read these files before drafting or reviewing artefacts when company or team context matters.
- If a fact is temporary or task-specific, keep it with the working artefact instead of adding it here.
- Keep sensitive personal details and verbatim quotes out of these files.

## Preference Memory

`preferences.md` acts as cross-session memory for this toolkit. The update cycle:

1. A skill reads `preferences.md` during its setup or research phase.
2. The skill applies any relevant preferences to its output.
3. If the user corrects, redirects, or expresses a clear preference during the session, the skill proposes an update to `preferences.md` at the end.
4. The user confirms before anything is written.
5. Future sessions pick up the preference automatically.

Only record durable, reusable preferences. One-off task instructions do not belong here.

## Does Not Belong Here

- Draft PRDs
- Backlog items
- Meeting notes
- Research dumps
- Personal scratch notes
- One-off task instructions (keep those in the conversation or the working artefact)
