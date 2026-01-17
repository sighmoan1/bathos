import fs from "fs"
import path from "path"
import matter from "gray-matter"

export interface Article {
  slug: string
  title: string
  description: string
  content: string
  date?: string
  tags?: string[]
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
  }
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
