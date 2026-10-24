import { getAllArticles } from "@/lib/articles"
import { buildAgentCatalog } from "@/lib/agent-discovery"

export const dynamic = "force-static"

export function GET() {
  return new Response(JSON.stringify(buildAgentCatalog(getAllArticles())), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}
