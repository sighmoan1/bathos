/** A receiver must be explicitly deployed; never invent an endpoint. */
export function webmentionEndpoint(value = process.env.NEXT_PUBLIC_WEBMENTION_ENDPOINT): string | null {
  if (!value) return null
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\s?#]/.test(value)) return null
  const url = new URL(value, "https://bathos.org")
  return url.origin === "https://bathos.org" && url.pathname !== "/" ? url.pathname : null
}

function publicUrl(value: string): URL {
  let url: URL
  try { url = new URL(value.trim()) } catch { throw new Error("Enter a complete public URL, including https://.") }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash || url.port) {
    throw new Error("Use a public HTTP or HTTPS URL without credentials, a port or a fragment.")
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "")
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".localhost") || host.endsWith(".internal") || host === "localhost" || host.includes(":") || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    throw new Error("Use a publicly accessible website URL.")
  }
  if (url.href.length > 2048) throw new Error("The URL is too long (maximum 2048 characters).")
  return url
}

export function validateWebmentionSubmission(sourceValue: string, targetValue: string) {
  const source = publicUrl(sourceValue)
  const target = publicUrl(targetValue)
  if (target.origin !== "https://bathos.org" || !/^\/posts\/[^/]+\/$/.test(target.pathname) || target.search) {
    throw new Error("Choose a canonical Bathos article URL: https://bathos.org/posts/article-slug/.")
  }
  if (source.href === target.href) throw new Error("Your reply URL must be different from the Bathos article.")
  return { source: source.href, target: target.href }
}

export function webmentionResponseMessage(status: number): string {
  if (status >= 200 && status < 300) return "Received for verification. This does not confirm that the link has been verified or that your reply will be displayed."
  if (status === 429) return "Too many submissions. Please wait before trying again."
  if (status === 404 || status === 503) return "The receiver is currently unavailable. Please try again later."
  return "The receiver did not accept this submission. Check that your published reply links to the Bathos article and try again."
}
