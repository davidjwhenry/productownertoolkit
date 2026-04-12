---
name: notion-drift
description: Check markdown files already synced to Notion for drift by reading each item's stored Notion URL from front matter, fetching the current Notion page, and comparing key metadata against the repo copy. Use when asked to check whether synced PRDs, epics, stories, backlog items, or other markdown artefacts have changed in Notion. Always ask which document or documents to review first, and warn that large multi-document checks may take time.
---

# Notion Drift

Use this skill to review whether repo markdown and the corresponding Notion pages have drifted apart.

Read `context/company-context.md` before asking setup questions. Use it to understand whether Notion is part of the team's normal workflow, what artefacts are tracked there, and any default Project IDs, tracking locations, custom sync fields, or special review expectations already captured during bootstrap.

## Ask First

Before reading files, ask the user exactly which document or documents to review.

Examples:

- one file
- a list of files
- one backlog folder
- one PRD folder
- all files under a defined root

Be explicit that broad reviews can take time:

- if the user asks for a folder or root-level sweep, say it may take a while because every synced document must be read locally and fetched from Notion
- if the user has not said whether this is a spot check or a repo-wide audit, ask

Also confirm:

- whether to compare only frontmatter drift or also note obvious title or content drift
- which frontmatter field stores the Notion URL, usually `notion_ticket`
- whether any custom fields from `context/company-context.md` must be included in the drift check

If `context/company-context.md` says Notion is not used for working artefacts, stop and confirm that this review is a deliberate exception before proceeding.

## What To Compare

Primary scope:

- the stored Notion URL
- title
- status
- priority
- tags
- owner or assignee
- parent or relation link
- any custom sync fields captured during bootstrap

Default behavior:

- treat frontmatter as the local source of truth for metadata
- compare the local values against the current Notion page state
- note obvious page-title mismatches even if the title is not duplicated in markdown body

Only compare body content if the user asks for it or if a major drift is obvious during review.

## Core Rules

- Never assume all synced files use the same schema. Confirm the relevant fields first.
- Never invent a field mapping. If the mapping is unclear, inspect the Notion page or database schema and ask.
- Never overwrite Notion or local markdown during the review step unless the user explicitly asks.
- If drift is found, summarize it and ask whether the user wants to update local markdown or rewrite Notion from the repo version.
- If bootstrap captured custom Notion fields, include them in the drift review unless the user says otherwise.
- If a file has no Notion URL in the configured frontmatter field, report it as not reviewable rather than guessing.

## Workflow

### 1. Confirm review scope

Ask the user:

- which document or documents to review
- whether this is a narrow check or a broad audit
- whether to review frontmatter only or include notable content drift

If the requested scope is broad, warn that it may take some time and offer to narrow the review if needed.

### 2. Read local files

Read the requested markdown files in parallel.

For each file, extract:

- the configured Notion URL field, usually `notion_ticket`
- title
- frontmatter metadata relevant to the project
- any custom sync fields required by `context/company-context.md`

### 3. Validate reviewability

For each file:

- if the Notion URL is missing, mark it as `Missing Notion URL`
- if the file is outside the user-approved scope, skip it
- if the frontmatter is malformed, report that before trying to compare

Only fetch Notion pages for files with a valid stored URL.

### 4. Authenticate and fetch Notion state

- Check that the available Notion MCP server is authenticated.
- If authentication is missing, call `mcp_auth`.
- Fetch each Notion page from the URL stored in frontmatter.
- If field names or property meanings are unclear, inspect the relevant Notion schema before judging drift.

### 5. Compare local and Notion values

For each reviewable file, classify it as one of:

- `In Sync`
- `Metadata Drift`
- `Content Drift`
- `Missing In Notion`
- `Needs Manual Review`

Use `Metadata Drift` for differences in:

- title
- status
- priority
- tags
- owner or assignee
- relation fields
- custom sync fields

Use `Content Drift` only when:

- the user asked for content comparison
- or a meaningful body mismatch is obvious enough to matter

### 6. Summarize drift for the user

Summarize per file:

- local file path
- Notion URL
- drift status
- exact fields that differ
- whether the likely next action is to update the repo or overwrite Notion

Keep the summary concise and decision-oriented.

### 7. Ask for the next action

If drift exists, ask the user what to do next:

- update the local markdown to match Notion
- treat the repo copy as source of truth and rewrite Notion
- leave it unresolved for now

Do not perform either update path until the user chooses.

If the user chooses to rewrite Notion from the repo version, follow the configured sync conventions and confirm before making changes.

## Drift Review Checklist

Use this checklist when the setup is incomplete:

| Input | Example placeholder |
| --- | --- |
| Review scope | `docs/prds/payments.md` |
| Scope type | `single file`, `folder`, `root audit` |
| URL field | `notion_ticket` |
| Fields to compare | `status`, `priority`, `owner`, `tags` |
| Custom drift fields | `{FIELD_NAME -> EXPECTED_SOURCE}` |
| Compare content too? | `yes` or `no` |

## Output Shape

Use a compact summary like:

```markdown
## Notion Drift Summary

- `docs/prds/payments.md` — In Sync
- `requirements/payments/backlog/EP-12.md` — Metadata Drift: `Status` differs (`Backlog` locally, `In Progress` in Notion)
- `requirements/payments/backlog/US-12.3.md` — Missing Notion URL
- `requirements/payments/backlog/US-12.4.md` — Needs Manual Review: custom field `Squad` missing in Notion
```

Then ask which direction should win for each drifted file: repo or Notion.

## Error Handling

| Problem | Action |
| --- | --- |
| User asks for a very broad review | Warn that it may take time and confirm the scope |
| Missing Notion URL | Report as not reviewable |
| Notion page no longer exists | Report as `Missing In Notion` |
| Unknown property mapping | Inspect schema and ask before judging drift |
| Custom field captured in bootstrap but unclear for this review | Stop and clarify |
| Notion fetch fails for one file | Continue with the rest and report the failure clearly |
| Differences are ambiguous | Mark as `Needs Manual Review` rather than guessing |

## Example Trigger

User: "Check whether the payments backlog has drifted from Notion."

Response flow:

1. Ask which files or folders to include and warn that a large sweep may take some time.
2. Read the local markdown files and collect their Notion URLs.
3. Fetch the current Notion pages from those URLs.
4. Compare key frontmatter fields and any required custom fields.
5. Summarize any drift.
6. Ask whether the repo should be updated or Notion should be rewritten.
