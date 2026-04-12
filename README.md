# Product Owner Toolkit

A toolkit for Product Owners who want AI to carry more of the load across research, notes, documentation, and stakeholder communication without losing the judgement that makes you good at the job. It reflects what I have learnt over the past two years using these tools in practice, and it is meant to help Product Owners who want to upskill and move further into this world. When hiring for Product Owners recently, I've noticed that many still struggle to truly "start" with what is possible beyond doing some Deep Research on a topic and calling it a day.

So, welcome to the new world order. In this repo, markdown becomes your source of truth, so it helps to get comfortable with `#` and `*` as early as possible. Cursor 3.0 at least gives you a decent integrated markdown previewer and editor. Your LLM of choice helps synthesise your thinking. Notion, or another friendly markdown and ticket-tracking tool, can be where the work lands for stakeholder review and alignment, while the repo still supports a local-first setup if you are working solo. You still own every document that leaves your virtual desk, but this stack gives you a serious force multiplier.

After cloning, do two setup steps first: connect the MCPs you expect to use, then run the `bootstrap-context` skill. For most people that means `Firecrawl MCP` for research and `Pencil MCP` for prototyping. Add `Notion MCP` if your team uses Notion for PRDs, tickets, or notes, and consider `Figma Dev Mode MCP` if design context matters in your workflow. Then run `bootstrap-context`: it captures your company name, stack, geographies, regulatory context, delivery workflow, team context, and current business goals, writes them into `context/company-context.md`, and replaces the starter placeholders in the key docs.

## Two audiences, two entry points

If you're a PO or PM who wants to adopt this way of working, clone the repo. Everything you need is here.

If you're a stakeholder who just wants to see what it produces, the live examples are in the companion Notion space: [link coming soon]. This repo is the engine room. Notion, at least for now, is the showroom.

## The model: Sense, Synthesise, Ship

Every tool in this toolkit earns its place in one of three capability bands.

**Sense** — how information gets in.

- [Firecrawl MCP](./mcp-config/firecrawl.md) for external research and scraping
- [Notion MCP](./mcp-config/notion.md) for displaying internal knowledge, PRDs, tickets, and meeting notes when your team uses Notion
- [GitHub MCP](./mcp-config/github.md) for shipping reality — PRs, commits, what actually went out
- [Figma Dev Mode MCP](./mcp-config/figma.md) for design context inside your PRDs

**Synthesise** — where Claude, or your LLM of choice turns inputs into artefacts. [Skills](./skills/) are mirrored for Claude Code and Cursor. The post-clone setup skill lives in `.cursor/skills/bootstrap-context/` and `.claude/skills/bootstrap-context/`.

*Writing skills:*
- `bootstrap-context` — one-time post-clone setup for company defaults, placeholders, stack, and regulatory context
- `research-synthesis` — turn Firecrawl output and interview notes into a structured brief
- `prd-writer` — PRDs with context, scope, success metrics
- `backlog-writing` — user stories and acceptance criteria for engineering
- `meeting-distillation` — extract decisions, actions, open questions from a transcript
- `weekly-review` — surface themes, blockers, stale items across your notes
- `stakeholder-report` — render any markdown artefact as a polished, brand-themed HTML report

*Review skills — the quality loop:*
- `prd-reviewer` — check a PRD for internal consistency
- `backlog-review` — check a backlog internally and against its parent PRD

*Sync skills — the optional bridge to Notion:*
- `notion-sync` — push markdown to Notion, write the page URL back to front matter
- `notion-drift` — read Notion, diff against local markdown, surface changes for reconciliation

**Ship** — where the work lands.

- Notion, if you use it, for PRDs, tickets, and stakeholder-facing pages
- [Pencil](./mcp-config/pencil.md) for in-IDE prototypes, because specs aren't always enough (also download the desktop app from their website - it's very fun to watch AI do it's thing)
- HTML reports for anything a senior leader will actually open
- A `/design-system/` folder for brand tokens, voice, and components skills reference automatically

## Quality loops: review is a first-class step

