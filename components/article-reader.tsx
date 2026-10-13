"use client"

import { ArrowLeft, Bookmark, X } from "lucide-react"
import type { Article } from "@/lib/articles"
import ReactMarkdown from "react-markdown"
import { motion, useReducedMotion } from "framer-motion"
import { useReaderDialog } from "@/lib/use-reader-dialog"

import { postPath } from "@/lib/post-links"
import { ReplyContext } from "./reply-context"
import { WebmentionResponses } from "./webmention-responses"

import { ShareButton } from "./share-button"

interface ArticleReaderProps {
  article: Article
  animateEntry?: boolean
  onClose: () => void
  onSave: () => void
  onDismiss: () => void
  onTagClick: (tag: string) => void
}

export function ArticleReader({ article, onClose, onSave, onDismiss, onTagClick, animateEntry = true }: ArticleReaderProps) {
  const { ref, titleId, present } = useReaderDialog(onClose)
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal={present ? true : undefined}
      aria-labelledby={titleId}
      aria-hidden={!present || undefined}
      inert={!present}
      tabIndex={-1}
      data-reader-dialog={present ? "active" : "exiting"}
      initial={reducedMotion || !animateEntry ? false : { opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reducedMotion ? 0 : 50 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
      className="fixed inset-0 bg-background z-50 overflow-y-auto overscroll-contain"
    >
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-lg border-b border-border z-10 pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <div className="flex gap-2 items-center">
            <ShareButton article={article} />
            <button
              onClick={onDismiss}
              className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              title="Never show again"
              aria-label="Hide this article on this device"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              onClick={onSave}
              className="p-2 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors"
              title="Save for later"
              aria-label="Save for later"
            >
              <Bookmark className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <article className="h-entry max-w-3xl mx-auto px-4 py-8 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {article.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick(tag)}
                title={`Filter by "${tag}"`}
                className="px-3 py-1 bg-accent/50 text-accent-foreground text-xs font-medium rounded-full hover:bg-accent transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <h1 id={titleId} className="p-name text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">{article.title}</h1>

        <a className="u-url inline-block mb-4 text-sm underline text-muted-foreground" href={`https://bathos.org${postPath(article.slug)}`}>Permalink</a>
        <ReplyContext inReplyTo={article.inReplyTo} />

        {article.date && (
          <p className="text-muted-foreground mb-8">
            {new Date(article.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}

        <div className="e-content article-prose">
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </div>
        <WebmentionResponses target={`https://bathos.org${postPath(article.slug)}`} />
      </article>
    </motion.div>
  )
}
