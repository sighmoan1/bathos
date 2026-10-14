# Public HTTP access at Cloudflare

Tracked by [issue #50](https://github.com/sighmoan1/bathos/issues/50).
The owner authorized the selective remedy in coordinator #99. This document is
a deployment runbook, not evidence that a zone rule has been deployed.

## Scope and current blocker

Issue #50 records Python user agents receiving HTTP 403 / Cloudflare error 1010
while default curl succeeds; a previous API inspection found Browser Integrity
Check enabled. Frontend headers and robots guidance cannot change that edge
decision. The repository exports the discovery resources already.

On 14 October 2026 this execution environment had no Cloudflare connector,
Cloudflare/Wrangler credential variables, or known authenticated dashboard
session. Plugin discovery returned no Cloudflare integration. Live Python
requests with `Python-urllib/3.14` received 403 / `error code: 1010` on `/`,
`/articles/`, RSS, JSON catalog, sitemap and robots. Requests with a browser
user agent returned 200 with the expected content types; default curl HEAD on
RSS returned 200. The manager received 403 for Python, while its browser shell
returned 200 and unauthenticated `/api/session` returned 401. These checks
confirm the client limitation persists; they cannot inspect current zone rules.
Keep #50 open until deployment and acceptance below have evidence. Do not
change the zone-wide Browser Integrity Check toggle.

## Inspect and apply one configuration rule

1. In the authorized `bathos.org` zone, record the zone-wide Browser Integrity
   Check setting and export the current `http_config_settings` ruleset, including
   rule IDs and order. Inspect other configuration rules for overlapping `bic`
   settings; preserve every unrelated rule and setting. Check plan availability
   and rule quota before making any change.
2. Create a Configuration Rule named `Bathos public GET HEAD integrity exception`
   with the expression below. Set only **Browser Integrity Check: Off**.
   The Rulesets API action is `set_config`, with
   `action_parameters: { "bic": false }` and `enabled: true`.
   Add/update the individual rule rather than replacing the entire ruleset.
3. Inspect the final evaluation order so no later matching rule overwrites this
   setting. Record the rule ID, exact expression, ordering, timestamp and before/
   after settings in #50. Use Cloudflare Trace to confirm exclusions as well as
   matching requests. Leave WAF, rate limits, bot protections, Access and all
   other settings intact.

```text
(http.host eq "bathos.org"
 and http.request.method in {"GET" "HEAD"}
 and (
   http.request.uri.path in {"/" "/articles" "/articles/" "/articles.json" "/rss.xml" "/sitemap.xml" "/robots.txt"}
   or starts_with(http.request.uri.path, "/read/")
   or starts_with(http.request.uri.path, "/posts/")
 ))
```

This excludes `/admin`, `/manage`, `/api`, subscription and Webmention mutation
endpoints, every non-GET/HEAD method and every other hostname. Query strings do
not widen the path match. Pages preview hosts are not covered by this zone rule.
Do not broaden the expression to fix a separate preview-host problem.

## Acceptance and evidence

Before changing the rule, record a GET/HEAD baseline for each public resource
with curl's default user agent, a normal browser and an ordinary Python client
using its unmodified user agent. Repeat after applying it, without cookies or
authentication. Test `/`, `/articles/`, one real `/posts/<slug>/` article, its
`/read/<slug>/` route, `/articles.json`, `/rss.xml`, `/sitemap.xml`, `/robots.txt`.
Record status, Content-Type, request method, user agent and timestamp. Follow
ordinary canonical redirects; the final valid public resources must return 200
with expected HTML, JSON, RSS/XML or plain text and meaningful content. Parse
JSON/XML rather than accepting an HTML challenge with a successful status.

For example, run from a machine that can reach production:

```sh
curl --fail --location --max-time 20 --dump-header /tmp/bathos-rss-headers https://bathos.org/rss.xml
curl --fail --location --head --max-time 20 https://bathos.org/articles.json
python -c 'import urllib.request; r = urllib.request.urlopen("https://bathos.org/articles.json", timeout=20); print(r.status, r.headers.get("Content-Type")); print(r.read(100))'
```

Use Trace and the stored ruleset to prove that GET `/manage/`, GET `/admin/`,
GET `/api/session`, POST `/rss.xml` and GET on another hostname do not match the
exception and retain their previous effective security settings. A public
static manager shell returning 200 is not a bypass of authentication. Check
unauthenticated `/api/session` remains unauthorized. Do not send POSTs to live
publishing or subscription endpoints merely to test an expression.

If a resource remains blocked, inspect its security event and identify the
actual product/rule responsible. Do not skip all security products or disable
Bot Fight Mode/WAF as a substitute. Record any remaining blocker separately.

## Rollback

Disable only the newly recorded rule ID (or restore that rule's previous state
if updating an existing equivalent rule). Verify the original effective BIC
settings and excluded-route settings with Trace and the saved baseline. Keep
all other rules and the zone-wide setting unchanged. Repeat the public probes,
record the rollback timestamp, and reopen/retain #50 if agent access regresses.

References: [Browser Integrity Check](https://developers.cloudflare.com/waf/tools/browser-integrity-check/),
[Configuration Rules settings](https://developers.cloudflare.com/rules/configuration-rules/settings/),
[Create a rule via API](https://developers.cloudflare.com/rules/configuration-rules/create-api/).
