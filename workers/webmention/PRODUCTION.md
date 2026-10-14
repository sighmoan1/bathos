# Production receiver

The production target is `bathos-webmention` in account `f548d682f856a4cc0b81501127128abd`, using dedicated D1 `bathos-webmentions` (`b630c2f4-821d-4115-a62b-1a8e49a78360`). It owns only `bathos.org/api/webmention*` in zone `15caeeda0314a83a5feb2cd97dd4ade2`. Preserve the existing publishing `/api/*` and subscriptions `/api/subscriptions*` routes and databases. The production configuration declares both independent required secrets by name; their values are never committed.

Initial provisioning used reviewed source `8a98a43eaca292de22aaf0dea9f01810193caab1`. The initial database schema and the pinned Wrangler-compatible `d1_migrations` ledger were submitted together, recording `0001_webmentions.sql`; do not execute that raw schema again. The ledger format was rehearsed locally with Wrangler 4.149.0, whose subsequent migrations command correctly reported no pending migrations. New migrations use the normal command below with the explicit production config and remote database.

The initial Worker was deployed disabled, with workers.dev and preview URLs disabled and public-only global fetch. A narrow route and one-minute cron were verified while disabled. Production activation is a separate release gate: confirm protected operator credentials, the deployed bindings and schema, existing-route regression checks, required repository release checks, and explicit activation approval when an approval review requires it. An enabled configuration file is the intended deployment state; it does not prove the remote service has been enabled or smoke-tested.

Existing records whose fingerprints used raw HTML may return to pending once after this normalization rollout. Re-review those sources before approval; this is a deliberate fail-closed transition.

## Current release status

The fingerprint normalization fix and production deployment guard are integrated for release under coordinator issue #99. The configuration describes the intended enabled deployment, but this workspace has no authenticated Cloudflare deployment connection or protected operator credential handoff. Receiver activation and live receive/moderate/read/delete verification therefore remain blocked. Pages discovery and response display must stay disabled until those checks succeed. Local runtime tests exercise changed-source and removed-backlink retraction; they do not establish production activation.

## Release commands

Follow AGENTS.md for locked installs, TypeScript, full default and enabled release checks, exact-head required CI/Pages checks and production verification. In the receiver package:

```sh
npm ci --prefix workers/webmention
npm run check:production --prefix workers/webmention
npm run deploy:production --prefix workers/webmention -- --tag REVIEWED_SOURCE_SHA
```

The production command explicitly selects `wrangler.production.jsonc`. The default `npm run deploy` refuses to run because the development configuration is deliberately disabled and lacks the production database/route. Do not bypass this guard with a bare `wrangler deploy`. Wrangler preserves existing secrets during deployments; the required-secret declaration refuses a production deployment with missing secrets. See the [secrets documentation](https://developers.cloudflare.com/workers/configuration/secrets/). Never pass secret values through arguments or paste them into review evidence. Deployment credentials are account-owned and independent of the moderator token.

After a reviewed new migration, run from `workers/webmention`:

```sh
npx --no-install wrangler d1 migrations apply DB --config wrangler.production.jsonc --remote
```

Inspect pending migrations first and rehearse them locally. This command writes only the dedicated receiver database; it must not target the subscriptions database. Confirm the live migration ledger and schema before rolling out code that depends on them. A Worker rollback does not roll back D1 data.

## Operator credentials and verification

The moderator token and rate salt were generated inside the authenticated connector, uploaded as `secret_text`, and RSA-OAEP encrypted to a locally generated public key. Only ciphertext left that connector execution. The private key and decrypted operator JSON are retained outside disposable worktrees in an owner-only directory (0700), with files 0600 and an ignore rule. Keep that protected handoff available to the operator; never put the moderator token into the public manager or browser.

Use the operator API documented in README.md. Each approval must include the fingerprint of the reviewed record. Use listing pagination for older pending entries; pages are live snapshots. Salt rotation starts new anonymized quota buckets; token rotation invalidates prior operator access. Update the protected handoff securely when rotating either credential.

Controlled live smoke tests use unique query variants of existing owned sources: the hard multi-agent post links to the easy multi-agent post, while Gassing has no actual backlink to that target. Verify unauthorized moderation, hidden pending state, reviewed approval, public response read, and administrative deletion cleanup. Do not edit published content or notify third-party targets. Actual source-change/backlink-retraction behavior is proven in the local runtime suite; do not describe administrative cleanup as a live backlink-retraction test. After Pages enables discovery/display, verify fresh desktop and phone contexts on both reading routes and remove every controlled test record.

If receiving must be paused, deploy the reviewed production configuration with only `ENABLED` changed to `false`, preserving its D1 binding, secrets, route and cron, and verify 503. Hide discovery/display separately through a reviewed Pages release. Do not deploy the unconfigured default file as a rollback. Investigate D1/runtime/cron failures and verification-lease expiry without reading unrelated subscriber data. No subscription upgrade or paid plan purchase is part of this setup; monitor usage against the existing account limits.
