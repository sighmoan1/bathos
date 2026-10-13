# Article discovery

`/articles.json` is a version 1 UTF-8 JSON catalog generated from the same Markdown loader as posts and the existing RSS 2.0 feed (`/rss.xml`). The document has `version`, `siteUrl`, `feedUrl`, and `articles`. Each article contains:

- `slug`: case-sensitive Markdown filename without its extension.
- `title` and `summary`: published frontmatter/loader values.
- `canonicalUrl`: absolute encoded `/posts/[slug]/` address; matches post metadata and RSS.
- `readingUrl`: absolute encoded `/read/[slug]/` address for conventional reading, provided by the reading-mode change (#33).
- `date`: real ISO publication date as supplied, or `null` if unavailable/invalid. Date-only values stay date-only.
- `tags`: published tags, or an empty array.

Articles sort by slug using code-point comparison. No build timestamps, randomized order, private content or admin endpoints appear in the catalog. Consumers should ignore unknown fields; incompatible schema changes require a new version.

`/sitemap.xml` includes the public homepage, the semantic `/articles/` index and every canonical post once. It omits `lastmod`: publication date is not a known modification date. `/robots.txt` links the sitemap and asks crawlers to avoid `/admin/` and `/manage/`; robots is discovery guidance, not access control. HTML metadata advertises RSS, the JSON catalog and sitemap. Existing RSS functionality remains unchanged; no duplicate Atom feed is needed.

Cloudflare Pages `_headers` assigns explicit UTF-8 content types and `max-age=0, must-revalidate` for catalog, sitemap and robots. Publishing rebuilds these static outputs automatically without changing the publishing workflow.

## Release validation

Run frozen application and worker installs and `pnpm verify:release` in the task worktree, with a dedicated static server/`READER_BASE_URL` during concurrent work. Node tests check determinism, dates, case and URL encoding; browser tests parse exported XML and JSON, compare every published slug with RSS and sitemap, and request canonical URLs. Existing RSS ordering/escaping/date tests continue to run.

Integration order: merge and deploy reading mode (#33), which supplies both `/articles/` and `/read/`, before this change. During final deployment validation, request every catalog `readingUrl` as well as every `canonicalUrl`; `/read/` cannot resolve in the standalone discovery branch before that integration. Require successful exact-head Pages check before merge and verify the exact merged deployment on `https://bathos.org`, including endpoint content types, cache headers and every catalog URL, before reporting it live. Use a fresh online session to avoid offline reader cache confusion.
