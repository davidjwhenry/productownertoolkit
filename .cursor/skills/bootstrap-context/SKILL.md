---
name: bootstrap-context
description: Capture company-specific setup details for this toolkit and write them into the canonical context file and starter docs. Use after cloning the repo, when setting up the toolkit for a new company, when replacing `{Company XYZ}` placeholders, or when the user asks to configure the repo for their organisation.
---

# Bootstrap Context

Use this skill for the initial post-clone setup pass.

## Workflow

1. Read `context/company-context.md` first.
2. Ask the user for the missing company defaults.
3. Normalize the answers into concise, reusable values.
4. Update `context/company-context.md` as the source of truth.
5. Update the obvious starter placeholders in key docs:
   - `examples/prd-reference-guide.md`
   - `examples/example-prd-internal-tool.md`
   - `examples/example-prd-customer-facing.md`
   - `README.md` only when setup instructions need to reflect the configured context
6. Stop after the initial setup pass. Do not try to rewrite the entire repo.

## Questions To Ask

Ask for:
- author name
- company name
- one-sentence company description
- primary product surface: `Web`, `Mobile`, `Internal tooling`, or `Mixed`
- operating geographies
- whether the company is in financial services
- if yes, licenses held
- if yes, regulators
- applicable data protection regimes
- standard tech stack
- default audience assumptions
- common integration points

Use `AskQuestion` for structured choices where useful. Keep the rest concise and practical.

## Update Rules

- Treat `context/company-context.md` as the canonical file.
- Prefer updating clearly labeled fields and bullets over freeform rewriting.
- Replace `{Company XYZ}` only in starter documents where it is clearly a placeholder.
- Do not replace example competitors, metrics, or product assumptions unless the user explicitly asks.
- If the user does not know a value, leave a clear placeholder rather than inventing one.

## Output Expectations

After updating files:
- summarize what was captured
- mention any fields still left as placeholders
- point the user to `context/company-context.md` for future edits
