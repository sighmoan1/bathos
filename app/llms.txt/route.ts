import { getAllArticles } from "@/lib/articles"
import { buildLlmsIndex } from "@/lib/agent-discovery"

export const dynamic = "force-static"

export function GET() {
  return new Response(buildLlmsIndex(getAllArticles()), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
