export function postPath(slug: string) {
  return `/posts/${encodeURIComponent(slug)}/`
}
