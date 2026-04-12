# Product Owner Toolkit

An toolkit for Product Owners who want AI to carry the weight on research, notes, documentation, and stakeholder communication, without losing the judgement that makes POs good at the job. This isn't the absolute extreme of what you can do with AI, but it's filled with what I have learnt over the past two years with these tools, and my hope is that it can help Product Owner's looking to upskill, and move further into this world. When hiring for Product Owners recently I've noticed that many in Product as still struggling to truly "start", beyond doing some Deep Research on a topic and calling it a day.

So, welcome to the new world order. Markdown is your source of truth now, best get comfortable with # and * (Cursor 3.0 gives you a nice pre-integrated markdown previewer with editing at long last, at least!). Your LLM of choice does the synthesis of your thinking for you. Notion, or a similarly "friendly" markdown viewing / ticket track mechanism is where the work lands. You still own every document that leaves your virtual desk, but with this stack, you can experience a serious force multiplier of your brain power.

After cloning, the first step is to run the `bootstrap-context` skill. It captures your company name, stack, geographies, and regulatory context, writes them into `context/company-context.md`, and replaces the starter placeholders in the key docs.

## Two audiences, two entry points

If you're a PO or PM who wants to adopt this way of working, clone the repo. Everything you need is here.

If you're a stakeholder who just wants to see what it produces, the live examples are in the companion Notion space: [link coming soon]. This repo is the engine room. Notion, at least for now, is the showroom.

## The model: Sense, Synthesise, Ship

Every tool in this toolkit earns its place in one of three capability bands.

**Sense** — how information gets in.

- [Firecrawl MCP](./mcp-config/firecrawl.md) for external research and scraping
- [Notion MCP](./mcp-config/notion.md) for displaying internal knowledge, PRDs, tickets, meeting notes
- [GitHub MCP](./mcp-config/github.md) for shipping reality — PRs, commits, what actually went out
- [Meeting transcripts](./mcp-config/meetings.md) routed into Notion
- [Voice capture](./mcp-config/voice-capture.md) for thoughts that arrive away from the keyboard
- [Figma Dev Mode MCP](./mcp-config/figma.md) for design context inside your PRDs

**Synthesise** — where Claude, or your LLM of choice turns inputs into artefacts. [Skills](./skills/) are mirrored for Claude Code and Cursor. The post-clone setup skill lives in `.cursor/skills/bootstrap-context/` and `.claude/skills/bootstrap-context/`.

*Writing skills:*
- `bootstrap-context` — one-time post-clone setup for company defaults, placeholders, stack, and regulatory context
- `discovery-prep` — interview guides, hypothesis lists, and research plans before you talk to users
- `research-synthesis` — turn Firecrawl output and interview notes into a structured brief
- `prd-writer` — PRDs with context, scope, success metrics
- `backlog-writing` — user stories and acceptance criteria for engineering
- `design-backlog` — design tasks derived from PRDs and prototypes, ready for designers to refine
- `meeting-distillation` — extract decisions, actions, open questions from a transcript
- `weekly-review` — surface themes, blockers, stale items across your notes
- `stakeholder-report` — render any markdown artefact as a polished, brand-themed HTML report

*Review skills — the quality loop:*
- `prd-reviewer` — check a PRD for internal consistency
- `backlog-review` — check a backlog internally and against its parent PRD

*Sync skills — the bridge to Notion:*
- `notion-sync` — push markdown to Notion, write the page URL back to front matter
- `notion-drift` — read Notion, diff against local markdown, surface changes for reconciliation

**Ship** — where the work lands.

- Notion for PRDs, tickets, stakeholder-facing pages
- [Pencil](./mcp-config/pencil.md) for in-IDE prototypes, because specs aren't always enough
- HTML reports for anything a senior leader will actually open
- A `/design-system/` folder for brand tokens, voice, and components skills reference automatically

## Quality loops: review is a first-class step

The single biggest failure mode of AI-assisted PO work is plausible-sounding drift. A PRD reads fine. The backlog generated from it reads fine. Three sprints in, someone notices the acceptance criteria contradict a success metric, and trust collapses.

Every authoring skill has a paired review skill, and every workflow ends with a review pass. Reviews are structured, scannable, and traceable — not prose critique. The output is itself an artefact you can screenshot and share.

- `prd-reviewer` checks internal consistency: do the metrics match the scope, do the assumptions hold across sections, does the narrative justify the solution?
- `backlog-review` checks internal consistency *and* external consistency against the parent PRD: is every backlog item justified by something in the PRD, is there scope in the PRD the backlog doesn't cover?

See [`workflows/quality-loops.md`](./workflows/quality-loops.md) for the philosophy. Every example in [`/examples/`](./examples/) ships with its paired review output.

## The bridge: markdown source, Notion render, front matter link

Every artefact is a markdown file. When `notion-sync` pushes it to Notion, it writes the Notion URL back into the front matter.

```yaml
---
title: Q2 Discovery Brief — Onboarding Friction
type: research-brief
notion_url: https://notion.so/workspace/abc123
notion_last_synced: 2026-04-10T14:22:00Z
source_skill: research-synthesis
---
```

That pattern does a lot of work:

- **Git becomes the version history Notion doesn't have.** Proper diffs, blame, commit messages for every PRD.
- **The `/examples/` folder is self-documenting.** Click the front matter URL, land on the live rendered page.
- **Round-trip is real.** `notion-drift` reads the URL, fetches the current Notion state, and surfaces changes. Not auto-merge — a report you review and act on, because merge conflicts in prose aren't solvable by rules.

