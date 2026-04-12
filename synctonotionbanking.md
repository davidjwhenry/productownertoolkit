# synctonotionbanking
description: Sync retail banking backlog markdown (Epics and User Stories) to the Mal Bank Banking Notion project. Allowed roots: Banking_Requirements/, Retail_Banking_Requirements/, and Mobile_App_Requirements/ (e.g. profile/settings mobile backlogs). Creates Roadmap Epics and Tasks (stories), linked via Project relation. PFM and Agentic_Requirements use a separate Notion project. Triggers on "sync banking backlog to Notion", "push epics to Notion", "sync this folder to Notion", or "upload banking stories to Notion".
---

# Notion Banking Backlog Sync

Sync backlog `.md` files from the **allowed retail banking trees** to the **Mal Bank Banking Notion project**, creating Roadmap entries (from Epics) and Tasks (from Stories) with proper relationships.

## Allowed source roots (use this skill only here)

| Path | Notes |
| --- | --- |
| `Banking_Requirements/` | Legacy path; still valid if present |
| `Retail_Banking_Requirements/` | Primary retail banking requirements tree after repo restructure |
| `Mobile_App_Requirements/` | Mobile-app-specific epics/stories (e.g. profile & settings) |

> **Out of scope:** PFM (`PFM_Requirements/`) and Agentic requirements (`Agentic_Requirements/`) sync to a **separate** Notion project — do not use this skill for those.

## Prerequisites

- Notion MCP server authenticated — call `notion-get-users` or `notion-fetch` to confirm. If it fails, call `mcp_auth` first.
- Roadmap and Tasks databases must be shared with the Notion integration.
- Source files must live under one of the **allowed source roots** above. For PFM or Agentic content, tell the user a separate skill/Notion project is required.

## BEFORE STARTING — Always Ask

**Before reading any files, ask the user:**

1. **Who should Epics be assigned to?** (Technical Lead on Roadmap; assign via Notion UI if the integration cannot set `people` fields)
2. **Who should User Stories be assigned to?** (Assignee field in Tasks) — can vary per story or epic group, so ask specifically (e.g., "Are all stories assigned to one person, or do specific stories go to different people?")

Use the `notion-get-users` tool to find user IDs by name if needed.

## Database Configuration

### Roadmap (Epics)
- **URL:** `https://www.notion.so/2fc6409321d981c289ecc2f02e9b5f86`
- **Data source ID:** `2fc64093-21d9-815a-b9b2-000bf6010485`
- **Key properties:**

| Property | Type | Notes |
| --- | --- | --- |
| `Project name` | title | Epic title — use format `EP-N: Title` |
| `Status` | status | Options: Backlog, Specing, Spec Review, In Progress, Paused, Done, Canceled |
| `Technical Lead` | person | Primary engineering owner (API: `people` array of user IDs). Legacy docs may say `Owner` — Roadmap uses **Technical Lead**. |
| `Priority` | select | Low, Medium, High |
| `Tags` | multi_select | Options: Tech Debt, Integration, Feature, Product, Tech Enhancement, Design QA |
| `Description` | text | Brief summary (1–2 sentences) |

### Tasks (User Stories)
- **URL:** `https://www.notion.so/2fc6409321d9818fa124efddda7dd0d7`
- **Data source ID:** `2fc64093-21d9-8185-b1d4-000b657c9a7a`
- **Key properties:**

| Property | Type | Notes |
| --- | --- | --- |
| `Task name` | title | Story title — use format `US-N.N: Title` |
| `Status` | status | Options: Backlog, In development, Ready for QA, In QA, Queued for release, Released, Archived |
| `Assignee` | person | JSON array of user IDs: `["user-id"]` |
| `Priority` | select | Low, Medium, High |
| `Tags` | multi_select | Options: Bug, New Functionality, Enhancement, Design QA |
| `Project` | relation | JSON array of Roadmap page URLs: `["https://www.notion.so/..."]` |

