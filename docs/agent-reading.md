# Reading Bathos with bots and agents

All published content uses the same `getAllArticles()` source as the reader,
RSS and sitemap; no second copy of the articles is maintained.

- `/posts/<slug>/` is the shared canonical article URL.
- `/read/<slug>/` is the conventional HTML reader.
- `/posts/<slug>/index.md` contains the complete source Markdown with title,
  canonical URL, publication date when known, and tags in YAML frontmatter.
- `/llms.txt` is a small Markdown index of all current posts and their exports.
  The root layout advertises it with `rel="describedby"`.
- `/agent-posts.json` is a version 1 JSON catalog for programmatic readers and
  the read-only MCP endpoint. It extends `/articles.json` records with
  `markdownUrl` and the complete raw Markdown `content`.
- `/rss.xml` already includes full rendered article bodies in `content:encoded`;
  `/sitemap.xml` already lists canonical article URLs.

The static build exports all these resources on every release. Post and read
pages advertise their Markdown alternative with
`rel="alternate" type="text/markdown"`. Explicit URLs work in clients that
cannot customize their `Accept` header. HTML and Markdown are generated from
one article source and have identical content; Markdown is an alternate
representation rather than a separate search identity.

`llms.txt` is a convenience for agents, not a claim that every crawler consumes
it or that it improves search ranking. No new training permission or crawler
policy is introduced. The existing `robots.txt` policy remains unchanged.

## Hosting access

`robots.txt` cannot override an edge denial or JavaScript challenge. Follow
[public-http-access.md](public-http-access.md) for the existing issue #50,
including the narrowly scoped Browser Integrity Check exception. That rule
must also cover GET/HEAD `/llms.txt` and `/agent-posts.json`. The existing
`/posts/` prefix already covers Markdown exports. MCP POST access needs its
own endpoint-specific inspection; never broaden the public-read exception to
all POST requests or the manager, admin or publishing API.

## Verification

Check a fresh production canonical article, conventional HTML reader,
Markdown export, `/llms.txt`, `/agent-posts.json`, RSS and sitemap with ordinary
browser, curl and Python user agents. Require meaningful content and expected
media types, not merely HTTP 200. Confirm the article body ends with the same
final paragraph in all representations. Every catalog record should have a
working canonical and Markdown URL. A missing slug must return 404.
