import type { MetadataRoute } from "next"
import { getAllArticles } from "@/lib/articles"
import { buildArticleCatalog } from "@/lib/article-discovery"

export const dynamic = "force-static"

export default function sitemap(): MetadataRoute.Sitemap {
  // Publication dates are not modification dates; omit lastModified until tracked.
  return [{ url: "https://bathos.org/" }, { url: "https://bathos.org/articles/" }, ...buildArticleCatalog(getAllArticles()).articles.map(article => ({ url: article.canonicalUrl }))]
}
