import { getAllArticles } from "@/lib/articles"
import { buildArticleCatalog } from "@/lib/article-discovery"

export const dynamic = "force-static"

export function GET() {
  return Response.json(buildArticleCatalog(getAllArticles()))
}
