# RSS and Bathos email subscriptions

Readers open `/subscribe/` from the reader header. RSS remains available at `https://bathos.org/rss.xml`, with stable canonical GUIDs, summaries, categories, dates and full article HTML in `content:encoded`. Markdown headings, lists, tables, code and images are rendered with absolute URLs; raw HTML and unsafe URL schemes are excluded. A saved post must finish its Pages deployment before either RSS or the email scheduler can discover it.

The owner selected **our own integration**, with **no advertising or sponsorships**. Bathos stores its subscriber list and delivery queue in its own EU Cloudflare D1 database and manages consent, confirmation, unsubscribe and scheduling in the `bathos-subscriptions` Worker. Resend is the mail transport only. There is no Buttondown signup and no newsletter platform dependency. The messages contain plain text, simple HTML and a link to the post; no tracking pixels or ads are added by our code. Keep Resend open/click tracking disabled too.

## Resources and routing

- Worker: `bathos-subscriptions`; its more-specific `bathos.org/api/subscriptions*` route is separate from the admin Worker's `/api/*` route.
- Database: `bathos-subscriptions`, EU jurisdiction, binding `DB`; migration in `workers/subscriptions/migrations/0001_subscriptions.sql`.
- Turnstile widget: **Bathos email subscriptions**, production hostname `bathos.org`, action `subscribe`. Test widgets/secrets must never be used in production.
- Cron: every five minutes. It refreshes the deployed `/articles.json` catalog and drains up to five queued messages. New-post notifications are batched on **Mondays at 09:00 Europe/London**, including UK daylight-saving changes. Empty weeks produce no message. A missed schedule produces one combined catch-up digest, never a message for each missed week.
- The signed-in `/manage/` page has **Preview email update** and **Send update now**. A private service binding (`ADMIN` → `bathos-admin-oauth`) validates the existing HttpOnly manager session. No new moderator/API token is put in the browser. Manual sending requires same-origin JSON and a signed, current preview expiring after 15 minutes; changed posts or recipient counts require another preview.
- Manual and scheduled sends share one durable post ledger. Manual sending consumes those posts for the next weekly digest and does not move the Monday schedule. Queueing returns immediately; actual delivery starts on the five-minute cron and respects quotas. New subscribers only receive posts discovered after confirmation, so their individual digest may contain fewer posts than the overall preview.
- No subscriber listing or administrative mutation endpoint is exposed publicly. Use the authenticated Cloudflare dashboard for operations.

## Secure provider setup

1. Create the owner's [Resend account](https://resend.com), choosing the free sending plan initially. Add and verify `mail.bathos.org`. Resend supplies the actual DNS records; add those exact records in Cloudflare. Do not replace the root domain's MX/SPF records. The default sender is `Bathos <posts@mail.bathos.org>`.
2. Create a **Sending access** API key restricted to that verified domain. In Cloudflare → Workers & Pages → `bathos-subscriptions` → Settings → Variables and Secrets, add a **Secret** named `RESEND_API_KEY`. Paste it directly there, save/deploy it, and never send it through chat, commit it, or put it in a frontend environment variable.
3. Create a Resend webhook at `https://bathos.org/api/subscriptions/webhook` for `email.delivered`, `email.bounced`, `email.complained`, `email.suppressed` and `email.failed`. Store its signing secret in the same Worker as **Secret** `RESEND_WEBHOOK_SECRET`, without sending it through chat. The webhook verifies the raw-body HMAC and rejects signatures outside a five-minute window. Receipts are stored until their send response/provider ID is recorded, so an early bounce cannot be lost.
4. `TOKEN_SECRET` and `TURNSTILE_SECRET` are required Worker secrets, provisioned securely. The two Resend secrets are additionally required by the runtime readiness check before signup or any sending is enabled; a paused Worker can be deployed without provider credentials. `TOKEN_SECRET` is a random 32-byte base64url value. Preserve it: rotating it invalidates outstanding confirmation and unsubscribe links and changes suppression hashes. Never print or log these secrets. The public sitekey belongs in `TURNSTILE_SITE_KEY`.
5. Keep `DELIVERY_ENABLED=false` until the sender/domain and authorized test inbox are verified. Activation is an operational configuration change: set `DELIVERY_ENABLED=true` in the reviewed Wrangler configuration and deploy, preserving all secret bindings. The first successful cron seeds the catalog baseline without mailing the archive. Until the baseline and required bindings exist, `/api/subscriptions/status` returns `enabled:false` and the signup form stays hidden.
6. Verify the actual production flow with an owner-authorized inbox: signup with a fresh real Turnstile token, confirm receipt and sender, click the confirmation link and press Confirm, send an authorized new-post delivery test, check the delivered webhook, unsubscribe and verify further queued notifications are cancelled. A real token replay must fail. Do not send unsolicited tests or publish fictional production content. Keep issue #30 open until these checks are complete.

