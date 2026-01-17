"use client"

import { ArrowLeft, BookOpen, Trash2 } from "lucide-react"
import type { Article } from "@/lib/articles"
import { motion } from "framer-motion"

interface SavedArticlesProps {
  articles: Article[]
  onClose: () => void
  onSelect: (article: Article) => void
  onRemove: (slug: string) => void
}

export function SavedArticles({ articles, onClose, onSelect, onRemove }: SavedArticlesProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed inset-0 bg-background z-50 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-lg border-b border-border z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-xl font-bold">Saved Articles</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {articles.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-lg">No saved articles yet</p>
            <p className="text-muted-foreground/60 text-sm mt-2">Swipe right on articles to save them for later</p>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => (
              <div key={article.slug} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4">
                <div className="flex-grow cursor-pointer" onClick={() => onSelect(article)}>
                  <h3 className="font-semibold text-foreground mb-1">{article.title}</h3>
                  <p className="text-muted-foreground text-sm line-clamp-2">{article.description}</p>
                  {article.tags && article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {article.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-accent/30 text-accent-foreground text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onRemove(article.slug)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
