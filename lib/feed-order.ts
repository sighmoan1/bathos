const DAY_MS = 86_400_000
export const FEED_ORDER_KEY = "swipe-reader-order-v1"

/** A baseline of 1 keeps the archive competitive; the extra 3 halves monthly. */
export function publicationWeight(date: string | undefined, now: number): number {
  const published = date ? Date.parse(date) : NaN
  if (!Number.isFinite(published)) return 1
  const ageDays = Math.max(0, (now - published) / DAY_MS)
  return 1 + 3 * 2 ** (-ageDays / 30)
}

/** Exponential races sample without replacement, proportional to remaining weights. */
export function weightedShuffle<T extends { date?: string }>(
  articles: readonly T[], now = Date.now(), random = Math.random,
): T[] {
  return articles.map((article) => ({
    article,
    // 1 - random is in (0, 1], including when Math.random returns zero.
    score: -Math.log(1 - random()) / publicationWeight(article.date, now),
  })).sort((a, b) => a.score - b.score).map(({ article }) => article)
}

/** Retain surviving slugs and append new posts; never lose posts to stale storage. */
export function sessionFeedOrder<T extends { slug: string; date?: string }>(
  articles: readonly T[],
  storage?: Pick<Storage, "getItem" | "setItem">,
  now = Date.now(), random = Math.random,
): T[] {
  let previous: unknown
  try { previous = JSON.parse(storage?.getItem(FEED_ORDER_KEY) ?? "null") } catch { /* Start fresh. */ }
  const bySlug = new Map(articles.map((article) => [article.slug, article]))
  const ordered: T[] = []
  if (Array.isArray(previous) && previous.every((slug) => typeof slug === "string")) {
    for (const slug of previous) {
      const article = bySlug.get(slug)
      if (article) { ordered.push(article); bySlug.delete(slug) }
    }
  }
  ordered.push(...weightedShuffle([...bySlug.values()], now, random))
  try { storage?.setItem(FEED_ORDER_KEY, JSON.stringify(ordered.map(({ slug }) => slug))) } catch { /* In-memory order still works. */ }
  return ordered
}
