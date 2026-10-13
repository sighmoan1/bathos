# Publish a reply from your own site

Read [the human guide](https://bathos.org/webmentions/) or
[the agent contract](https://bathos.org/webmentions-agent.md).
The [W3C Webmention specification](https://www.w3.org/TR/webmention/) is the
protocol reference. Sending does not require installing a receiver on your site.

These are publishing templates and an operator-only POST example. They are not a
complete Webmention discovery library. Replace both example URLs and the response
text. The example Bathos path is a placeholder, not an existing article.

## Framework setup

- **Plain HTML:** copy `plain-html/reply.html`, change its canonical, permalink and
  target URLs, then upload it as a public page.
- **Jekyll:** merge `jekyll/_config.yml` into your site's configuration with your
  real production origin and base path. Copy `_layouts/reply.html` and `reply.md`
  into the corresponding site directories. `jekyll build` emits `_site/reply/index.html`.
  Use a current Jekyll version with its built-in `absolute_url` filter.
- **Eleventy:** copy `eleventy/reply.md` and `_includes/reply.njk` into your input
  directory. Set `canonical` to the full public URL. Run your existing Eleventy
  build; the template produces `/reply/index.html`. The body is trusted Markdown
  from your own site; do not pass arbitrary visitor HTML to `content | safe`.
- **Next.js App Router:** copy `nextjs/app/reply/page.tsx` to `app/reply/page.tsx` in
  your existing project and adjust its URLs/content. It is a server component;
  the backlink is in initial HTML. It also works with `output: 'export'` and
  `trailingSlash: true` in your existing Next.js configuration. Use your normal
  root layout and build command. Do not add a client fetch proxy or API route.

Do not add `rel="webmention"` to your own pages unless you actually operate a
receiver; `u-in-reply-to` is reply metadata, not endpoint discovery.

## Publish, discover, send

After deployment, inspect the public source HTML and confirm the exact target
backlink. Discover the receiver from the target's HTTP Link header, or its first
HTML `<link>`/`<a>` with a `webmention` relationship. Header discovery takes
precedence; resolve relative endpoints against the final target URL and preserve
endpoint query parameters. Stop if there is no advertised endpoint.

Use your site's existing maintained sender when available. Bathos maintainers
should use the outbound sender workflow documented alongside `scripts/send-webmentions.mjs`
once that work is integrated. These examples do not assert that a pending sender
or receiver is deployed.

For a one-off, authorised submission to an endpoint you have already discovered
and reviewed, use the standard form-encoded request:

```sh
curl --max-time 10 --request POST \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'source=https://your-blog.example/reply/' \
  --data-urlencode 'target=https://bathos.org/posts/REPLACE-WITH-REAL-ARTICLE/' \
  'https://REPLACE-WITH-DISCOVERED-RECEIVER.example/endpoint'
```

Alternatively, from a local operator script, call `submitWebmention` in
`submit.mjs` with `source`, `target`, the discovered `endpoint`, and explicit
`authorized: true` and `publishedBacklinkChecked: true` after those checks.
Those booleans record your checks; they do not perform them or confer permission.
The helper rejects redirects, omits credentials, and times out. It does not do
discovery, DNS/IP filtering, or backlink retrieval. Run only against reviewed
public URLs; never expose it to untrusted input through a server. A production
sender needs DNS and redirect validation to prevent private-network requests.

Record “accepted for processing” on 202 and “accepted” on other successful 2xx
responses. Neither proves verification, moderation approval, or visible display.
Keep any returned status location and inspect it separately with the same URL
safety rules. Record failures and absent endpoints honestly; respect rate limits.

## Tests and limits

`node --test tests/webmention-examples.test.cjs` runs submission mocks, the HTML
fixture, and an actual React server render of the Next.js component. To exercise
the Liquid template and an actual Eleventy Markdown/Nunjucks build without adding
production dependencies, install `liquidjs` and `@11ty/eleventy` in a temporary
directory and run with `WEBMENTION_EXAMPLE_ENGINES=/absolute/path/to/that/directory`.
The Liquid test supplies Jekyll's `absolute_url` behavior; it is not a full Jekyll
site build. Set `WEBMENTION_JEKYLL_EXE` to an installed Jekyll executable (and
`WEBMENTION_JEKYLL_RUBY` if needed) to run the complete Jekyll fixture build test.
Use your normal Ruby gem environment. The fixture was also validated with a real
Jekyll 3.9.5 Markdown build and a complete Next.js 16 static export; both generated
the canonical URL and backlink in `/reply/index.html`. The tests make no real
Webmention submissions.
