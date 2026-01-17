"use client"

import { ArrowLeft, Bookmark, X } from "lucide-react"
import type { Article } from "@/lib/articles"
import ReactMarkdown from "react-markdown"
import { motion } from "framer-motion"

interface ArticleReaderProps {
  article: Article
  onClose: () => void
  onSave: () => void
  onDismiss: () => void
}

export function ArticleReader({ article, onClose, onSave, onDismiss }: ArticleReaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed inset-0 bg-background z-50 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-lg border-b border-border z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <div className="flex gap-2">
            <button
              onClick={onDismiss}
              className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              title="Never show again"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              onClick={onSave}
              className="p-2 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors"
              title="Save for later"
            >
              <Bookmark className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <article className="max-w-3xl mx-auto px-4 py-8 pb-20">
        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-accent/50 text-accent-foreground text-xs font-medium rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">{article.title}</h1>

        {article.date && (
          <p className="text-muted-foreground mb-8">
            {new Date(article.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}

        <div className="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-code:text-accent prose-pre:bg-secondary prose-pre:border prose-pre:border-border">
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </div>
      </article>
    </motion.div>
  )
}
