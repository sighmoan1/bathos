"use client"

import type { ComponentType } from "react"
import { ArrowLeft } from "lucide-react"
import type { Article } from "@/lib/articles"
import { motion, useReducedMotion } from "framer-motion"
import { useReaderDialog } from "@/lib/use-reader-dialog"

interface RowAction {
  icon: ComponentType<{ className?: string }>
  label: string
  onAction: (slug: string) => void
  className?: string
}

interface HeaderAction {
  icon: ComponentType<{ className?: string }>
  label: string
  onAction: () => void
}

interface ArticleListPanelProps {
  title: string
  articles: Article[]
  emptyIcon: ComponentType<{ className?: string }>
  emptyTitle: string
  emptyHint: string
  onClose: () => void
  onSelect: (article: Article) => void
  rowAction: RowAction
  headerAction?: HeaderAction
  footnote?: string
}

/** Full-screen overlay listing a collection of articles (Saved, Trash). */
export function ArticleListPanel({
  title,
  articles,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyHint,
  onClose,
  onSelect,
  rowAction,
  headerAction,
  footnote,
}: ArticleListPanelProps) {
  const RowIcon = rowAction.icon
  const HeaderIcon = headerAction?.icon

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
      initial={{ opacity: 0, x: reducedMotion ? 0 : 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: reducedMotion ? 0 : 300 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
      className="fixed inset-0 bg-background z-50 overflow-y-auto overscroll-contain"
    >
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-lg border-b border-border z-10 pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 id={titleId} className="text-xl font-bold">{title}</h1>
          {headerAction && HeaderIcon && articles.length > 0 && (
            <button
              onClick={headerAction.onAction}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:opacity-80 transition-opacity"
            >
              <HeaderIcon className="w-4 h-4" />
              {headerAction.label}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {articles.length === 0 ? (
          <div className="text-center py-20">
            <EmptyIcon className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-lg">{emptyTitle}</p>
            <p className="text-muted-foreground/60 text-sm mt-2">{emptyHint}</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {articles.map((article) => (
                <div key={article.slug} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4">
                  <button type="button" aria-label={`Read ${article.title}`} className="flex-grow text-left" onClick={() => onSelect(article)}>
                    <span className="block font-semibold text-foreground mb-1">{article.title}</span>
                    <span className="block text-muted-foreground text-sm line-clamp-2">{article.description}</span>
                    {article.tags && article.tags.length > 0 && (
                      <span className="flex flex-wrap gap-1 mt-2">
                        {article.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-accent/30 text-accent-foreground text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => rowAction.onAction(article.slug)}
                    title={rowAction.label}
                    aria-label={`${rowAction.label}: ${article.title}`}
                    className={
                      rowAction.className ??
                      "p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    }
                  >
                    <RowIcon className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
            {footnote && <p className="text-muted-foreground/60 text-xs text-center mt-8">{footnote}</p>}
          </>
        )}
      </div>
    </motion.div>
  )
}
