import { getAllArticles, getArticleBySlug } from "@/lib/articles"
import { buildArticleMarkdown } from "@/lib/agent-discovery"

export const dynamic = "force-static"
export const dynamicParams = false

export function generateStaticParams() {
  return getAllArticles().map(article => ({ slug: article.slug }))
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) return new Response("Article not found", { status: 404 })
  return new Response(buildArticleMarkdown(article), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  })
}
