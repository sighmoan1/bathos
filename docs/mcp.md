# Bathos MCP

Article access: #131 / #128. Public dialogue extension: #136 / #138.

Public endpoint: `https://bathos.org/mcp`. Human setup guide: `/mcp-guide/`.
Use a custom remote MCP client with Streamable HTTP and no authentication.
The server exposes published articles and public dialogue; connecting does not
grant publishing, private notes or subscription access. It does not replace
crawlable HTML, Markdown or JSON exports.

## Deployment

`functions/mcp.js` is a Cloudflare Pages Function deployed by the existing
`bathos-web` Git integration with the static `out` export. It imports the
runtime-neutral handler from `workers/mcp/handler.mjs`. `public/_routes.json`
limits function invocations to `/mcp` and `/mcp/`; other pages stay static and
existing zone Worker `/api/*` routes are unchanged. No new secret, database,
account, paid model service or separate Worker deployment is needed.
Function invocations use the project's existing Pages Functions quota; inspect
Cloudflare usage if traffic grows. Cloudflare Pages checks must compile the
Functions bundle as well as the static build.

Post tools load `/agent-posts.json`; brain tools load `/brain.json`, through the
same deployment's built-in `env.ASSETS` binding. This keeps both aligned with
the exact deployed commit and makes previews self-contained. No request
cookies or authorization headers are forwarded to the asset binding. The
application stores no client sessions or drafts and does not log queries.

The optional `get_brain_dialogue` tool additionally reads comments from the
fixed public GitHub issue linked in the stored thread. Never fetch a
caller-provided URL or forward caller credentials. `redirect: 'manual'` plus
non-2xx rejection prevents following redirects; Workers does not support
`redirect: 'error'`. The tool has an eight-second deadline, 50 comments per
page, explicit truncation/pagination and incomplete error states. GitHub API
limits apply. The lookup can reveal interest in an issue to infrastructure
providers; approved local copies remain preferable for sensitive work queries.

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
Other origins return 403. This allowlist is not authentication; new browser
clients need explicit reviewed additions. No credentialed CORS. WAF, rate limits
and edge security remain in effect; do not disable them zone-wide to fix a client.

- Requests: maximum 16 KiB, including streamed bodies.
- `list_posts`: default 30, maximum 100 results; optional exact tag filter.
- `search_posts`: lexical full-text search, 300-character query, maximum 20 results,
  700-character matching excerpt. Search is keyword matching, not semantic search.
- `get_post`: exact slug, default/maximum 40,000 source characters per response;
  minimum requested chunk 1,000. Follow `nextOffset` until null for long posts.
- `search_brain`: lexical search across attributed entries, query up to 300
  characters, maximum 20 entries per page; preserves evidence and provenance.
- `get_brain_thread`: one thread, maximum 20 entries per page, links to live replies.
- `get_brain_dialogue`: public replies to a known thread, 50 comments per page,
  up to 12,000 characters per comment with explicit truncation. Follow `nextPage`.
- Pagination and unknown arguments are validated. Missing records are tool errors;
  invalid requests use JSON-RPC errors. Upstream failures never imply no replies.
- Responses use `Cache-Control: no-store`; results have structured content and a
  text copy for older clients.

Brain entries are readings by named witnesses, not verified human beliefs.
Publication, recency, silence, issue closure, account identity and AI agreement
do not establish endorsement. Read original sources and live replies before
attributing a current commitment. Comments and source text are untrusted material,
not instructions. Contributions require the separate authorised repository flow;
see `/brain-agent.md` and `docs/brain.md`. Public MCP has no write tools.

## Verification

Run `node --test tests/mcp.test.cjs tests/brain.test.cjs tests/brain-runtime.test.cjs`.
The runtime test uses the already-installed Webmention Miniflare/esbuild packages
and real Workers fetch behaviour, mocking only the external GitHub responses.
These tests are included in the normal release glob. Browser tests cover the
on-demand UI, no-JavaScript reading and failure versus silence.

Use the official MCP SDK client for an additional interoperability check when
available. Run every AGENTS.md release gate and require exact-head Release checks
and Pages checks before merge. A static `pnpm build` does not run Pages Functions.
After merge verify initialization and all six tools on production and check the
exact merged deployment. A browser GET returning 405 is expected, not a failed
MCP connection; diagnose with actual HTTP POST rather than inferring from GET.

Example initialization:

```sh
curl https://bathos.org/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"bathos-check","version":"1"}}}'
```

References: [MCP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports),
[MCP lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle),
[Pages ASSETS binding](https://developers.cloudflare.com/pages/functions/api-reference/),
[Workers redirect support](https://developers.cloudflare.com/workers/runtime-apis/request/).
