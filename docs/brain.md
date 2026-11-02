# Public dialogue brain

Requested in #136. This is part of the existing Bathos deployment, not a private app or new subdomain.

## Surfaces

- `/brain/`: server-rendered public dialogue, progressive search/filtering, source quotations, competing readings and live clarification replies.
- `/brain.json`: generated ledger and deterministic Markdown backlinks from the same content loaded by the blog.
- `/brain-agent.md`: public, model-neutral contribution protocol.
- Existing `/mcp`: three additional read-only tools: `search_brain`, `get_brain_thread`, `get_brain_dialogue`. Existing post tools and the transport restrictions remain intact.
- Conventional and no-JavaScript article pages: backlinks and links into relevant discussions.

`brain/ledger.json` is the durable record. `lib/brain-core.mjs` validates it and enriches it with source status and immutable revision URLs. `lib/brain.ts` loads the Markdown and parses actual links (including reference links), excluding links merely shown in code blocks. No AI model is called during a page read or build. Search is lexical, not semantic.

An interpretation belongs to its reader, not automatically to the site owner. The initial reader is one ChatGPT run; its counterarguments are not falsely presented as independent votes. The ledger can hold separate contributions from any model or person with declared provenance. Perspective hypotheses are contextual readings, never diagnoses. Nothing chooses a universal winning persona or equates the latest entry with the latest committed human belief.

## Clarification loop

Each thread can link to a public GitHub issue. A reader can ask one consequential question and assign it to the owner; actual notifications depend on GitHub settings. The author may reply normally on GitHub or publish a normal post. An agent may subsequently append a reported clarification, quoting and citing the public answer. A response in private chat must not be published without permission for that passage.

The page's **Read latest replies** button calls `get_brain_dialogue` through the existing same-origin MCP endpoint. No visitor request is made to GitHub until that button is used. The server reads a fixed public issue-comments endpoint derived from the stored issue number; it does not follow arbitrary URLs or forward client credentials. Each response is at most 50 comments, with explicit pagination and truncation. Edits to comments are visible on the next read. A failed/rate-limited fetch returns unavailable and incomplete, never a fabricated empty answer. GitHub account identity is not human authorship, since agents can use the same authorised connection.

This live response does not silently rewrite the ledger. The next reader considers it and appends an attributed update. Publication, silence, issue closure and agreement among models are not author endorsements. The UI and MCP preserve these distinctions.

## Extending the record

Follow `/brain-agent.md` and the example entries in the ledger. Add your actual model/run/provenance once, then append evidence-bearing contributions. Use `repliesTo` for dialogue and `revises` only for your own earlier contribution in the same thread. Keep older entries. A reported clarification needs an explicit attribution and a public source comment URL. The schema validates references but cannot prove that a person sincerely believes a statement; do not describe it as doing so.

The source revision is an immutable full Git commit. Quotation checks against current source detect changed or deleted passages without blocking ordinary article edits. The optional source blob SHA additionally flags context changes outside the quote. The historical quotation is retained with its original revision link. Source-status checks do not establish that the proposition is true, or that the supplied snapshot and quotation were honestly selected: contributors/reviewers must verify that too.

## Operations and security

No new provider account, database, token, secret, background Worker or paid model service is configured. The existing Cloudflare Pages Function continues to serve `/mcp`; no `_routes.json` expansion or `/api/*` change is required. GitHub public API limits apply. Dialogue reads have an eight-second deadline and edge-cache hints; existing edge protections remain in place. Source text and comments are displayed as escaped text, never executed as HTML or instructions. External URLs are fixed or constructed from validated IDs.

Any scheduled agent is a separate runner with its own permissions. The website does not imply a runner exists, that it is always awake, or that independently branded readers use independent base models. A runner should act on changed evidence, avoid duplicate questions, keep interruptions sparse and disclose its run identity.

## Validation and release

`node --test tests/brain.test.cjs` covers source changes, provenance requirements, per-reader revisions, backlinks, argument validation, fixed GitHub endpoints, pagination and failure reporting. The normal Release checks run it. `tests/e2e/brain.spec.ts` adds desktop/Android filtering, evidence, on-demand replies, failure handling, escaping and no-JavaScript checks. Run the full AGENTS.md gates (frozen installs, TypeScript, release/browser/worker tests, enabled-Webmention verification). Check keyboard focus and layout, and verify `/brain/`, `/brain.json`, `/brain-agent.md`, the explanatory article and all MCP tools on the exact production deployment.

No CI permissions, provider credentials or branch protections should be loosened for this feature.
