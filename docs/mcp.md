# Bathos MCP

Issue [#131](https://github.com/sighmoan1/bathos/issues/131), part of [#128](https://github.com/sighmoan1/bathos/issues/128).

Public endpoint: `https://bathos.org/mcp`. Human setup guide: `/mcp-guide/`.
Use a custom remote MCP client with Streamable HTTP and no authentication.
The server exposes only the published archive; connecting does not grant publishing
or subscription access. It does not replace crawlable post HTML or Markdown.

## Deployment

`functions/mcp.js` is a Cloudflare Pages Function deployed by the existing
`bathos-web` Git integration with the static `out` export. It imports the
runtime-neutral handler from `workers/mcp/handler.mjs`. `public/_routes.json`
limits function invocations to `/mcp` and `/mcp/`; other pages stay static and
existing zone Worker `/api/*` routes are unchanged. No new secret, database,
external API, account, paid service or separate Worker deployment is needed.
Function invocations use the project's existing Pages Functions quota; inspect
Cloudflare usage if traffic grows. Cloudflare Pages build checks must compile
the Functions bundle in addition to the static build.

Each tool call loads `/agent-posts.json` using the same deployment's built-in
`env.ASSETS` binding. This keeps the MCP archive aligned with the exact deployed
commit and makes previews self-contained. Never fetch a caller-provided URL.
No request cookies or authorization headers are forwarded to the asset binding.
The service has no logs containing queries and no stored sessions or drafts.

## Protocol and limits

The implementation supports MCP `2025-11-25`, `2025-06-18` and `2025-03-26`.
It is a stateless JSON-response Streamable HTTP server: initialize, initialized
notification, ping, tools/list and tools/call. GET returns 405 because the server
does not offer an SSE listening stream; accepted notifications return empty 202.
No legacy HTTP+SSE transport, server-initiated requests or sessions are offered.
POST requires `Content-Type: application/json` and `Accept: application/json,
text/event-stream`. Unsupported supplied protocol versions return HTTP 400.

Originless server-to-server clients are supported. Browser origins must exactly
match the request's own origin, `https://chatgpt.com` or `https://claude.ai`.
Other origins return 403. This is an intentional allowlist, not authentication;
new browser MCP clients need an explicit reviewed origin addition. No credentialed
CORS. WAF, rate limits and edge security remain in effect; do not disable them
zone-wide to fix a client.

- Requests: maximum 16 KiB, including streamed bodies.
- `list_posts`: default 30, maximum 100 results; optional exact tag filter.
- `search_posts`: lexical full-text search, 300-character query, maximum 20 results,
  700-character matching excerpt. Search is keyword matching, not semantic search.
- `get_post`: exact slug, default/maximum 40,000 source characters per response;
  minimum requested chunk 1,000. Follow `nextOffset` until null to read long posts.
- Pagination offsets and limits are validated; unknown arguments fail.
- Missing posts are tool errors; invalid requests use JSON-RPC protocol errors.
- Responses use `Cache-Control: no-store`; tool results include citation metadata
  and a text copy of structured results for older clients.

## Verification

Run `node --test tests/mcp.test.cjs` for protocol, pagination, full-text search,
argument bounds, origin, MIME, transport, error and Pages adapter checks. This
suite is included in the existing `tests/*.test.cjs` release glob.
Use the official MCP SDK client as a separate interoperability check when available.
Run every AGENTS.md release gate and require exact-head Release checks and Pages
checks before merge. A local static `pnpm build` does not execute Pages Functions.
After merge verify initialize, initialized, tools/list and all three tools at the
production endpoint and verify the exact production commit in deployment status.
A GET 405 is expected, not evidence of a failed deployment.

Example initialization:

```sh
curl https://bathos.org/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"bathos-check","version":"1"}}}'
```

References: [MCP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports),
[MCP lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle),
[Pages Function API and ASSETS binding](https://developers.cloudflare.com/pages/functions/api-reference/).
