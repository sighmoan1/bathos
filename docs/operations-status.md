# Hosting and delivery status

Hosting decision recorded 14 October 2026. GitHub issues remain the current
record of acceptance evidence and unresolved work; this document describes
ownership and activation boundaries, rather than a live deployment monitor.

## Hosting

`bathos.org` is the Git-connected Cloudflare Pages project `bathos-web`.
Its production branch is `main`, build command is `pnpm build`, and output
directory is `out`. Publishing, subscriptions and inbound Webmentions use
separate Cloudflare Workers; merging static site code does not deploy those
Workers or complete their external configuration.

The owner abandoned the DigitalOcean option. Experimental PR [#21](https://github.com/sighmoan1/bathos/pull/21)
was closed without merging; its description records no infrastructure
provisioned. No DigitalOcean infrastructure or deployment workflow exists in
`main`. This decision does not dispose of applications or resources belonging
to other repositories.

Vercel Analytics and the old Git deployment connection were removed in
PR [#90](https://github.com/sighmoan1/bathos/pull/90), with recorded Cloudflare
production verification. The disconnected historical Vercel project and
its deployments are separate cleanup in [#89](https://github.com/sighmoan1/bathos/issues/89);
the public reader does not depend on them. References to Next.js releases and
checks rejecting unrelated hosting providers are still valid.

## Delivery ownership

| Work | Tracking | Completion boundary |
| --- | --- | --- |
| Webmention receipt and display | #39–43, #87, PR #88 and PR #85 | Fingerprint fix, Worker configuration, controlled receive/moderate/display/update/retract verification and enabled static export |
| Reply metadata and outbound sender | #37–38 | Code merged in PR #83; remaining published reply/adoption acceptance is tracked separately from fixture results |
| Public reply guide and discovery | #45, #47 | Code merged in PR #79; enabled receiver discovery and real submission need production acceptance |
| Manager reply editing | #52 | UI and backend deployment recorded; authenticated live author round-trip remains unverified |
| Publishing OAuth | #59, PR #76 | Code release, existing grant/session retirement and verified authorized publishing |
| Public HTTP clients | #50 | Bounded Cloudflare configuration and ordinary-client production checks; frontend changes cannot remedy an edge rejection |
| Email subscriptions | #30 | Resend configuration, owner-authorized mailbox confirmation/delivery/unsubscribe and automatic delivery verification |
| Cloudflare account MFA | #57 | Owner authentication/recovery setup and verified account enforcement |
| Reader service-worker retirement | #101, PR #27 | Current-feed compatibility, separate manager drafts preserved and production checks |

Do not close acceptance issues merely because their code was merged. Add the
exact commit, deployment and observed behavior; distinguish automated fixtures
from live provider checks. Remove stale claim labels when responsibility has
been handed over. See [release requirements](ci.md), [Webmention operations](indieweb.md),
[publishing authentication](admin-auth.md) and [subscriptions](subscriptions.md)
for implementation-specific procedures.
