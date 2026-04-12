---
name: notion-sync
description: Sync markdown backlog artefacts from this repo into user-specified Notion databases and write the created Notion page URLs back into front matter. Use when asked to sync, push, upload, or publish epics, stories, backlog items, or other markdown records to Notion. Requires project-specific inputs from the user, including database IDs or URLs, source path, property mappings, and owner names or user IDs.
---

# Notion Sync

Use this skill to sync repo markdown into Notion without hardcoding one team, one workspace, or one schema.

Read `context/company-context.md` before asking setup questions. Use it to understand whether Notion is part of the team's normal workflow, what artefacts are tracked there, and any default Project IDs, tracking locations, or custom sync fields already captured during bootstrap.

## Ask First

Before reading backlog files, collect the missing project-specific inputs from the user.

If `context/company-context.md` says Notion is not used for working artefacts, stop and confirm that this sync is a deliberate exception before proceeding.

Minimum inputs:

- source path to sync
- allowed root paths, if the project uses path restrictions
- parent database or data source ID or URL
- child database or data source ID or URL, if syncing both epics and stories
- title property name for each database
- relation property name used to link child records to parent records
- owner field name for parent records
- assignee field name for child records
- default owner names, assignee names, or explicit Notion user IDs
- frontmatter field to write back, usually `notion_ticket`

If `context/company-context.md` includes custom Notion fields to pass during sync, treat them as mandatory inputs for every sync. Confirm each field name, target database, property type if relevant, and value source before creating pages.

Ask for these too if the schema is not obvious:

- status property names and allowed option values
- priority property names and allowed option values
- tags property names and allowed option values
- file naming conventions, for example `EP-*.md` and `US-*.md`
- frontmatter mappings, for example how `P0` maps to Notion priority
- any custom field mappings or default values captured during bootstrap

If the user does not know a value, do not invent it. Ask follow-up questions or inspect the shared Notion schema first.

## Core Rules

- Never hardcode database IDs, page IDs, user IDs, property names, or select values.
- Never assume one naming convention. Confirm file patterns and frontmatter fields.
- If bootstrap captured custom Notion fields, do not skip them silently. Clarify them before each sync, even if they were used before.
- Create parent records first, then child records that depend on parent relations.
- Set page titles through properties, not by repeating the title in page content.
- Strip YAML frontmatter from the markdown body before sending page content.
- If a file already has a Notion link, ask whether to skip, update, or overwrite unless the user already said.
- Continue past per-file failures where safe, then report what succeeded and what failed.

## Workflow

### 1. Collect sync config

Ask the user for the project-specific inputs above.

At minimum, confirm:

- what folder or files to sync
- which files are parent records and which are child records
- which Notion databases to use
- who should own parents and children
- which frontmatter field should store the created Notion URL
- any custom Notion fields that must be passed on this sync

### 2. Authenticate and inspect Notion

- Check that the available Notion MCP server is authenticated.
- If authentication is missing, call `mcp_auth`.
- If property names or option values are unclear, inspect the target databases before creating anything.
- If owner names are given without IDs, resolve them through the available Notion user lookup tools before page creation.

### 3. Read the source markdown

Read the target markdown files in parallel.

Default backlog pattern:

- parent records: `EP-*.md`
- child records: `US-*.md`

If the project uses different patterns, follow the user-provided convention instead.

Extract from each file:

- title
- frontmatter values such as status, priority, owner, assignee, epic link, tags
- markdown body without frontmatter

### 4. Confirm field mappings

Before creating pages, map repo fields to Notion properties.

Typical mappings to confirm:

- title
- status
- priority
- tags
- owner or assignee
- parent relation
- any custom fields required by `context/company-context.md`

If a local value does not match a valid Notion option:

- use the user-approved fallback
- otherwise stop and ask

## Create records

### 5. Create parent pages

Create parent records in batches if needed.

For each parent record:

- set the title property
- set any confirmed status, priority, tags, and owner fields
- send the markdown body as page content
- store the returned Notion URL keyed by the local record ID

### 6. Create child pages

Only after parents exist:

- create child records
- set the title property
- set any confirmed status, priority, tags, and assignee fields
- link each child to its parent through the confirmed relation property
- store the returned Notion URL keyed by the local record ID

If a child record has no resolvable parent and the relation is required, stop and ask. If the relation is optional, create the page and report it as unlinked.

### 7. Write links back to source files

After successful page creation, update each synced source file with the returned Notion URL.

Default behavior:

- write the URL to `notion_ticket`
- if the field already exists, replace it
- keep the rest of the frontmatter unchanged

If the user wants a different field name, use that instead.

### 8. Report the result

Report:

- number of parent records created
- number of child records created
- which owners or assignees were applied
- which files were updated with Notion URLs
- any skipped files
- any failures or schema mismatches still needing manual action

## Project Input Checklist

Use this checklist when information is missing:

| Input | Example placeholder |
| --- | --- |
| Source path | `path/to/backlog/` |
| Allowed roots | `requirements/`, `docs/backlog/` |
| Parent database ID or URL | `{PARENT_DATABASE_ID_OR_URL}` |
| Child database ID or URL | `{CHILD_DATABASE_ID_OR_URL}` |
| Parent title property | `{PARENT_TITLE_PROPERTY}` |
| Child title property | `{CHILD_TITLE_PROPERTY}` |
| Relation property | `{RELATION_PROPERTY}` |
| Parent owner field | `{PARENT_OWNER_FIELD}` |
| Child assignee field | `{CHILD_ASSIGNEE_FIELD}` |
| Default parent owner | `{PARENT_OWNER_NAME}` |
| Default child assignee | `{CHILD_ASSIGNEE_NAME}` |
| URL backfill field | `notion_ticket` |
| Custom sync fields | `{FIELD_NAME -> DATABASE -> VALUE_SOURCE}` |

## Error Handling

| Problem | Action |
| --- | --- |
| Missing database ID or URL | Ask the user before proceeding |
| Unknown property name | Inspect the Notion schema and confirm |
| Unknown owner name | Resolve the user in Notion or ask for the ID |
| Invalid select value | Ask for the correct Notion option or agreed fallback |
| Custom field captured in bootstrap but unclear for this sync | Stop and clarify before creating pages |
| Existing Notion URL already present | Skip or overwrite only with user approval |
| Child cannot be linked to parent | Stop and ask if relation is required |
| Partial API failure | Continue where safe and report the failed records clearly |

## Example Trigger

User: "Sync the backlog in `requirements/payments/backlog/` to Notion."

Response flow:

1. Ask for the parent database, child database, property names, and owner names.
2. Authenticate Notion if needed.
3. Read the relevant markdown files.
4. Create parents first, then children.
5. Write the returned Notion URLs back into frontmatter.
6. Report what was created and what still needs attention.
