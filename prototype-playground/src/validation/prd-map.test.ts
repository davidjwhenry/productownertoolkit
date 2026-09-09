import { describe, expect, it } from 'vitest'
import { parsePrdMap, slugifyHeading } from './prd-map'

const PRD = `---
title: Demo
notion_url: https://example.notion.dev/Demo-PRD-abc123
---

# Demo PRD

Preamble mentioning AF.9 before any section.

## 5. Functional Requirements

### 5.1. Automated Funding

| ID | Requirement |
| --- | --- |
| AF.1 | Enable recurring contributions. |
| AF.2 | Enable card round-ups. |

\`\`\`mermaid
flowchart TD
  A[A heading # 9.9. Fake] --> B
\`\`\`

### 5.2. Progress

PM.1 Display each pot.

## 6. Entry Points

No requirement IDs here.
`

describe('parsePrdMap', () => {
  it('maps numbered headings to sections with anchors and requirement IDs', () => {
    const map = parsePrdMap(PRD)
    expect(map.url).toBe('https://example.notion.dev/Demo-PRD-abc123')
    const sections = map.sections.map((section) => [section.section, section.heading, section.anchor])
    expect(sections).toEqual([
      ['5', 'Functional Requirements', '5-functional-requirements'],
      ['5.1', 'Automated Funding', '51-automated-funding'],
      ['5.2', 'Progress', '52-progress'],
      ['6', 'Entry Points', '6-entry-points'],
    ])
    const funding = map.sections.find((section) => section.section === '5.1')
    expect(funding?.requirementIds).toEqual(['AF.1', 'AF.2'])
    expect(map.sections.find((section) => section.section === '6')?.requirementIds).toEqual([])
  })

  it('ignores requirement IDs outside numbered sections and inside fenced code', () => {
    const map = parsePrdMap(PRD)
    const every = map.sections.flatMap((section) => section.requirementIds)
    expect(every).not.toContain('AF.9')
    expect(every).not.toContain('9.9')
  })

  it('returns an empty section list for unnumbered markdown', () => {
    const map = parsePrdMap('# Just a title\n\nAF.1 prose\n')
    expect(map.sections).toEqual([])
    expect(map.url).toBeNull()
  })
})

describe('slugifyHeading', () => {
  it('produces GitHub-style slugs', () => {
    expect(slugifyHeading('Controls & Transparency')).toBe('controls-transparency')
  })
})
