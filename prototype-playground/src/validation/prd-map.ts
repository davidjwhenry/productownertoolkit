/**
 * Parse a feature PRD into the section map the playground consumes:
 * numbered headings (`## 5.1. Automated Funding`) to heading text,
 * a hosted-copy anchor, and the requirement IDs (`AF.1`) mentioned in
 * the section body. The frontmatter `notion_url` (or `url`) becomes the
 * hosted-copy base. Fenced code blocks are skipped. Pure and total: any
 * Markdown yields a map, possibly with no sections.
 */
import type { PrdMap } from '../contracts'

const FRONTMATTER_URL = /^(?:notion_url|url):\s*(\S+)\s*$/
const NUMBERED_HEADING = /^(#{1,6})\s+(\d+(?:\.\d+)*)\.?\s+(\S.*)$/
const REQUIREMENT_ID = /\b[A-Z]{1,5}\.\d+\b/g

/** GitHub/Notion-style slug of a heading line. */
export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function frontmatterUrl(markdown: string): string | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)
  if (!match || match[1] === undefined) return null
  for (const line of match[1].split(/\r?\n/)) {
    const url = FRONTMATTER_URL.exec(line)
    if (url && url[1] !== undefined) return url[1]
  }
  return null
}

/** Parse the PRD section map: sections in document order with their requirement IDs. */
export function parsePrdMap(markdown: string): PrdMap {
  const sections: PrdMap['sections'] = []
  let current: { section: string; heading: string; anchor: string; requirementIds: string[] } | null = null
  let fenced = false

  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
      continue
    }
    if (fenced) continue
    const heading = NUMBERED_HEADING.exec(line)
    if (heading && heading[2] !== undefined && heading[3] !== undefined) {
      const section = heading[2]
      const title = heading[3].trim()
      current = { section, heading: title, anchor: slugifyHeading(`${section}. ${title}`), requirementIds: [] }
      sections.push(current)
      continue
    }
    if (current === null) continue
    for (const id of line.matchAll(REQUIREMENT_ID)) {
      if (id[0] !== undefined && !current.requirementIds.includes(id[0])) current.requirementIds.push(id[0])
    }
  }

  return { url: frontmatterUrl(markdown), sections }
}
