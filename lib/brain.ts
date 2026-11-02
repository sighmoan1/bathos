import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { unified } from "unified"
import remarkParse from "remark-parse"
import { getAllArticles } from "./articles"
import { articleSlugFromUrl, buildBrain } from "./brain-core.mjs"

export type BrainReader = { id: string; name: string; model: string; run: string; provenance: string }
export type BrainSource = { slug: string; quote: string; revision: string; blob?: string; quotePresent: boolean; title: string; url: string; revisionUrl: string; status: "present" | "changed" | "missing" }
export type BrainEntry = { id: string; thread: string; reader: string; kind: "reading" | "connection" | "question" | "challenge" | "perspective" | "clarification"; createdAt: string; text: string; scope: string; sources: BrainSource[]; repliesTo: string[]; revises: string[]; revised: boolean; url: string; attributedTo?: string; testimonyUrl?: string }
export type BrainThread = { id: string; title: string; summary: string; issue: number | null; url: string; discussionUrl: string | null; entryIds: string[] }
export type BrainCatalog = { version: number; principle: string; updatedAt: string | null; guideUrl: string; readers: BrainReader[]; threads: BrainThread[]; entries: BrainEntry[]; links: { from: string; to: string }[]; articles: { slug: string; title: string; url: string; backlinks: string[]; threads: string[] }[] }
type MarkdownNode = { type: string; url?: string; identifier?: string; children?: MarkdownNode[] }

// Parse Markdown rather than finding links inside code samples with a regexp.
function linksIn(markdown: string): string[] {
  const tree = unified().use(remarkParse).parse(markdown) as MarkdownNode
  const definitions = new Map<string, string>()
  const nodes: MarkdownNode[] = []
  function walk(node: MarkdownNode) { nodes.push(node); for (const child of node.children || []) walk(child) }
  walk(tree)
  const identifier = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase()
  for (const node of nodes) if (node.type === "definition" && node.identifier && node.url && !definitions.has(identifier(node.identifier))) definitions.set(identifier(node.identifier), node.url)
  return nodes.flatMap(node => node.type === "link" && node.url ? [node.url] : node.type === "linkReference" && node.identifier && definitions.has(identifier(node.identifier)) ? [definitions.get(identifier(node.identifier))!] : [])
}
export function getBrain(): BrainCatalog {
  const ledger = JSON.parse(fs.readFileSync(path.join(process.cwd(), "brain/ledger.json"), "utf8"))
  const articles = getAllArticles().map(article => {
    const raw = fs.readFileSync(path.join(process.cwd(), "content", `${article.slug}.md`))
    const blob = createHash("sha1").update(`blob ${raw.length}\0`).update(raw).digest("hex")
    return { ...article, blob }
  })
  const links = articles.flatMap(article => linksIn(article.content).flatMap(url => { const to = articleSlugFromUrl(url); return to ? [{ from: article.slug, to }] : [] }))
  return buildBrain(ledger, articles, links) as BrainCatalog
}
