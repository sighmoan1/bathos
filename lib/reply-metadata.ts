/** Normalize optional IndieWeb reply frontmatter. Invalid input fails the build. */
export function parseInReplyTo(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new Error("inReplyTo must be a list of absolute HTTP(S) URLs")

  return [...new Set(value.map((target) => {
    if (typeof target !== "string" || target.trim() !== target || /[\u0000-\u0020\u007f]/.test(target)) {
      throw new Error("inReplyTo entries must be absolute HTTP(S) URLs without whitespace")
    }
    let url: URL
    try { url = new URL(target) } catch { throw new Error("inReplyTo entries must be absolute HTTP(S) URLs") }
    if (!/^https?:\/\//i.test(target) || !["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("inReplyTo entries must be absolute HTTP(S) URLs without credentials")
    }
    return url.href
  }))]
}
