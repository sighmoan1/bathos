import { rssContent } from "./rss-content"

import { SITE_URL, FEED_URL } from "./site"
export { SITE_URL, FEED_URL } from "./site"

type FeedPost = { slug: string; title: string; description: string; content?: string; inReplyTo?: string[]; date?: string | null; tags?: string[] }
// XML 1.0 forbids control characters even when escaped.
const xml = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
const timestamp = (date?: string | null) => date && Number.isFinite(Date.parse(date)) ? Date.parse(date) : null

export function buildRss(posts: FeedPost[]): string {
  const sorted = [...posts].sort((a, b) => (timestamp(b.date) ?? -Infinity) - (timestamp(a.date) ?? -Infinity) || a.slug.localeCompare(b.slug))
  const latest = sorted.map(post => timestamp(post.date)).find(date => date !== null)
  const items = sorted.map(post => {
    const link = `${SITE_URL}/posts/${encodeURIComponent(post.slug)}/`
    const date = timestamp(post.date)
    const replies = (post.inReplyTo || []).map(target => `<p>In reply to <a href="${xml(target)}">${xml(target)}</a></p>`).join("")
    const fullText = replies + rssContent(post.content || post.description, link)
    return `<item><title>${xml(post.title)}</title><link>${xml(link)}</link><guid isPermaLink="true">${xml(link)}</guid><description>${xml(post.description)}</description><content:encoded>${xml(fullText)}</content:encoded>${date !== null ? `<pubDate>${new Date(date).toUTCString()}</pubDate>` : ""}${(post.tags || []).map(tag => `<category>${xml(tag)}</category>`).join("")}</item>`
  }).join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Bathos</title><link>${SITE_URL}/</link><description>New writing from Bathos.</description><language>en</language><atom:link href="${FEED_URL}" rel="self" type="application/rss+xml"/><ttl>60</ttl>${latest !== undefined && latest !== null ? `<lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>` : ""}\n${items}\n</channel></rss>\n`
}
