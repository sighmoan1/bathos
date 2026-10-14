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

function renderMarkdownTable(text: string) {
  const rows = text.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (rows.length < 2 || !rows[1].split("|").every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell))) return null

  const cells = (row: string) => row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim())
  const headings = cells(rows[0])
  if (!headings.length || headings.some((cell) => !cell)) return null
  const alignments = cells(rows[1]).map((cell) => cell.startsWith(":") ? (cell.endsWith(":") ? "center" : "left") : (cell.endsWith(":") ? "right" : undefined))
  const body = rows.slice(2).map(cells)
  if (body.some((row) => row.length !== headings.length)) return null

  return (
    <div className="my-6 max-w-full overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead><tr>{headings.map((cell, index) => <th key={index} scope="col" className="border-b px-3 py-2 font-semibold" style={{ textAlign: alignments[index] }}>{cell}</th>)}</tr></thead>
        <tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={index} className="border-b px-3 py-2" style={{ textAlign: alignments[index] }}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

const ArticleMarkdownParagraph: NonNullable<Components["p"]> = ({ node: _node, children, ...props }) => {
  const text = typeof children === "string" ? children : Array.isArray(children) && children.every((child): child is string => typeof child === "string") ? children.join("") : null
  const table = text ? renderMarkdownTable(text) : null
  if (Array.isArray(children) && children.length === 1 && isValidElement(children[0]) && children[0].type === "figure") return children[0]
  return table ?? <p {...props}>{children as ReactNode}</p>
}

export const articleMarkdownComponents: Components = { a: ArticleMarkdownAnchor, p: ArticleMarkdownParagraph }
