import type { Components } from "react-markdown"
import { isValidElement, type ReactNode } from "react"

const localVideoPath = /^\/images\/posts\/[A-Za-z0-9-]+(?:\/[A-Za-z0-9-]+)*\.mp4$/

export const ArticleMarkdownAnchor: NonNullable<Components["a"]> = ({ node: _node, href, children, ...props }) => {
  if (href && localVideoPath.test(href)) {
    const captions = href.replace(/\.mp4$/, ".en.vtt")
    const label = typeof children === "string" ? children : "Article video"
    return (
      <figure className="my-8">
        <video className="block h-auto w-full" controls preload="metadata" aria-label={label}>
          <source src={href} type="video/mp4" />
          <track kind="captions" src={captions} srcLang="en" label="English" default />
          Your browser does not support embedded video.
        </video>
        <figcaption className="mt-2 text-sm">
          {children}. <a href={href}>Open or download the video</a>; <a href={captions}>download the captions</a>.
        </figcaption>
      </figure>
    )
  }
  return <a href={href} {...props}>{children}</a>
}

type MarkdownNode = { type: string; value?: string; children?: MarkdownNode[]; align?: ("left" | "center" | "right" | null)[] }

function renderMarkdownTable(text: string): MarkdownNode | null {
  const rows = text.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (rows.length < 2 || !rows[1].split("|").every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell))) return null

  const cells = (row: string) => row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim())
  const headings = cells(rows[0])
  if (!headings.length || headings.some((cell) => !cell)) return null
  const alignments = cells(rows[1]).map((cell) => cell.startsWith(":") ? (cell.endsWith(":") ? "center" : "left") : (cell.endsWith(":") ? "right" : null))
  const body = rows.slice(2).map(cells)
  if (alignments.length !== headings.length || body.some((row) => row.length !== headings.length)) return null
  const tableRow = (row: string[]): MarkdownNode => ({ type: "tableRow", children: row.map((value) => ({ type: "tableCell", children: [{ type: "text", value }] })) })
  return { type: "table", align: alignments, children: [tableRow(headings), ...body.map(tableRow)] }
}

function markdownText(node: MarkdownNode): string | null {
  if (node.type === "text") return node.value ?? ""
  if (node.type === "break") return "\n"
  if (node.children) {
    const parts = node.children.map(markdownText)
    return parts.every((part) => part !== null) ? parts.join("") : null
  }
  return null
}

export function remarkPipeTables() {
  return (tree: MarkdownNode) => {
    const transform = (parent: MarkdownNode) => {
      if (!parent.children) return
      parent.children = parent.children.flatMap((child) => {
        if (child.type === "paragraph") {
          const tableText = markdownText(child)
          const table = tableText ? renderMarkdownTable(tableText) : null
          if (table) return [table]
        }
        transform(child)
        return [child]
      })
    }
    transform(tree)
  }
}

const ArticleMarkdownTable: NonNullable<Components["table"]> = ({ node: _node, children, ...props }) => (
  <div className="my-6 max-w-full overflow-x-auto">
    <table className="min-w-full border-collapse text-left text-sm" {...props}>{children}</table>
  </div>
)

export const articleMarkdownComponents: Components = { a: ArticleMarkdownAnchor, table: ArticleMarkdownTable }
