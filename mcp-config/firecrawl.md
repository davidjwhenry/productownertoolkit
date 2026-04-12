# Firecrawl MCP

## Why add it

Use `Firecrawl` for external research, competitor reviews, market scanning, and pulling structured content from the public web into your workflow.

## Recommendation

Recommended for almost everyone using this repo. It is the default research MCP.

## When you will use it

- discovery and market research
- competitor teardowns
- gathering external inputs before writing a PRD or brief

## Setup

Add this to `.cursor/mcp.json` or `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "firecrawl": {
      "command": "npx",
      "args": ["-y", "firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "your-firecrawl-api-key"
      }
    }
  }
}
```

1. Replace the API key placeholder with your real Firecrawl key.
2. Restart Cursor after saving the file.
3. Confirm the MCP is available before you start research-heavy work.

## Notes

- This is the current Firecrawl Cursor example from their docs.
- Firecrawl also supports a hosted URL-based setup, but the local `npx` form keeps the key out of the server URL.
