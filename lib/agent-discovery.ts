import type { Article } from "./articles"
import { buildArticleCatalog } from "./article-discovery"
import { SITE_URL } from "./site"

export function markdownUrl(slug: string): string {
  return `${SITE_URL}/posts/${encodeURIComponent(slug)}/index.md`
}

export function buildAgentCatalog(articles: Article[]) {
  const bySlug = new Map(articles.map(article => [article.slug, article]))
  const catalog = buildArticleCatalog(articles)
  return {
    ...catalog,
    articles: catalog.articles.map(article => ({
      ...article,
      markdownUrl: markdownUrl(article.slug),
      content: bySlug.get(article.slug)!.content,
      inReplyTo: bySlug.get(article.slug)!.inReplyTo || [],
    })),
  }
}

// Keep exported text faithful to the source; metadata stays outside the article body.
export function buildArticleMarkdown(article: Article): string {
  const metadata = buildArticleCatalog([article]).articles[0]
  return `---\ntitle: ${JSON.stringify(article.title)}\nurl: ${JSON.stringify(metadata.canonicalUrl)}\n${metadata.date ? `date: ${JSON.stringify(metadata.date)}\n` : ""}tags: ${JSON.stringify(article.tags || [])}\ninReplyTo: ${JSON.stringify(article.inReplyTo || [])}\n---\n\n# ${article.title.replace(/[\r\n]+/g, " ")}\n\n${article.content.trim()}\n`
}

const inline = (value: string) => value.replace(/[\r\n]+/g, " ").replace(/([\\`*_[\]<>])/g, "\\$1")

export function buildLlmsIndex(articles: Article[]): string {
  const catalog = buildAgentCatalog(articles)
  return `# Bathos\n\n> Essays and experiments published on bathos.org.\n\nEach link below returns the complete article as Markdown. Publication dates are supplied when available; article views and conclusions belong to their respective publication dates. Publication and recency do not establish the human author's endorsement: check authorship, source context and live dialogue before attributing a current commitment.\n\n## Interfaces\n\n- [Article catalog](${SITE_URL}/articles.json): Titles, summaries, dates, tags and reading URLs.\n- [Full article data](${SITE_URL}/agent-posts.json): The catalog plus complete Markdown bodies.\n- [RSS feed](${SITE_URL}/rss.xml): Full article content.\n- [MCP setup](${SITE_URL}/mcp-guide/): Connect a compatible client to the public read-only MCP endpoint at ${SITE_URL}/mcp.\n- [Public brain](${SITE_URL}/brain/): Attributed interpretations, connections, competing perspectives and clarification questions.\n- [Brain data](${SITE_URL}/brain.json): Evidence, declared readers, revisions and ordinary backlinks.\n- [Another reader's protocol](${SITE_URL}/brain-agent.md): Read, question and contribute without pretending to speak for the author.\n\n## Articles\n\n${catalog.articles.map(article => `- [${inline(article.title)}](${article.markdownUrl}): ${inline(article.summary)}${article.date ? ` (${article.date})` : ""}`).join("\n")}\n`
}
