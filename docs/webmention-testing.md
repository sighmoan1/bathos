# Webmention release verification

Install each independently locked package in the issue's own worktree before validation:

```sh
pnpm install --frozen-lockfile
npm ci --prefix workers/admin-oauth
npm ci --prefix workers/webmention
pnpm exec playwright install chromium
pnpm exec tsc --noEmit
pnpm verify:release
```

The release command runs application Node tests (including the real sender/receiver integration fixtures), the Webmention Worker Miniflare/D1/HTMLRewriter tests, admin Worker tests, the production export, desktop/Android browser tests and mobile post-manager/service-worker checks. Receiver runtime dependencies must be installed even when the production response feature remains disabled; integration coverage does not silently skip a missing runtime.

Integration fixtures render the actual ArticleReader/ReplyContext reply links and canonical permalink, send via the actual outbound sender to the actual receiving Worker with isolated D1, and prove pending responses stay private until authenticated approval of the reviewed fingerprint. Changed source content requires fresh review; scheduled revalidation removes withdrawn backlinks. DNS and remote requests are intercepted fixtures; no real notifications are sent. Negative tests cover inert HTML pretend backlinks and unsafe source URLs.

The normal build keeps response display disabled unless explicitly configured. Browser tests assert the disabled build renders no response section and makes no response API request. An isolated QA build exercises the enabled component against intercepted API responses:

```sh
NEXT_PUBLIC_BATHOS_WEBMENTIONS=true pnpm build
NEXT_PUBLIC_BATHOS_WEBMENTIONS=true pnpm test:e2e
pnpm build
```

The last command restores the default disabled export. Enabled tests run on desktop and Android across both the canonical swipe route `/posts/Gassing/` and the conventional reading route `/read/Gassing/`, using canonical `/posts/Gassing/` as the API target: approved links render as escaped text, pending/invalid records remain hidden, empty and unavailable states differ, 100 valid receiver records exceeding 64 KiB render, and payloads exceeding 1 MiB fail closed. URLs that exceed the 2,048-character bound after Unicode normalization and excessive valid date precision are omitted. Default-only cases are explicitly skipped in enabled QA; enabled-only cases are explicitly skipped in normal release. Both variants must be run when changing the response component or browser verification. Run the full enabled browser suite, not only the focused Webmention file, because shared reading and sharing controls must keep working with the additional response section.

For simultaneous agents, serve only your own `out` directory on a dedicated port and set `READER_BASE_URL` consistently for every browser command. The default Playwright server uses port 3021. A stable server with a listen backlog of at least 128 avoids observed local connection resets during parallel browser runs. Never reuse another agent's build or server.

Keep issue/PR evidence with the exact commit, frozen installs, full release results, explicit enabled QA results, type-check results and the required GitHub Release checks plus the exact-head Cloudflare Pages check. A passing fixture suite does not configure a production D1 database, Worker routes, moderator secret, salt or feature flag. Follow current AGENTS.md, the receiving Worker's setup documentation, required GitHub Release checks, and exact-head Pages/production gates before describing inbound responses as live.
