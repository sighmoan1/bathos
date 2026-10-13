// Read at build time: do not advertise signup before the newsletter exists.
export function emailSubscriptionUrl(value = process.env.BATHOS_EMAIL_SUBSCRIBE_URL): string | null {
  if (!value) return null
  const url = new URL(value)
  if (url.protocol !== "https:" || url.hostname !== "buttondown.com" || url.username || url.password || url.port || !/^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname) || url.search || url.hash) {
    throw new Error("BATHOS_EMAIL_SUBSCRIBE_URL must be a hosted Buttondown newsletter URL")
  }
  return url.href
}
