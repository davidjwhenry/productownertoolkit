---
name: done
description: Close a working session by reviewing this conversation and the recent ones in the same repository for recurring patterns, then suggest improvements to existing skills, additions to the context files, or new skills. Use when the user says "done", "/done", "wrap up", "close the session", "what should we learn from this", or asks for a session retrospective. Looks back over the last 5 conversations, or to the last `done` run if that is more recent. Proposes suggestions for confirmation before changing anything and writes a short log to `{content}/personal/reports/`.
---

# Done

Turn repeated friction into durable improvements. One correction is a task instruction; the same correction across sessions is a gap in a skill or a context file.

## Workflow

### Phase 0: Load Context

- Read `{content}/context/preferences.md`, `{content}/context/company-context.md`, `{content}/context/team-context.md`, and `{content}/context/product-language.md`, so nothing already recorded is suggested again.
- List the installed skills and their descriptions.

### Phase 1: Set The Review Window

1. Find the newest `*-done.md` file in `{content}/personal/reports/`. Its `Reviewed to:` line is the cutoff. Read its **Declined** section and do not raise those suggestions again unless there is new evidence.
2. Review the current conversation plus earlier conversations from this repository, newest first. Stop at the cutoff or after 5 earlier conversations, whichever comes first.
3. If no log exists, use the last 5 earlier conversations.

### Phase 2: Gather Conversations

The current conversation is already in context. Earlier ones are local transcript files, and the location depends on the agent:

| Agent | Location | Scope to this repository by |
| --- | --- | --- |
| Claude Code | `~/.claude/projects/<repo path with "/" replaced by "-">/*.jsonl` | the folder name |
| Codex | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | `cwd` in the first line (`session_meta`) |
| Cursor | `~/.cursor/projects/<repo path with "/" replaced by "-", no leading "-">/agent-transcripts/` | the folder name |

Rules:

- Pick transcripts by modified time, newest first, and skip the current session's own file.
- Transcripts are large. Extract the user's messages and the assistant's final replies; skip tool calls and tool results. Do not read whole files into context. For Claude Code, for example:

  ```sh
  jq -r 'select(.type=="user" and (.isMeta|not)) | .message.content
    | if type=="string" then . else (map(select(.type=="text").text)|join("\n")) end
    | select(length>0)' <file>.jsonl
  ```

- If no transcripts are found, or the agent does not expose them, say so plainly and review the current conversation only. Do not guess at earlier sessions.
- Transcripts stay on the machine. Never copy long excerpts, secrets, or personal details about named people into the log.

### Phase 3: Look For Patterns

Read for evidence, not impressions. Look for:

- **Repeated corrections** — the user fixed the same thing more than once (tone, structure, naming, level of detail).
- **Repeated explanations** — the user re-supplied the same fact about the company, team, product, or domain.
- **Repeated manual workflows** — the same multi-step request made without a skill, or with a skill followed by the same extra steps each time.
- **Skill friction** — a skill phase the user skipped, reordered, overrode, or had to rescue.
- **Open threads** — work started and not finished, or a decision deferred and never recorded.

Rules:

- A pattern needs at least two occurrences, or one explicit "always" or "never" from the user.
- Cite the evidence for each pattern: which conversation (date) and what was said, paraphrased in one line.
- If nothing qualifies, say so. Do not pad.

### Phase 4: Turn Patterns Into Suggestions

Route each pattern to the smallest change that would have prevented it:

| Pattern | Suggestion | Target |
| --- | --- | --- |
| Formatting, tone, or workflow preference | Preference entry | `{content}/context/preferences.md` |
| Missing company, stack, or process fact | Context addition | `{content}/context/company-context.md` |
| Stakeholder or working-style observation | Context addition | `{content}/context/team-context.md` |
| Term used inconsistently or re-explained | Language entry | `{content}/context/product-language.md` |
| Product decision made but not recorded | Decision record | `{content}/requirements/decisions/` |
| Existing skill missed a step or asked for the wrong thing | Skill improvement | the skill's `SKILL.md` |
| Recurring workflow with no skill | New skill | hand to `skill-creator` |
| Unfinished work | To-do | `{content}/personal/to-dos/not-done/` |

Rules:

- Prefer a context entry over a skill change, and a skill change over a new skill.
- Suggest a new skill only when the workflow recurred and no existing skill covers it with a small change.
- Skill improvements depend on the layout. In a clone of the toolkit repository, edit `toolkit/skills/<name>/SKILL.md` and run `npm run generate`. In an installed project the toolkit's skills are managed files that updates replace, so record the improvement as a preference instead, or create a separate skill with `skill-creator`.
- Keep team observations durable and non-sensitive.

### Phase 5: Play Back Before Writing

Show the suggestions and ask which to apply. Use this structure:

```markdown
## Session Review

**Reviewed:** this conversation plus [n] earlier, [start date] to [end date]

### Suggested context updates
1. `{content}/context/preferences.md` — [entry]. *Evidence: [date] — [one line]; [date] — [one line].*

### Suggested skill improvements
2. `prd-writer` — [change]. *Evidence: …*

### Suggested new skills
3. `[name]` — [what it would do]. *Evidence: …*

### Open threads
4. [thread] — [suggested to-do].

Which of these shall I apply? (numbers, "all", or "none")
```

Do not show empty sections. Number suggestions continuously so the user can answer with numbers.

### Phase 6: Apply And Log

On confirmation:

1. Apply only the accepted suggestions. Never write to a context file or a skill silently.
2. For an accepted new skill, hand off to `skill-creator` rather than drafting it inline.
3. Write the log to `{content}/personal/reports/YYYY-MM-DD-HHMM-done.md`, creating the folder if needed. Write it even when nothing was suggested or accepted; it is the cutoff for the next run.

Log format:

```markdown
# Session Review

Reviewed to: [ISO timestamp of this run]
Conversations reviewed: [n]

## Applied
- [suggestion] → [file]

## Declined
- [suggestion]

## Open threads
- ...
```
