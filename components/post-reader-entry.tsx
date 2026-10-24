"use client"

import { useEffect, useState, type ReactNode } from "react"
import type { Article, TagCount } from "@/lib/articles"
import { SwipeFeed } from "./swipe-feed"

// Enhance a complete server-rendered article only after hydration. Rendering the
// feed on the server leaks every preview into article extraction and buries the
// requested text inside a modal that some readers intentionally ignore.
export function PostReaderEntry({ articles, allTags, article, children }: {
  articles: Article[]
  allTags: TagCount[]
  article: Article
  children: ReactNode
}) {
  const [interactive, setInteractive] = useState(false)
  useEffect(() => setInteractive(true), [])
  if (!interactive) return children
  return <div data-swipe-reader className="contents"><SwipeFeed initialArticles={articles} allTags={allTags} initialReadingArticle={article} /></div>
}
