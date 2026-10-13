export interface WebmentionResponse {
  source: string
  target: string
  name: string
  author?: string
  published?: string
}

// The API is a moderation boundary; still validate every field before rendering.
export function verifiedResponses(payload: unknown, target: string): WebmentionResponse[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { responses?: unknown }).responses)) {
    throw new Error("Invalid response list")
  }
  const seen = new Set<string>()
  return (payload as { responses: unknown[] }).responses.slice(0, 100).flatMap((value) => {
    if (!value || typeof value !== "object") return []
    const row = value as Record<string, unknown>
    if (row.target !== target || typeof row.source !== "string") return []
    let source: URL
    try { source = new URL(row.source) } catch { return [] }
    if (!["https:", "http:"].includes(source.protocol) || source.username || source.password || seen.has(source.href)) return []
    if (row.status !== undefined && row.status !== "approved") return []
    seen.add(source.href)
    const plain = (text: unknown, limit: number) => typeof text === "string" ? text.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, limit) : ""
    const published = typeof row.published === "string" && /^\d{4}-\d{2}-\d{2}T/.test(row.published) && Number.isFinite(Date.parse(row.published)) ? row.published : undefined
    return [{ source: source.href, target, name: plain(row.name, 200) || source.hostname, author: plain(row.author, 100) || undefined, published }]
  })
}
