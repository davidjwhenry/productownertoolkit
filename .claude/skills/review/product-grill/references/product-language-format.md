# Product Language Format

`context/product-language.md` stores durable product and domain language for this repo. It helps skills challenge ambiguous terms, keep PRDs consistent, and avoid re-litigating vocabulary across backlog, research, and stakeholder artifacts.

## Purpose

Use this file for shared product language that changes how requirements should be interpreted.

Good candidates:

- product-specific actors, such as **Customer**, **Member**, **Operator**, or **Approver**
- product-specific objects, such as **Case**, **Pot**, **Application**, or **Request**
- product-specific states, such as `Submitted`, `Verified`, `Approved`, or `Closed`
- terms that are often confused, overloaded, or used differently by stakeholders
- canonical terms that should replace aliases or local shorthand

Do not add:

- generic product-management terms like MVP, roadmap, backlog, or stakeholder
- implementation details that belong in technical docs
- one-off PRD assumptions
- speculative language that has not been confirmed
- personal preferences, which belong in `context/preferences.md`

## Structure

Use this structure:

```markdown
# Product Language

Canonical product and domain language used across this toolkit.

## Terms

**Customer**  
A person or organization that holds a direct relationship with the product.
_Avoid:_ User, client, account

**Operator**  
An internal user who handles exceptions, reviews, or support workflows.
_Avoid:_ Admin, agent, staff

## States

**`Submitted`**  
The request has been sent by the customer but has not yet been reviewed.
_Avoid:_ Sent, created, raised

## Relationships

- A **Customer** may create one or more **Requests**.
- A **Request** may be reviewed by one **Operator**.

## Example Dialogue

> **PM:** "When a **Customer** submits a **Request**, does an **Operator** always review it?"  
> **Domain expert:** "No. Only high-risk requests require operator review. Low-risk requests can be automatically approved."

## Flagged Ambiguities

- `account` was used to mean both **Customer** and product account. Resolved: use **Customer** for the person or organization, and define a separate product account term only when needed.
```

## Rules

- **Be opinionated.** Pick one canonical term and list aliases or tempting alternatives under `_Avoid:_`.
- **Keep definitions tight.** One sentence is usually enough. Define what the thing is, not every behavior it supports.
- **Separate states from actors and objects.** Put lifecycle states under `## States` and format them with backticks when they are system-like labels.
- **Show relationships.** Use relationship bullets to clarify cardinality or ownership when it affects requirements.
- **Use example dialogue sparingly.** Add dialogue only when it clarifies how terms interact in realistic product discussion.
- **Flag ambiguity explicitly.** When a term was overloaded, record the resolution in `## Flagged Ambiguities`.
- **Avoid implementation detail.** Product language is not the place for endpoints, database fields, package names, or internal architecture.
- **Do not silently overwrite.** If an existing term conflicts with a new usage, ask the user which meaning should win before editing.

## Update Behavior

During `product-grill`:

1. Read `context/product-language.md` if it exists.
2. When the user resolves a durable term, propose the exact language to add or change.
3. Update the file once the user confirms the wording or the confirmation is clear from the conversation.
4. Keep edits small and local. Do not reorganize the whole file unless the user asks.