## Known Team Members

Fetch live IDs with `notion-get-users` if needed. Common members:

| Name | User ID |
| --- | --- |
| David Henry | `217d872b-594c-81d5-9137-00026b9668fd` |
| Omar Mouki | `304d872b-594c-8165-a2e7-0002d742ac9e` |
| Abhinav Singh | `2cbd872b-594c-8193-894d-0002cb75b54d` |
| Teimur Buniat | `2fbd872b-594c-81a0-92cd-00020dda7611` |
| Walid Adra | `21bd872b-594c-81f0-a0f2-00026ee77569` |
| Waill Tatari | `24ed872b-594c-8187-9c8f-0002b8f1aa6d` |

## Field Mappings

### Priority
| Backlog frontmatter | Notion value |
| --- | --- |
| P0 | High |
| P1 | Medium |
| P2 | Low |

### Status
| Backlog frontmatter | Notion Roadmap | Notion Tasks |
| --- | --- | --- |
| Draft | Backlog | Backlog |
| Backlog | Backlog | Backlog |
| Ready for Delivery | Spec Review | Backlog |
| In progress | In Progress | In development |
| Done | Done | Queued for release |

### Tags
- Epics: use `Feature` for new product work, `Tech Enhancement` for infrastructure/backend, `Tech Debt` for refactoring
- Stories: use `New Functionality` for new features, `Enhancement` for improvements, `Bug` for bug fixes

## Workflow

### Step 1 — Ask about assignees

Before reading any files, ask who should be the Technical Lead (epics) and Assignee (stories). Confirm if any stories have a different assignee from the default.

### Step 2 — Authenticate Notion MCP

```
notion-fetch: { "id": "https://www.notion.so/2fc6409321d981c289ecc2f02e9b5f86" }
```

If this fails, call `mcp_auth` first.

### Step 3 — Read all backlog files

Read all `EP-*.md` and `US-*.md` files from the target backlog directory in parallel.

### Step 4 — Fetch database schemas (if unsure of property names)

```
notion-fetch: { "id": "https://www.notion.so/2fc6409321d981c289ecc2f02e9b5f86" }
notion-fetch: { "id": "https://www.notion.so/2fc6409321d9818fa124efddda7dd0d7" }
```

### Step 5 — Create all Epics in Roadmap

Batch up to 3 Epics per `notion-create-pages` call. Store the returned page URLs mapped to each Epic ID.

**Parent:**
```json
{ "data_source_id": "2fc64093-21d9-815a-b9b2-000bf6010485" }
```

**Properties per Epic:**
```json
{
  "Project name": "EP-N: Epic Title",
  "Status": "Backlog",
  "Technical Lead": "[\"<user-id>\"]",
  "Priority": "High",
  "Tags": "[\"Feature\"]",
  "Description": "One-sentence summary from the epic Overview section."
}
```

**Content:** Full markdown body of the epic file (strip YAML frontmatter; do NOT repeat the title in content). Include: Overview, Business Value, Functional Scope, User Stories table, Dependencies, Success Metrics, Technical Considerations.

**Example call:**
```json
{
  "parent": { "data_source_id": "2fc64093-21d9-815a-b9b2-000bf6010485" },
  "pages": [
    {
      "properties": {
        "Project name": "EP-52: Investment Marketing and Discovery",
        "Status": "Backlog",
        "Technical Lead": "[\"217d872b-594c-81d5-9137-00026b9668fd\"]",
        "Priority": "High",
        "Tags": "[\"Feature\"]",
        "Description": "The marketing and discovery surface for Mal 786: a dashboard promotion card and full-screen Story Tabs component."
      },
      "content": "## Overview\n\n..."
    }
  ]
}
```

**Store returned URLs:** e.g., `EP-52 → https://www.notion.so/3106409321d9815194e4d4d4e8ef3586`

### Step 6 — Create all User Stories in Tasks

