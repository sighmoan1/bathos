import type { Article } from "./articles"
import { postPath } from "./post-links"
import { SITE_URL } from "./site"

// Accept real ISO publication dates only; do not turn missing dates into build times.
export function publicationDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null
  const day = value.slice(0, 10)
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed) || new Date(Date.parse(`${day}T00:00:00Z`)).toISOString().slice(0, 10) !== day) return null
  return value
}

export function buildArticleCatalog(articles: Article[]) {
  return {
    version: 1,
    siteUrl: SITE_URL,
    feedUrl: `${SITE_URL}/rss.xml`,
    articles: [...articles].sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0).map(article => ({
      slug: article.slug,
      title: article.title,
      summary: article.description,
      canonicalUrl: `${SITE_URL}${postPath(article.slug)}`,
      readingUrl: `${SITE_URL}/read/${encodeURIComponent(article.slug)}/`,
      date: publicationDate(article.date),
      tags: article.tags || [],
    })),
  }
}
