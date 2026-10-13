# Sending replies from Bathos

Publish a post with `inReplyTo` frontmatter (a list of absolute HTTP(S) article URLs) and wait for the exact production deployment. The rendered article includes ordinary reply links with `u-in-reply-to`. Receivers need Webmention support; publishing the linked reply still works when a target has no endpoint.

From an installed repository checkout, after `pnpm build`:

```sh
node scripts/send-webmentions.mjs --source https://bathos.org/posts/my-reply/ --page out/posts/my-reply/index.html --state work/webmentions-sent.json
```

Alternatively, supply one or more `--target https://example.org/article` arguments. This explicit form also handles ordinary linked posts without reply metadata. The source must be an exact canonical `https://bathos.org` URL returning live HTML with a real hyperlink to every requested target. Drafts, missing pages, source redirects and links found only in comments/scripts cannot send. Local build output selects targets; live HTML always authorizes sending.

The command discovers the target's endpoint from the first HTTP Link relation, then the first HTML link/a relation in document order. It follows bounded public redirects and preserves endpoint query parameters. It posts only URL-encoded `source` and `target`, with no cookies or credentials. A 2xx response means accepted for processing, not necessarily approved or displayed by the recipient. Unsupported endpoints produce an `unsupported` result. Failures produce a nonzero exit status; other targets still run.

Accepted pairs are recorded atomically in the chosen state file, which should be kept outside version control. Create its parent directory first. A rerun skips accepted pairs. Use `--resend` after editing an already published reply; manually inspect the recipient before resending a request with an uncertain network result. Only explicit HTTP 5xx responses retry automatically (at most two retries with short backoff); 4xx and ambiguous network failures do not. Run only one sender process per state file. Do not delete the state file to retry a whole batch. Removing/deleting backlinks is outside this initial sender's scope because the live backlink gate intentionally blocks those notifications.

Every request validates all DNS answers and pins a validated public address to the socket, preserving HTTP Host and TLS server identity. Private/reserved IPv4, IPv6 local/mapped/transition/special ranges, credentials, non-HTTP protocols, nonstandard ports and HTTPS downgrade redirects are rejected. Each DNS and network operation has a 10-second bound, responses are capped at 1 MiB, and redirects at five. These conservative limits may reject unusual but legitimate receivers. No automatic GitHub Action or third-party delivery service is configured.

Run `node --test tests/webmention-outbound.test.cjs` for transport/discovery/backlink/delivery fixtures. Tests mock all remote requests and send no live notifications. Protocol reference: [W3C Webmention Recommendation](https://www.w3.org/TR/webmention/).
