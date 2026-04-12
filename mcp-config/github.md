# GitHub MCP

## Why add it

Use `GitHub` when you want the toolkit to stay closer to delivery reality: pull requests, shipped changes, issue context, and repo history.

## Recommendation

Optional. Useful for teams that want product documentation, backlog thinking, and shipping context connected in one place.

## When you will use it

- checking what actually shipped
- reviewing pull requests or implementation context
- linking product decisions back to delivery evidence

## Setup

Add this to `.cursor/mcp.json` or `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer YOUR_GITHUB_PAT"
      }
    }
  }
}
```

1. Replace `YOUR_GITHUB_PAT` with a GitHub personal access token.
2. Save the file and restart Cursor.
3. Make sure the token can access the repositories you need.
4. Keep it connected if you want product and engineering context side by side.

## Notes

- This is GitHub's current recommended Cursor setup using their hosted MCP server.
- GitHub also documents a Docker-based local server option, but the remote hosted form is simpler for most users.
- The old npm GitHub MCP package is deprecated; use the hosted or Docker form instead.
