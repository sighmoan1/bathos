const FENCE = /```/g

/**
 * Plain-text opening paragraphs for a feed slide. Headings, code, images,
 * tables and raw HTML are skipped; inline Markdown is reduced to its text.
 */
export function previewParagraphs(markdown: string, limit = 4, skip?: string): string[] {
  const paragraphs: string[] = []
  let inFence = false
  for (const block of markdown.trim().split(/\n\s*\n/)) {
    const text = block.trim()
    const fences = (text.match(FENCE) || []).length
    if (inFence || text.startsWith("```")) {
      if (fences % 2 === 1) inFence = !inFence
      continue
    }
    if (/^(#|!\[|<|\|)/.test(text)) continue
    const plain = text
      .replace(/^\s*(?:[-*+>]|\d+\.)\s+/gm, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .replace(/\s+/g, " ")
      .trim()
    if (!plain || plain === skip) continue
    paragraphs.push(plain)
    if (paragraphs.length >= limit) break
  }
  return paragraphs
}

export function readingMinutes(markdown: string): number {
  return Math.max(1, Math.round(markdown.split(/\s+/).filter(Boolean).length / 230))
}
