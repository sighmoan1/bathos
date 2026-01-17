"use client"

import { useState, useEffect, useCallback } from "react"
import { AnimatePresence } from "framer-motion"
import { Bookmark, RotateCcw, ChevronUp, ChevronDown, X } from "lucide-react"
import type { Article } from "@/lib/articles"
import { ArticleCard } from "./article-card"
import { ArticleReader } from "./article-reader"
import { SavedArticles } from "./saved-articles"

interface SwipeFeedProps {
  initialArticles: Article[]
}

const DISMISSED_KEY = "swipe-reader-dismissed"
const SAVED_KEY = "swipe-reader-saved"

export function SwipeFeed({ initialArticles }: SwipeFeedProps) {
  const [articles, setArticles] = useState<Article[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dismissed, setDismissed] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [readingArticle, setReadingArticle] = useState<Article | null>(null)
  const [showSaved, setShowSaved] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load preferences from localStorage
  useEffect(() => {
    const storedDismissed = localStorage.getItem(DISMISSED_KEY)
    const storedSaved = localStorage.getItem(SAVED_KEY)

    if (storedDismissed) setDismissed(JSON.parse(storedDismissed))
    if (storedSaved) setSaved(JSON.parse(storedSaved))
    setIsLoaded(true)
  }, [])

  // Filter and randomize articles
  useEffect(() => {
    if (!isLoaded) return

    const filtered = initialArticles.filter((article) => !dismissed.includes(article.slug))
    const shuffled = [...filtered].sort(() => Math.random() - 0.5)
    setArticles(shuffled)
    setCurrentIndex(0)
  }, [initialArticles, dismissed, isLoaded])

  // Save preferences to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed))
    }
  }, [dismissed, isLoaded])

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved))
    }
  }, [saved, isLoaded])

  const handleSwipeLeft = useCallback(() => {
    const current = articles[currentIndex]
    if (current) {
      setDismissed((prev) => [...prev, current.slug])
    }
  }, [articles, currentIndex])

  const handleSwipeRight = useCallback(() => {
    const current = articles[currentIndex]
    if (current && !saved.includes(current.slug)) {
      setSaved((prev) => [...prev, current.slug])
    }
    setCurrentIndex((prev) => Math.min(prev + 1, articles.length - 1))
  }, [articles, currentIndex, saved])

  const handleSwipeUp = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, articles.length - 1))
  }, [articles.length])

  const handleSwipeDown = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const handleReadMore = useCallback(() => {
    const current = articles[currentIndex]
    if (current) {
      setReadingArticle(current)
    }
  }, [articles, currentIndex])

  const handleReaderClose = useCallback(() => {
    setReadingArticle(null)
  }, [])

  const handleReaderSave = useCallback(() => {
    if (readingArticle && !saved.includes(readingArticle.slug)) {
      setSaved((prev) => [...prev, readingArticle.slug])
    }
    setReadingArticle(null)
    setCurrentIndex((prev) => Math.min(prev + 1, articles.length - 1))
  }, [readingArticle, saved, articles.length])

  const handleReaderDismiss = useCallback(() => {
    if (readingArticle) {
      setDismissed((prev) => [...prev, readingArticle.slug])
    }
    setReadingArticle(null)
  }, [readingArticle])

  const handleReset = useCallback(() => {
    setDismissed([])
    localStorage.removeItem(DISMISSED_KEY)
  }, [])

  const savedArticles = initialArticles.filter((a) => saved.includes(a.slug))
  const currentArticle = articles[currentIndex]
  const hasArticles = articles.length > 0 && currentIndex < articles.length

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">Swipe Reader</h1>
          <div className="flex items-center gap-2">
            {hasArticles && (
              <span className="text-xs text-muted-foreground">
                {currentIndex + 1} / {articles.length}
              </span>
            )}
            <button
              onClick={() => setShowSaved(true)}
              className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <Bookmark className="w-5 h-5 text-foreground" />
              {saved.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-accent-foreground text-xs font-bold rounded-full flex items-center justify-center">
                  {saved.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="pt-16 pb-24 px-4 min-h-screen flex flex-col items-center justify-center">
        <div className="w-full max-w-md">
          {hasArticles ? (
            <AnimatePresence mode="wait">
              <ArticleCard
                key={currentArticle.slug}
                article={currentArticle}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                onSwipeUp={handleSwipeUp}
                onSwipeDown={handleSwipeDown}
                onReadMore={handleReadMore}
                isTop={true}
                hasPrevious={currentIndex > 0}
                hasNext={currentIndex < articles.length - 1}
              />
            </AnimatePresence>
          ) : (
            <div className="flex flex-col items-center justify-center text-center px-4 py-12">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Bookmark className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">{"You've seen all articles!"}</h2>
              <p className="text-muted-foreground text-sm mb-4">
                {dismissed.length > 0
                  ? `You've dismissed ${dismissed.length} article${dismissed.length === 1 ? "" : "s"}.`
                  : "No articles available."}
              </p>
              {dismissed.length > 0 && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset & See All Again
                </button>
              )}
              {saved.length > 0 && (
                <button
                  onClick={() => setShowSaved(true)}
                  className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  <Bookmark className="w-4 h-4" />
                  View Saved ({saved.length})
                </button>
              )}
            </div>
          )}
        </div>

        {hasArticles && (
          <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border py-3">
            <div className="max-w-md mx-auto px-4">
              <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                    <X className="w-4 h-4 text-destructive" />
                  </div>
                  <span>Left: Skip</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                    <Bookmark className="w-4 h-4 text-success" />
                  </div>
                  <span>Right: Save</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                    <ChevronUp className="w-4 h-4 text-accent-foreground" />
                  </div>
                  <span>Up: Next</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <ChevronDown className="w-4 h-4 text-secondary-foreground" />
                  </div>
                  <span>Down: Prev</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Article Reader Modal */}
      <AnimatePresence>
        {readingArticle && (
          <ArticleReader
            article={readingArticle}
            onClose={handleReaderClose}
            onSave={handleReaderSave}
            onDismiss={handleReaderDismiss}
          />
        )}
      </AnimatePresence>

      {/* Saved Articles Panel */}
      <AnimatePresence>
        {showSaved && (
          <SavedArticles
            articles={savedArticles}
            onClose={() => setShowSaved(false)}
            onSelect={(article) => {
              setReadingArticle(article)
              setShowSaved(false)
            }}
            onRemove={(slug) => {
              setSaved((prev) => prev.filter((s) => s !== slug))
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
