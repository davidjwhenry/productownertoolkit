# Company Context

This file is the canonical source of company-specific defaults for this toolkit.

Run the `bootstrap-context` skill after cloning the repo, then replace the starter values below. Future skills should read this file when they need company, stack, geography, audience, regulatory, tracking, team, or business context.

## Company Overview

- **Company name:** `{Company XYZ}`
- **Company description:** `[One sentence on what the company does]`
- **Primary product surface:** `[Web | Mobile | Internal tooling | Mixed]`

## Author Defaults

- **Default author name:** `[Your name]`
- **Default team or function:** `[Optional]`

## Delivery And Tracking

- **Primary documentation home:** `[Markdown repo | Notion | Mixed | Other]`
- **Primary backlog tracking system:** `[Local markdown | Notion | Jira | Linear | Mixed]`
- **Uses Notion for working artefacts:** `[Yes/No]`
- **If yes, Notion workspace or team space:** `[Optional]`
- **If yes, PRDs tracked in:** `[Database URL or write None]`
- **If yes, Epics tracked in:** `[Database URL or write None]`
- **If yes, Stories tracked in:** `[Database URL or write None]`
- **If yes, default Notion project IDs by workstream:** `[Project name -> ID, or write None]`
- **If yes, custom Notion fields to pass during sync:** `[Field name -> target database, expected value source, or write None]`
- **If no, local-first note:** `[Where PRDs, Epics, and Stories should stay instead]`

## Operating Geographies

- `[Primary country or region]`
- `[Additional country or region]`

## Regulatory Context

- **Financial services company:** `[Yes/No]`
- **Licenses held:** `[List licenses or write None]`
- **Regulators:** `[List regulators or write None]`
- **Other regulatory obligations:** `[Optional]`

## Data Protection Regimes

- `[Applicable regime, e.g. GDPR]`
- `[Applicable regime, e.g. UK GDPR]`
- `[Applicable regime, e.g. CCPA/CPRA]`

## Standard Tech Stack

- **Frontend:** `[e.g. React Native, React, Swift]`
- **Backend:** `[e.g. TypeScript microservices, Python, Go]`
- **Database:** `[e.g. PostgreSQL, MySQL]`
- **Cloud:** `[e.g. AWS, GCP, Azure and region]`
- **Architecture:** `[e.g. Microservices, Monolith]`
- **Other core platforms:** `[Optional]`

## Default Audience Assumptions

- `[Primary customer or user segment]`
- `[Geographic or demographic qualifier]`
- `[Behavioral or channel qualifier]`

## Common Integration Points

- `[Core system or platform]`
- `[Authentication or identity provider]`
- `[Notifications or messaging platform]`
- `[Analytics, CRM, or support platform]`

## Team Context

| Name | Title | Notes |
| --- | --- | --- |
| `[Name]` | `[Title]` | `[What they care about, decision style, constraints, or blank]` |
| `[Name]` | `[Title]` | `[What they care about, decision style, constraints, or blank]` |

## Current Business Context

- **Org goals for the next period:** `[Top goals, one per bullet or sentence]`
- **Team goals for the next period:** `[Top goals, one per bullet or sentence]`
- **Known constraints or sensitivities:** `[Deadlines, compliance pressure, cost focus, stakeholder dynamics, or write None]`
- **Anything especially important for product work:** `[Optional]`

## Placeholder Mapping

- `{Company XYZ}` -> `[Actual company name]`
- `Author: [Name]` -> `Author: [Default author name]`

## Notes For Future Skills

- Read this file before drafting PRDs, review documents, backlog outputs, or sync steps that depend on company context.
- If `Uses Notion for working artefacts` is `No`, keep the workflow local-first and do not imply that Notion sync is part of the default path.
- Treat this file as the source of truth unless the user gives more specific instructions in the current task.
