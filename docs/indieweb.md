# Replies and Webmentions on Bathos

Bathos replies are Markdown posts with optional `inReplyTo` frontmatter. The URL is the original article's canonical URL, not its homepage or a search result:

```yaml
inReplyTo:
  - https://example.org/posts/original-article/
```

The content loaders normalize and deduplicate absolute HTTP(S) URLs and reject malformed or unsafe values. The article exposes visible `u-in-reply-to` links, an `h-entry`, a canonical `u-url`, a `p-name` title and `e-content` body. Ordinary posts need no reply field. Publish the post through the existing publishing path, validate it and wait for its exact production deployment before sending a notification. Reply metadata alone does not notify another site.

## Send a published reply

After building in an installed checkout, use the sender described in [webmention-outbound.md](webmention-outbound.md):

```sh
mkdir -p work
node scripts/send-webmentions.mjs --source https://bathos.org/posts/my-reply/ --page out/posts/my-reply/index.html --state work/webmentions-sent.json
```

The sender reads targets from the built reply page and confirms that the live source contains real hyperlinks to them. It discovers the receiver using the Webmention standard and posts only `source` and `target`. Keep the local state file out of version control; reruns skip accepted pairs. Use `--resend` deliberately after a published update. Accepted means the receiver accepted processing; it does not establish that the response was moderated or displayed. An `unsupported` result means the recipient has no advertised endpoint. The linked reply remains readable on Bathos. Do not claim delivery in that case.

This initial sender requires a live backlink and does not send deletion notifications. Receivers periodically recheck approved backlinks. See the sender guide for retry policy, limits and exact failure behavior. Public adoption instructions and framework examples are maintained separately by the adoption feature workstream.

## Receive and moderate

The separate [Webmention Worker](../workers/webmention/README.md) owns `/api/webmention*`; the existing OAuth Worker continues to own the broader `/api/*` route. Receiving is disabled in committed configuration. A D1 binding, migrations, independent secrets, validated egress protection and verified route ownership are prerequisites. No production database or receiver is established by simply merging the source files.

The receiver verifies an existing canonical Bathos target and the external source's actual hyperlink before storing a pending record. A moderator uses the authenticated operator API to approve, reject or delete it. Approval fetches and verifies the source again; changed content needs a new review. Public reads return only approved records within their verification lease. The browser renders bounded text and safe links without remote HTML or images.

Set `NEXT_PUBLIC_BATHOS_WEBMENTIONS=true` for the static build only after the receiver has passed production receive/moderate/read/retract checks. Otherwise the response section stays absent. Advertise the endpoint on article pages only after the same readiness checks. Keep moderation tokens out of the browser, tracked files, command arguments and logs. The repository does not add a public moderation interface to the existing manager.

## Validate and release

Follow [AGENTS.md](../AGENTS.md) in an isolated issue-linked worktree. Run frozen dependency installs, the required `pnpm verify:release`, and the new Worker's own frozen install and tests. Record evidence in the PR. A successful Cloudflare Pages check for the exact PR head is required before merging; a local test or dry run does not replace it. Integrate current main before validation and serialize merges across concurrent workstreams.

For production verification, match the deployment to the exact merged SHA, use fresh online responses and account for reader service-worker caches. Check a reply's visible initial-HTML backlinks without JavaScript. Exercise receiving with a controlled published source, confirm it is hidden pending approval, approve through the operator API, confirm the response appears, then retract the controlled backlink and confirm removal. Never use an unrelated person's article as a test recipient.

Rollback the static enable flag and endpoint discovery first if receiving fails. Worker rollback does not roll back D1 data; retain moderation records and inspect migrations before changing storage. The Worker guide documents quotas, verification lease and secret rotation. Keep issues open where production setup or acceptance remains unverified.

Protocol references: [W3C Webmention](https://www.w3.org/TR/webmention/) and [IndieWeb replies](https://indieweb.org/reply).
