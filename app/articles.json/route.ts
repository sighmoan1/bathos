import { getAllArticles } from "@/lib/articles"
import { buildArticleCatalog } from "@/lib/article-discovery"

export const dynamic = "force-static"

export function GET() {
  return new Response(JSON.stringify(buildArticleCatalog(getAllArticles())), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}
