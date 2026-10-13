import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { parseInReplyTo } from "./reply-metadata"

export interface Article {
  slug: string
  title: string
  description: string
  content: string
  date?: string
  tags?: string[]
  inReplyTo?: string[]
}

const contentDirectory = path.join(process.cwd(), "content")

export function getAllArticles(): Article[] {
  // Ensure content directory exists
  if (!fs.existsSync(contentDirectory)) {
    return []
  }

  const fileNames = fs.readdirSync(contentDirectory)
  const articles = fileNames
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => {
      const slug = fileName.replace(/\.md$/, "")
      const fullPath = path.join(contentDirectory, fileName)
      const fileContents = fs.readFileSync(fullPath, "utf8")
      const { data, content } = matter(fileContents)

      return {
        slug,
        title: data.title || slug,
        description: data.description || content.slice(0, 150) + "...",
        content,
        date: data.date || null,
        tags: data.tags || [],
        inReplyTo: parseInReplyTo(data.inReplyTo),
      }
    })

  return articles
}

export function getArticleBySlug(slug: string): Article | null {
  const fullPath = path.join(contentDirectory, `${slug}.md`)

  if (!fs.existsSync(fullPath)) {
    return null
  }

  const fileContents = fs.readFileSync(fullPath, "utf8")
  const { data, content } = matter(fileContents)

  return {
    slug,
    title: data.title || slug,
    description: data.description || content.slice(0, 150) + "...",
    content,
    date: data.date || null,
    tags: data.tags || [],
    inReplyTo: parseInReplyTo(data.inReplyTo),
  }
}

export interface TagCount {
  tag: string
  count: number
}

export function getAllTags(articles: Article[]): TagCount[] {
  const counts = new Map<string, number>()

  for (const article of articles) {
    for (const tag of article.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }
  }

  return Array.from(counts, ([tag, count]) => ({ tag, count })).sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag),
  )
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