Batch up to 3 Stories per `notion-create-pages` call. Link each story to its parent Epic using the URL stored in Step 5.

**Parent:**
```json
{ "data_source_id": "2fc64093-21d9-8185-b1d4-000b657c9a7a" }
```

**Properties per Story:**
```json
{
  "Task name": "US-N.N: Story Title",
  "Status": "Backlog",
  "Assignee": "[\"<user-id>\"]",
  "Priority": "High",
  "Tags": "[\"New Functionality\"]",
  "Project": "[\"https://www.notion.so/<epic-page-id>\"]"
}
```

**Content:** Full markdown body of the story file (strip YAML frontmatter; do NOT repeat the title). Include: User Story, Description, User Flow, Acceptance Criteria, UI/UX Notes, Technical Notes, Edge Cases, Tracking.

**Example call:**
```json
{
  "parent": { "data_source_id": "2fc64093-21d9-8185-b1d4-000b657c9a7a" },
  "pages": [
    {
      "properties": {
        "Task name": "US-52.1: Investment Promotion Card",
        "Status": "Backlog",
        "Assignee": "[\"304d872b-594c-8165-a2e7-0002d742ac9e\"]",
        "Priority": "High",
        "Tags": "[\"New Functionality\"]",
        "Project": "[\"https://www.notion.so/3106409321d9815194e4d4d4e8ef3586\"]"
      },
      "content": "## User Story\n\nAs a Mal Bank customer..."
    }
  ]
}
```

### Step 7 — Write `notion_ticket` back to source files

After all pages are created, update the YAML frontmatter of each synced `.md` file to add a `notion_ticket` field pointing to the created Notion page URL. Add the field after the last existing frontmatter line, before the closing `---`.

**For each Epic:**
```yaml
notion_ticket: https://www.notion.so/<epic-page-id>
```

**For each User Story:**
```yaml
notion_ticket: https://www.notion.so/<story-page-id>
```

Use the returned page URLs from Steps 5 and 6. If a file already has a `notion_ticket` field, replace its value with the new URL.

### Step 8 — Report results

After sync, report:
- Number of Epics created (with Notion links)
- Number of Stories created
- Confirmation that `notion_ticket` was written to all source files
- Any errors or skipped files
- Confirmation of assignees set correctly

## Critical Notes

- **Person fields** (`Technical Lead`, `Assignee`, …) must use API-native `people` arrays (Notion MCP may use JSON string form). Some internal integrations cannot resolve workspace user IDs — assign people in the Notion UI after sync if API returns a user error.
- **Relation fields** (`Project`) must be a JSON array string of full Notion page URLs: `"[\"https://www.notion.so/...\"]"`
- **Do NOT include the page title** in the `content` field — it is set via `properties` only
- **Batch size:** Max 3 pages per call to avoid JSON size issues
- **Create all Epics first**, then create Stories (you need the Epic page URLs for the `Project` relation)
- **Fetch the markdown spec** at `notion://docs/enhanced-markdown-spec` if you need to use advanced Notion markdown features (tables, callouts, toggles)

## Example Usage

User: "Sync the `Retail_Banking_Requirements/payments` backlog to Notion" (or `Mobile_App_Requirements/profile_and_settings/backlog`, or `Banking_Requirements/...`)

1. Confirm the path is under `Banking_Requirements/`, `Retail_Banking_Requirements/`, or `Mobile_App_Requirements/` — otherwise stop and point to the correct Notion project for PFM/Agentic
2. Ask who the Epic Technical Lead and Task Assignee(s) should be
3. Read all `EP-*.md` and `US-*.md` files from the backlog directory
4. Create all Epics in Roadmap (batches of 3), store returned page URLs
5. Create all Stories in Tasks (batches of 3), linked to parent Epics via `Project` relation
6. Write `notion_ticket` URL back into the YAML frontmatter of each source `.md` file
7. Report: "Created X Epics and Y Stories in Notion. All linked, assigned, and source files updated."

