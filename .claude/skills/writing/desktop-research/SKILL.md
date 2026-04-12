---
name: desktop-research
description: >
  Conduct structured desktop research on a product, feature, service, or market using Firecrawl
  to gather and synthesise information from the web. Use when asked to research, investigate,
  analyse, or gather market intelligence on a topic before writing a PRD, brief, or strategy
  document. Supports source targeting (Reddit, G2, Capterra, blogs, news, competitor sites, etc.)
  and produces a standardised research report. Trigger phrases include "research X", "find out
  what people think about X", "do market research on X", "look into X", "gather competitor intel
  on X", "what does the market say about X".
---

# Desktop Research

Conduct focused web research using Firecrawl to build a factual, synthesised view of a product, feature, service, or market. Produces a standardised research report ready to inform a PRD, strategy brief, or discovery session.

## References

- **[references/output-format.md](references/output-format.md)** — Required output template. Read this before writing the final report.
- **[references/source-guide.md](references/source-guide.md)** — Source type definitions, what each reveals, and recommended Firecrawl search strategies per source type.

## Workflow

### 1. Clarify the research brief

Ask the user for:

- **Topic** — what product, feature, service, or market to research (required)
- **Research goal** — why they are researching it (e.g. pre-PRD discovery, competitive teardown, validation of a hypothesis, understanding user pain points)
- **Source preferences** — which source types to prioritise (see source menu below); default to a balanced mix if not specified

Present this source menu and ask the user to select or confirm:

```
Source types available:
  [1] Community & social   — Reddit, Hacker News, Product Hunt
  [2] Review sites         — G2, Capterra, Trustpilot, Gartner Peer Insights
  [3] News & analyst       — TechCrunch, VentureBeat, industry press, analyst blogs
  [4] Competitor sites     — Direct competitor product pages, pricing, positioning
  [5] Company blogs        — Official product blogs, release notes, engineering posts
  [6] Academic / research  — Studies, papers, surveys (where available)

Default if no preference: [1], [2], [3], [4]
```

Read **[references/source-guide.md](references/source-guide.md)** for search strategies and what each source type reveals.

### 2. Confirm scope before searching

Before starting, confirm with the user:

- Topic and goal
- Selected source types
- Any specific competitors, products, or angles to include or exclude
- Depth: quick scan (3–5 sources) or thorough (8–12+ sources)

Do not begin searching until scope is confirmed.

### 3. Execute research with Firecrawl

Before calling any Firecrawl MCP tool:

- Inspect the installed Firecrawl MCP tool schema/descriptor first
- Authenticate if the server exposes `mcp_auth`
- If Firecrawl is unavailable, stop and report the setup blocker instead of silently switching methods

Use the available Firecrawl search and scrape tools to gather information.

**Search strategy:**

- Run targeted queries per source type (see [references/source-guide.md](references/source-guide.md))
- Use site-scoped searches where appropriate (e.g. `site:reddit.com <topic>`, `site:g2.com <product>`)
- Vary keyword phrasing: include the product name, category terms, pain point language, and competitor names
- For review sites, target both positive and critical reviews
- Prefer recent sources unless historical context is part of the brief
- Capture: direct quotes, recurring themes, specific feature mentions, sentiment signals, data points

Run multiple searches — a single query is rarely sufficient. Aim for breadth across source types before synthesising.

Keep a lightweight evidence log while researching:

- Source type
- Source name or URL
- Publication date if available
- 1–2 takeaway notes
- Any quote or statistic worth citing later

### 4. Synthesise findings

Before writing the report:

- Identify the 3–5 strongest themes across all sources
- Note which themes appear across multiple source types (cross-source signal = stronger signal)
- Flag where sources conflict or where evidence is thin
- Collect direct quotes that best illustrate each theme
- Note any data points, statistics, or benchmarks found

### 5. Write the research report

Read **[references/output-format.md](references/output-format.md)** and produce the standardised report. Apply these writing standards:

- Lead with the most strategically useful finding, not a description of methodology
- Cite sources inline (URL or site name + date where available)
- Use direct quotes sparingly — only where they add signal, not flavour
- Flag weak or single-source evidence explicitly
- Do not editorialise beyond what the sources support
- Keep the tone neutral and factual; the reader will draw product conclusions
