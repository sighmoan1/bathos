import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"

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

type PipeTable = { headings: string[]; rows: string[][]; alignments: ("left" | "center" | "right" | undefined)[] }
type ArticlePart = { markdown: string } | { table: PipeTable }

function parsePipeTable(lines: string[]): PipeTable | null {
  const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim())
  if (lines.length < 2) return null
  const headings = cells(lines[0])
  const separators = cells(lines[1])
  if (!headings.length || separators.length !== headings.length || headings.some((cell) => !cell) || !separators.every((cell) => /^:?-{3,}:?$/.test(cell))) return null
  const rows = lines.slice(2).map(cells)
  if (rows.some((row) => row.length !== headings.length)) return null
  return {
    headings,
    rows,
    alignments: separators.map((cell) => cell.startsWith(":") ? (cell.endsWith(":") ? "center" : "left") : (cell.endsWith(":") ? "right" : undefined)),
  }
}

function articleParts(markdown: string): ArticlePart[] {
  const lines = markdown.split("\n")
  const parts: ArticlePart[] = []
  let segmentStart = 0
  let index = 0
  while (index < lines.length - 1) {
    if (!/^\s*\|.*\|\s*$/.test(lines[index]) || !/^\s*\|[\s:|-]+\|\s*$/.test(lines[index + 1])) { index++; continue }
    let end = index + 2
    while (end < lines.length && /^\s*\|.*\|\s*$/.test(lines[end])) end++
    const table = parsePipeTable(lines.slice(index, end))
    if (!table) { index++; continue }
    const before = lines.slice(segmentStart, index).join("\n")
    if (before.trim()) parts.push({ markdown: before })
    parts.push({ table })
    index = end
    segmentStart = end
  }
  const after = lines.slice(segmentStart).join("\n")
  if (after.trim()) parts.push({ markdown: after })
  return parts.length ? parts : [{ markdown }]
}

function ArticleMarkdownTable({ table }: { table: PipeTable }) {
  return <div className="my-6 max-w-full overflow-x-auto">
    <table className="min-w-full border-collapse text-left text-sm">
      <thead><tr>{table.headings.map((heading, index) => <th key={index} scope="col" className="border-b px-3 py-2 font-semibold" style={{ textAlign: table.alignments[index] }}>{heading}</th>)}</tr></thead>
      <tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={index} className="border-b px-3 py-2" style={{ textAlign: table.alignments[index] }}>{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>
}

export const articleMarkdownComponents: Components = { a: ArticleMarkdownAnchor }

export function ArticleMarkdownContent({ children }: { children: string }) {
  return <>{articleParts(children).map((part, index) => "table" in part
    ? <ArticleMarkdownTable key={index} table={part.table} />
    : <ReactMarkdown key={index} components={articleMarkdownComponents}>{part.markdown}</ReactMarkdown>)}</>
}