## Error Handling

| Error | Action |
| --- | --- |
| Missing `epic` frontmatter on a story | Create story without `Project` relation; warn user |
| Invalid priority | Default to Medium |
| Invalid status | Default to Backlog |
| API error on a page | Log the error, continue with remaining files, report failures at end |
| MCP not authenticated | Call `mcp_auth` and retry |

## Synced Backlogs — Reference

Previous syncs from allowed roots (historically mostly `Banking_Requirements/`) are recorded below. Check before syncing to avoid duplicates.

### Wealth Management Backlog — Reference

Path: `Banking_Requirements/wealth_management/backlog/` (or `Retail_Banking_Requirements/wealth_management/backlog/` if migrated) — synced February 23, 2026.

### Roadmap (Epics)
| Epic | Notion URL |
| --- | --- |
| EP-52: Investment Marketing and Discovery | https://www.notion.so/3106409321d9815194e4d4d4e8ef3586 |
| EP-53: Product Information Screen | https://www.notion.so/3106409321d981a48c34e44846d37ae5 |
| EP-54: Investment Purchase Flow | https://www.notion.so/3106409321d981269159f41ffed379c0 |
| EP-55: Investment Portfolio Dashboard | https://www.notion.so/3106409321d9812cad11e02f53de2f1d |
| EP-56: Early Redemption | https://www.notion.so/3106409321d981c18cb0fb72f71915de |
| EP-57: Investment Product Configuration | https://www.notion.so/3106409321d9810eab36fe784bd85558 |

### Tasks (User Stories)
| Story | Assignee | Notion URL |
| --- | --- | --- |
| US-52.1: Investment Promotion Card | Omar Mouki | https://www.notion.so/3106409321d981b99816eab98ec743b2 |
| US-52.2: Story Tab Component | Omar Mouki | https://www.notion.so/3106409321d9810ca1f0e1828881e683 |
| US-52.3: Mal 786 Story Content | Omar Mouki | https://www.notion.so/3106409321d98186af6eef36e88517af |
| US-53.1: Product Header and Slider | Omar Mouki | https://www.notion.so/3106409321d981e68821e931592d4fa5 |
| US-53.2: Coupon Schedule and Timeline | Omar Mouki | https://www.notion.so/3106409321d98161a3fad1b426816f34 |
| US-53.3: Pool Progress and FAQ | Omar Mouki | https://www.notion.so/3106409321d98127a4a7ec22a732cad6 |
| US-54.1: Review and Legal Agreements | Omar Mouki | https://www.notion.so/3106409321d981bf91c0f171cb004217 |
| US-54.2: Account Opening and Fund Transfer | Omar Mouki | https://www.notion.so/3106409321d98189b0b2c6f1667dc17b |
| US-54.3: Investment Confirmation | Omar Mouki | https://www.notion.so/3106409321d9812ca209dd8d5e9f6a75 |
| US-55.1: Portfolio Summary | Omar Mouki | https://www.notion.so/3106409321d9816798f2c41b195190e4 |
| US-55.2: Coupons and Transactions | Omar Mouki | https://www.notion.so/3106409321d981f08cb6fa4796507e26 |
| US-55.3: Portfolio Allocation | Omar Mouki | https://www.notion.so/3106409321d981088b7ad9bcb1301f4a |
| US-56.1: Redemption Flow | Omar Mouki | https://www.notion.so/3106409321d98110bf39eb99787e3e36 |
| US-56.2: Redemption Confirmation | Omar Mouki | https://www.notion.so/3106409321d98179a3cec2ac5fec4372 |
| US-57.1: Product Config Table | Abhinav Singh | https://www.notion.so/3106409321d9813b9e9ac200a0753383 |
| US-57.2: Pool Capacity Management | Abhinav Singh | https://www.notion.so/3106409321d981f3ac69d89ef6663880 |