The single biggest failure of AI-assisted PO work is plausible-sounding drift. A PRD reads fine. The backlog generated from it reads fine. Three sprints in, someone notices the acceptance criteria contradict a success metric, and trust collapses. You get accused of producing slop (I've been there).

There are two solves here. First, each key authoring skill has a paired review skill, and the intended flow ends with a review pass. Reviews are structured, scannable, and traceable — not prose critique. The output is itself an artefact you can screenshot and share. For example:

- `prd-reviewer` checks internal consistency: do the metrics match the scope, do the assumptions hold across sections, does the narrative justify the solution?
- `backlog-review` checks internal consistency *and* external consistency against the parent PRD: is every backlog item justified by something in the PRD, is there scope in the PRD the backlog doesn't cover?

Second, you. You are the quality gate that matters. You can produce content 100x faster than before, but do not think you don't need to read it still. You do.

## The bridge: markdown source, Notion render, front matter link

Every artefact is a markdown file. If `notion-sync` pushes it to Notion, it writes the Notion URL back into the front matter.

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

Notion is the art gallery in my current workflow, and their AI is coming along very well, but it's not the whole answer. Four reasons:

1. **Enterprise access isn't universal.** Plenty of POs work in environments where Notion isn't sanctioned, or where IT has locked the workspace down enough that MCP access isn't practical. The skills are still portable, even if you keep the workflow local-first.

2. **AI pricing is in flux.** Notion's AI pricing is shifting toward token-based billing, and the economics at scale aren't clear. Keep the heavy reasoning in Claude or Cursor, which are more likely to be sanctioned as part of a corporate stack, and have a lot more clear pricing today (Q2 2026).

3. **Notion doesn't prototype.** PRDs are half the job now. Pencil closes the loop from spec to tangible artefact inside the same IDE. Notion has no equivalent.

4. **No skills primitive yet.** Notion is adding agents in beta, but it's missing the composability Claude Code or Cursor skills give you: versioned, portable, testable instructions that travel with you across tools and jobs. Betting the workflow layer on a vendor roadmap is risky. Skills are yours.

## A note on the logical extreme

There is a logical extreme of this approach: no Notion. Just Git, markdown, prototypes, and backlogs. The repo *is* the product documentation. The prototype *is* the spec. The backlog *is* the plan.

Some POs can already work this way. If you're in an organisation that allows for this, then congratulations, you are in the top 1%. Most can't — not because they don't want to, but because their organisations aren't ready. Enterprise tooling mandates, stakeholder expectations ("send me the doc"), regulated industries, leaders who won't open GitHub. These aren't bad reasons. They're the reality of the job of Product. It's not one size fits all, and seeing how some firms are able to run can be demotivating to those of you still plugging away trying to get Microsoft Copilot approved for use (again, been there).

This toolkit is a pragmatic bridge. It respects the world POs actually live in while pointing at where it's going. Notion is the translation layer. HTML reports are the handoff format. Markdown is the portable core that survives whatever comes next.

I'm moving toward the extreme version myself, but in financial services with regulators, committees, and a dozen stakeholders, it's a...journey. This toolkit is what I use while most of the organisations I work with aren't ready yet.

## Skills I lean on from the wider ecosystem

This repo is intentionally small. It focuses on the PO-specific skills I actually use. There are lots of great resources out there: some are scary, and some focus too much on truly "outsourcing thinking" to massive sub-agent flows. That said, I've cloned a lot, bought a lot, and played with enough to find some absolute gems, and some of that influence has fed back into this repo. People like Aakash Gupta and Lenny Rachitsky always help keep me up to date (and Aakash's repo is also worth a look).

Some of the must-have marketplace items for Claude, if you are brave and work in the terminal, would be:

- **Superpowers** (marketplace) — my go-to for brainstorming. When I need a thinking partner rather than a document generator, this is the skill I reach for. Pairs naturally with `research-synthesis` and early-stage `prd-writer`.
- **frontend-design** — makes your HTML files look good, your prototypes sharper, and generally helps you produce work that feels less "AI-like".

Explore, learn, add more, but don't *panic*. There's a temptation to jump on every new tool (again, done it, got that t-shirt and a graveyard of $20 subscriptions to prove it). The world is evolving every day, and so it feels like you'll get left behind if you don't run openclaw on your smart fridge. You won't. If you can master the work in this repo, based on my interviewing experience (not in the bowels of Silicon Valley, in the real world), you'd be in the top 1% globally.

## Repo structure

```
po-ai-toolkit/
├── README.md
├── context/
│   └── company-context.md
├── skills/
│   ├── writing/
│   │   ├── research-synthesis/
│   │   ├── prd-writer/
│   │   ├── backlog-writing/
│   │   ├── meeting-distillation/
│   │   ├── weekly-review/
│   │   └── stakeholder-report/
│   ├── review/
│   │   ├── prd-reviewer/
│   │   └── backlog-review/
│   └── sync/
│       ├── notion-sync/
│       └── notion-drift/
├── mcp-config/
├── conventions/
│   └── front-matter.md
├── design-system/
└── examples/
```

## Getting started

1. Clone the repo.
2. Connect the recommended MCPs from [`mcp-config/`](./mcp-config/): start with `Firecrawl` and `Pencil`, add `Notion` if your team uses it, and add `Figma` if you want design context in the repo.
3. Run the `bootstrap-context` skill and fill in your company defaults in [`context/company-context.md`](./context/company-context.md).
4. Review the updated starter docs and confirm the placeholder replacements and workflow defaults look right.
5. Add the skills to your Claude Code or Cursor setup using your preferred local config approach.
6. Drop your brand tokens into [`design-system/`](./design-system/).
7. Run your first skill. `meeting-distillation` is the fastest way to feel the value.

## v1: human execution first

`v1` of this repo is deliberately focused on human execution of skills, not chaining them together through sub-agents.

That is intentional. The first step of using AI tools well is learning how they work. If you blindly deploy a sub-agent that does six things and you do not like the final output, tracing the failure takes too long. You need to know which step broke, which assumption drifted, and which prompt or context caused it.

AI is not an excuse to outsource thinking. It is a force multiplier for people who stay close enough to the work to judge it.

## Roadmap

- `competitive-teardown` — structured competitor analysis with feature matrix and positioning
- `roadmap-narrative` — turn a backlog plus strategy context into a quarterly story for leadership
- `retro-synthesis` — extract patterns across sprint retros, not just single sessions
- A public Notion companion space with every example rendered live

More coming soon:
- More agent memory and context loop tricks
- More strategy documentation templates
- Sub-agent workflows