Cloudflare Email Service is not used for the newsletter: its [FAQ](https://developers.cloudflare.com/email-service/reference/faq/) currently limits it to transactional email. [Resend pricing](https://resend.com/pricing) currently includes 3,000 sends/month and 100/day on the free sending plan. This integration conservatively caps all provider attempts, including confirmations and retries, at **90/day and 2,700/month**. Quota waits remain queued; no paid plan is enabled automatically. Higher volume requires an owner-approved provider plan and a reviewed change to the hard caps. Cloudflare resource usage also depends on the account's existing plan.

## Consent and delivery behavior

- Signup requires the exact Bathos origin, bounded JSON, a valid address and server-side Turnstile success for the exact production hostname/action. Requests are capped at five/hour per HMAC-hashed IP and one confirmation/hour per address. Responses do not reveal whether an address is already subscribed.
- A confirmation email is the only message sent before consent. Its signed link expires after 48 hours; a newer request invalidates the old generation. GET renders a confirmation form, so email link scanners cannot opt someone in. POST activates the subscriber.
- Discovery records new canonical post identities after baseline initialization. At the next weekly or manual send, all still-published, unsent posts are combined into one immutable message per eligible subscriber. Edits update pending copy, but never create a new post identity or trigger another email. Deleted posts are excluded before queueing. Keep slugs unchanged: a renamed URL is a new identity.
- Posts, digest records and per-subscriber jobs are committed atomically under the same persistent lease used by discovery. Concurrent manual/weekly sends cannot consume the same posts twice. Empty digests do not create jobs. Completed post identities are retained even when delivery history is cleaned up.
- Each delivery uses a durable job ID as the provider idempotency key. Database leases prevent concurrent dispatch. Transient provider errors retry the same body/key. [Resend retains idempotency keys for 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys); attempted jobs still queued after 23 hours are marked `uncertain` for manual review, rather than risking duplicate sends. Do not automatically reset these jobs or give them fresh IDs without reconciling Resend's logs.
- Every email has an unsubscribe link and RFC 8058 one-click headers. GET renders a safe form; signed POST performs the unsubscribe. Queued work is cancelled. A request already accepted by the provider may still arrive.
- Signed bounce/complaint events suppress the address and cancel unsent work. A keyed address hash prevents later re-enrollment even after personal subscriber records are cleaned up; no plaintext address is retained in this suppression marker. Do not clear a complaint suppression without explicit renewed consent and provider reconciliation.

## Retention and diagnostics

Pending subscriber records expire after seven days. Unsubscribed/suppressed personal records and completed/failed/cancelled job history are removed after 90 days. Active subscriber records stay until unsubscribe. Suppression hashes and stable post identities are retained; the latter prevent older posts from being mistaken for new discoveries. Logs contain event codes and job IDs, never addresses, provider secrets or tokens; request query strings are redacted.

Use D1's authenticated console to inspect queue counts, without exporting subscriber addresses:

```sql
SELECT state, count(*) AS jobs FROM jobs GROUP BY state;
SELECT id, kind, state, last_error FROM jobs WHERE state IN ('failed','uncertain');
SELECT count(*) AS active_subscribers FROM subscribers WHERE status='active';
```

`sent` means Resend accepted the request; `delivered_at` means its signed delivery event was received. Neither proves the reader opened the email. No open tracking is implemented. Inspect Resend when jobs are failed/uncertain, fix the cause and reconcile the original message before any manual replay. `DELIVERY_ENABLED=false` pauses signup/dispatch while existing unsubscribe and webhook endpoints remain available.

## Validation and deployment

Install the root and admin Worker's locked dependencies as required by AGENTS.md. Release checks now include `workers/subscriptions/*.test.mjs`; the SQL tests use Node's built-in SQLite and require Node 22.13 or later. Tests use fake transport responses and no real mailbox sends.

```sh
pnpm install --frozen-lockfile
npm ci --prefix workers/admin-oauth
READER_TEST_PORT=3146 pnpm verify:release
pnpm --dir workers/admin-oauth exec wrangler deploy --config ../subscriptions/wrangler.jsonc --dry-run
```

Use the project's installed Wrangler or the connected Cloudflare API to apply the subscription migration and deploy the reviewed Worker. Preserve the existing secret bindings. Verify the exact PR-head Pages build before merge, then the exact merged Pages commit, downloaded Worker bundle and production endpoints. Do not claim email is active while provider setup or the authorized inbox checks are pending.

## Weekly digest migration and rollout

Apply `0002_weekly_digest.sql` to the dedicated subscriptions database **before** deploying the new Worker. Rehearse both migrations with local D1 first. The migration retains all subscriber/jobs records and marks already-known post identities as previously included, so changing delivery mode cannot mail the archive. Existing attempted legacy jobs keep their original payload and provider key; reconcile any such jobs before rollout. Production was paused and had zero subscribers, jobs and known posts when this change was prepared.

The migration adds `posts.included_at`, `posts.available`, a pending-post index and `digests`. The original production database was provisioned without a Wrangler migration ledger. After verifying its existing schema, establish the standard `d1_migrations` ledger with `0001_subscriptions.sql` recorded (do not reapply its schema), then apply and record `0002_weekly_digest.sql`. Future migrations can use Wrangler normally. Never remove these columns during a code rollback. Do not roll back to the old per-post discovery sender after enabling the new service. The cron expression remains every five minutes: `metadata.next_digest_at` gates weekly batching and advances even on an empty week. The initial catalog baseline seeds archive identities without sending.

Provider activation still requires the verified sender, domain-restricted Resend key, signed event webhook and an authorized real mailbox test. Configure those secrets directly in Cloudflare, enable the reviewed delivery configuration, verify baseline readiness, then exercise confirmation → grouped digest → delivered receipt → unsubscribe. RSS and the deployed manager continue to work while email is paused; do not describe actual email delivery as live until this test passes.
