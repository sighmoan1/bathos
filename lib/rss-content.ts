import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkRehype from "remark-rehype"
import rehypeStringify from "rehype-stringify"

type HtmlNode = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: HtmlNode[] }

export function rssContent(markdown: string, canonicalUrl: string): string {
  function absoluteUrls() {
    return (tree: HtmlNode) => {
      function visit(node: HtmlNode) {
        for (const key of ["href", "src"]) {
          const value = node.properties?.[key]
          if (typeof value !== "string") continue
          try {
            const url = new URL(value, canonicalUrl)
            if (["https:", "http:"].includes(url.protocol) || (key === "href" && url.protocol === "mailto:")) node.properties![key] = url.href
            else delete node.properties![key]
          } catch { delete node.properties![key] }
        }
        node.children?.forEach(visit)
      }
      visit(tree)
    }
  }
  // Raw HTML is not enabled: scripts, handlers and embedded HTML never enter
  // the feed. Markdown still supports headings, lists, tables, code and images.
  return String(unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(absoluteUrls).use(rehypeStringify).processSync(markdown))
}