## Why not just do everything in Notion?

Notion is the centre of gravity here, but it's not the whole answer. Four reasons:

1. **Enterprise access isn't universal.** Plenty of POs work in environments where Notion isn't sanctioned, or where IT has locked the workspace down enough that MCP access isn't practical. The skills are portable — see [the local-first alternative](./adapters/local-first-alternative.md) for the Obsidian path.

2. **AI pricing is in flux.** Notion's AI pricing is shifting toward token-based billing, and the economics at scale aren't clear. Keep the heavy reasoning in Claude, which you're already paying for, rather than duplicating it inside Notion.

3. **Notion doesn't prototype.** PRDs are half the job now. Pencil closes the loop from spec to tangible artefact inside the same IDE. Notion has no equivalent.

4. **No skills primitive yet.** Notion is adding agents in beta, but it's missing the composability Claude Code skills give you: versioned, portable, testable instructions that travel with you across tools and jobs. Betting the workflow layer on a vendor roadmap is risky. Skills are yours.

## A note on the logical extreme

There is a logical extreme of this approach: no Notion, no PRDs as separate documents, no stakeholder reports as separate artefacts. Just markdown, prototypes, and backlogs. The repo *is* the product documentation. The prototype *is* the spec. The backlog *is* the plan.

Some POs can already work this way. Most can't — not because they don't want to, but because their organisations aren't ready. Enterprise tooling mandates, stakeholder expectations ("send me the doc"), regulated industries, leaders who won't open GitHub. These aren't bad reasons. They're the reality of the job.

This toolkit is a pragmatic bridge. It respects the world POs actually live in while pointing at where it's going. Notion is the translation layer. HTML reports are the handoff format. Markdown is the portable core that survives whatever comes next.

I'm moving toward the extreme version myself. This toolkit is what I use while most of the organisations I work with aren't ready yet.

## Skills I lean on from the wider ecosystem

This repo is intentionally small. It focuses on the PO-specific workflows I couldn't find elsewhere. For the general-purpose thinking work — brainstorming, design, research framing — I lean on skills built by others who do it better than I could.

- **Superpowers** (marketplace) — my go-to for brainstorming. When I need a thinking partner rather than a document generator, this is the skill I reach for. Pairs naturally with `research-synthesis` and early-stage `prd-writer`.
- **frontend-design** — turns a functional Pencil prototype into something you'd actually show a stakeholder. Essential for workflow `05-prd-to-prototype` — prototypes that look like AI slop destroy trust faster than no prototype at all.

Curation is the signal. If I add more, I'll add them deliberately.

## Repo structure

```
po-ai-toolkit/
├── README.md
├── context/
│   └── company-context.md
├── skills/
│   ├── writing/
│   │   ├── discovery-prep/
│   │   ├── research-synthesis/
│   │   ├── prd-writer/
│   │   ├── backlog-writing/
│   │   ├── design-backlog/
│   │   ├── meeting-distillation/
│   │   ├── weekly-review/
│   │   └── stakeholder-report/
│   ├── review/
│   │   ├── prd-reviewer/
│   │   └── backlog-review/
│   └── sync/
│       ├── notion-sync/
│       └── notion-drift/
├── adapters/
│   ├── claude-code/
│   ├── cursor/
│   └── local-first-alternative.md
├── mcp-config/
├── workflows/
│   ├── 01-discovery-to-prd.md
│   ├── 02-prd-to-design-backlog.md
│   ├── 03-prd-to-engineering-backlog.md
│   ├── 04-meeting-to-actions.md
│   ├── 05-prd-to-prototype.md
│   ├── 06-weekly-synthesis.md
│   └── quality-loops.md
├── conventions/
│   └── front-matter.md
├── design-system/
└── examples/
```

## Getting started

1. Clone the repo.
2. Run the `bootstrap-context` skill and fill in your company defaults in [`context/company-context.md`](./context/company-context.md).
3. Review the updated starter docs and confirm the placeholder replacements look right.
4. Install the MCPs you want from [`mcp-config/`](./mcp-config/). Start with Notion and Firecrawl.
5. Symlink or copy the skills into your Claude Code or Cursor config. See [`adapters/`](./adapters/).
6. Drop your brand tokens into [`design-system/`](./design-system/).
7. Run your first workflow. [`04-meeting-to-actions`](./workflows/04-meeting-to-actions.md) is the fastest way to feel the value.

## v1: human execution first

`v1` of this repo is deliberately focused on human execution of skills, not chaining them together through sub-agents.

That is intentional. The first step of using AI tools well is learning how they work. If you blindly deploy a sub-agent that does six things and you do not like the final output, tracing the failure takes too long. You need to know which step broke, which assumption drifted, and which prompt or context caused it.

AI is not an excuse to outsource thinking. It is a force multiplier for people who stay close enough to the work to judge it.

## Roadmap

- `competitive-teardown` — structured competitor analysis with feature matrix and positioning
- `roadmap-narrative` — turn a backlog plus strategy context into a quarterly story for leadership
- `retro-synthesis` — extract patterns across sprint retros, not just single sessions
- `design-backlog-review` — check design backlogs against PRDs *and* linked Pencil/Figma files
- Expanded adapters for Jira and Linear
- A public Notion companion space with every example rendered live

More coming soon:
- More agent memory and context loop tricks
- More strategy documentation templates
- Sub-agent workflows
