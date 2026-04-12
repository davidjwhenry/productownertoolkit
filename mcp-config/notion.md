# Notion MCP

## Why add it

Use `Notion` when your team already stores PRDs, backlog items, meeting notes, or internal knowledge there and you want the repo to sync with that reality.

## Recommendation

Optional. Add it if Notion is part of your actual workflow. Skip it if you want to stay local-first.

## When you will use it

- reading internal context from Notion
- syncing markdown artefacts into Notion
- checking for drift between repo copies and live Notion pages

## Setup

Add this to `.cursor/mcp.json` or `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "notion": {
      "url": "https://mcp.notion.com/mcp"
    }
  }
}
```

1. Save the file and restart Cursor.
2. Use a Notion tool once and complete the OAuth flow.
3. Make sure the connected workspace has access to the databases or pages you need.
4. Run `bootstrap-context` and record whether your setup is `Notion-enabled` or `local-first`.

## Notes

- This uses Notion's hosted MCP server and does not require you to put an API secret in the file.
- If your client cannot use remote HTTP MCP servers directly, Notion also documents an `mcp-remote` bridge, but Cursor supports the direct URL form.
