"use client"

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react"
import { AnimatePresence } from "framer-motion"
import {
  Rss,
  Bookmark,
  BookOpen,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react"
import type { Article, TagCount } from "@/lib/articles"
import { postPath } from "@/lib/post-links"
import { ArticleCard } from "./article-card"
import { ArticleReader } from "./article-reader"
import { ArticleListPanel } from "./article-list-panel"
import { TagFilter } from "./tag-filter"
import { useMobileLayout } from "@/lib/use-mobile-layout"
import { ReaderPwa } from "./reader-pwa"
import { useFeedKeyboard, useFeedWheel } from "@/lib/use-feed-controls"

interface SwipeFeedProps {
  initialArticles: Article[]
  allTags: TagCount[]
  initialReadingArticle?: Article
}

const DISMISSED_KEY = "swipe-reader-dismissed"
const SAVED_KEY = "swipe-reader-saved"
const TAGS_KEY = "swipe-reader-tags"

export function SwipeFeed({ initialArticles, allTags, initialReadingArticle }: SwipeFeedProps) {
  useMobileLayout()
  const [dismissed, setDismissed] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [currentSlug, setCurrentSlug] = useState<string | null>(null)
  const [readingArticle, setReadingArticle] = useState<Article | null>(initialReadingArticle ?? null)
  const [showSaved, setShowSaved] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const openArticle = useCallback((article: Article) => {
    window.history.pushState(null, "", postPath(article.slug))
    setReadingArticle(article)
  }, [])

  const closeArticle = useCallback(() => {
    window.history.pushState(null, "", "/")
    setReadingArticle(null)
  }, [])

  useEffect(() => {
    const syncLocation = () => {
      const article = initialArticles.find((post) => postPath(post.slug) === window.location.pathname)
      setReadingArticle(article ?? null)
      setShowSaved(false)
      setShowTrash(false)
    }
    window.addEventListener("popstate", syncLocation)
    return () => window.removeEventListener("popstate", syncLocation)
  }, [initialArticles])

  // Load preferences from localStorage
  useEffect(() => {
    const storedDismissed = localStorage.getItem(DISMISSED_KEY)
    const storedSaved = localStorage.getItem(SAVED_KEY)
    const storedTags = localStorage.getItem(TAGS_KEY)

    if (storedDismissed) setDismissed(JSON.parse(storedDismissed))
    if (storedSaved) setSaved(JSON.parse(storedSaved))
    if (storedTags) {
      const tags = JSON.parse(storedTags)
      setSelectedTags(tags)
      // Show which filter is narrowing the feed rather than leaving the user
      // to wonder why most articles are missing.
      if (tags.length > 0) setShowFilters(true)
    }
    setIsLoaded(true)
  }, [])

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

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(TAGS_KEY, JSON.stringify(selectedTags))
    }
  }, [selectedTags, isLoaded])

  // The deck is derived, never re-shuffled. `initialArticles` arrives already
  // shuffled from the server, so its order is stable for the whole session and
  // dismissing a card no longer scrambles the feed.
  const articles = useMemo(
    () =>
      initialArticles.filter((article) => {
        if (dismissed.includes(article.slug)) return false
        if (selectedTags.length === 0) return true
        return (article.tags || []).some((tag) => selectedTags.includes(tag))
      }),
    [initialArticles, dismissed, selectedTags],
  )

  // Position is anchored to a slug rather than an index, so it survives the
  // deck changing underneath it. When the anchored article disappears (it was
  // dismissed, or filtered out) we fall back to the same slot, which now holds
  // whatever came next.
  const lastIndexRef = useRef(0)
  const currentIndex = useMemo(() => {
    if (articles.length === 0) return 0
    const found = currentSlug ? articles.findIndex((a) => a.slug === currentSlug) : -1
    return found >= 0 ? found : Math.min(lastIndexRef.current, articles.length - 1)
  }, [articles, currentSlug])

  useEffect(() => {
    lastIndexRef.current = currentIndex
    const article = articles[currentIndex]
    if (article && article.slug !== currentSlug) {
      setCurrentSlug(article.slug)
    }
  }, [articles, currentIndex, currentSlug])

  const currentArticle = articles[currentIndex]
  const hasArticles = articles.length > 0
  const hasPrevious = articles.length > 1
  const hasNext = articles.length > 1

  // Functional update so navigations that land in the same React batch compose
  // (two quick clicks move two cards) instead of collapsing into one.
  const step = useCallback(
    (delta: number) => {
      setCurrentSlug((prev) => {
        if (articles.length === 0) return prev
        const from = prev ? articles.findIndex((a) => a.slug === prev) : -1
        const base = from >= 0 ? from : Math.min(lastIndexRef.current, articles.length - 1)
        const next = ((base + delta) % articles.length + articles.length) % articles.length
        return articles[next].slug
      })
    },
    [articles],
  )

  const handleSwipeUp = useCallback(() => step(1), [step])
  const handleSwipeDown = useCallback(() => step(-1), [step])

  const dismiss = useCallback((slug: string) => {
    setDismissed((prev) => (prev.includes(slug) ? prev : [...prev, slug]))
  }, [])

  const handleSwipeLeft = useCallback(() => {
    // No index change needed: the card leaves the deck and the anchor falls
    // through to whatever takes its slot.
    if (currentArticle) dismiss(currentArticle.slug)
  }, [currentArticle, dismiss])

  const handleSwipeRight = useCallback(() => {
    if (currentArticle && !saved.includes(currentArticle.slug)) {
      setSaved((prev) => [...prev, currentArticle.slug])
    }
    step(1)
  }, [currentArticle, saved, step])

  const handleReadMore = useCallback(() => {
    if (currentArticle) openArticle(currentArticle)
  }, [currentArticle, openArticle])

  const handleReaderClose = closeArticle

  const handleReaderSave = useCallback(() => {
    if (readingArticle && !saved.includes(readingArticle.slug)) {
      setSaved((prev) => [...prev, readingArticle.slug])
    }
    closeArticle()
    step(1)
  }, [readingArticle, saved, step, closeArticle])

  const handleReaderDismiss = useCallback(() => {
    if (readingArticle) dismiss(readingArticle.slug)
    closeArticle()
  }, [readingArticle, dismiss, closeArticle])

  const handleRestoreAll = useCallback(() => {
    setDismissed([])
  }, [])

  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
    setShowFilters(true)
  }, [])

  const handleTagClickFromReader = useCallback(
    (tag: string) => {
      handleToggleTag(tag)
      closeArticle()
    },
    [handleToggleTag, closeArticle],
  )

  const handleClearTags = useCallback(() => setSelectedTags([]), [])

  const overlayOpen = readingArticle !== null || showSaved || showTrash
  useFeedKeyboard(isLoaded && hasArticles && !overlayOpen, {
    onNext: handleSwipeUp,
    onPrevious: handleSwipeDown,
    onSkip: handleSwipeLeft,
    onSave: handleSwipeRight,
    onRead: handleReadMore,
  })

  const feedRef = useRef<HTMLElement>(null)
  useFeedWheel(feedRef, isLoaded && hasArticles && !overlayOpen, {
    onNext: handleSwipeUp,
    onPrevious: handleSwipeDown,
    onSkip: handleSwipeLeft,
    onSave: handleSwipeRight,
  })

  // Count only bookmarks that resolve in this catalog, just like the saved list.
  // Keep stored slugs so restored posts and older offline catalogs retain bookmarks.
  const savedArticles = initialArticles.filter((a) => saved.includes(a.slug))
  const trashedArticles = initialArticles.filter((a) => dismissed.includes(a.slug))

  // Mobile browsers scroll the background behind a fixed overlay unless the
  // body is pinned.
  useEffect(() => {
    if (!overlayOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [overlayOpen])

  if (!isLoaded && !readingArticle) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="reader-shell bg-background">
      <div data-reader-background className="contents">
      {/* Header */}
      <header className="relative z-20 bg-background/80 backdrop-blur-lg border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="w-full px-4 md:px-8 py-3">
          <div className="reader-header-row flex items-center justify-between">
            <div className="flex items-center gap-3"><h1 className="text-lg font-bold text-foreground">Bathos</h1><a href="/articles/" className="inline-flex min-h-11 items-center text-xs text-muted-foreground hover:text-foreground">Articles</a><a href="/subscribe/" aria-label="Subscribe to Bathos" className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Rss size={16} /><span className="reader-subscribe-label">Subscribe</span></a></div>
            <div className="reader-header-tools flex items-center gap-1">
              <ReaderPwa />
              {hasArticles && (
                <span className="text-xs text-muted-foreground mr-1">
                  {currentIndex + 1} / {articles.length}
                </span>
              )}
              <button
                onClick={() => setShowFilters((prev) => !prev)}
                aria-label="Filter by tag"
                aria-pressed={showFilters}
                className={`relative p-2 rounded-lg transition-colors ${
                  showFilters ? "bg-secondary" : "hover:bg-secondary"
                }`}
              >
                <SlidersHorizontal className="w-5 h-5 text-foreground" />
                {selectedTags.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-accent-foreground text-xs font-bold rounded-full flex items-center justify-center">
                    {selectedTags.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowTrash(true)}
                aria-label="Open articles hidden on this device"
                className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <Trash2 className="w-5 h-5 text-foreground" />
                {/* Binning is recoverable and not an achievement, so this
                    count stays quiet — the saved count is the prominent one. */}
                {dismissed.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-muted text-muted-foreground border border-border text-xs font-bold rounded-full flex items-center justify-center">
                    {dismissed.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowSaved(true)}
                aria-label="Open saved articles"
                data-dialog-fallback
                className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <Bookmark className="w-5 h-5 text-foreground" />
                {savedArticles.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-success text-success-foreground text-xs font-bold rounded-full flex items-center justify-center">
                    {savedArticles.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="pt-3">
              <TagFilter
                tags={allTags}
                selected={selectedTags}
                onToggle={handleToggleTag}
                onClear={handleClearTags}
              />
            </div>
          )}
        </div>
      </header>

      <main
        ref={feedRef}
        className="reader-feed"
      >
        {/* The deck takes the remaining viewport after the bars. */}
        <div className="reader-deck">
          {hasArticles ? (
            <>
              <div className="reader-current relative z-10">
                {/* popLayout, not "wait": the outgoing card is pulled out of
                    flow so the next one appears immediately, which keeps rapid
                    keyboard/wheel navigation snappy. */}
                <AnimatePresence mode="popLayout" initial={false}>
                  <ArticleCard
                    key={currentArticle.slug}
                    article={currentArticle}
                    onSwipeLeft={handleSwipeLeft}
                    onSwipeRight={handleSwipeRight}
                    onSwipeUp={handleSwipeUp}
                    onSwipeDown={handleSwipeDown}
                    onReadMore={handleReadMore}
                    onTagClick={handleToggleTag}
                    selectedTags={selectedTags}
                    isTop={true}
                    hasPrevious={hasPrevious}
                    hasNext={hasNext}
                  />
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center px-4 py-12">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Bookmark className="w-8 h-8 text-muted-foreground" />
              </div>

              {selectedTags.length > 0 ? (
                <>
                  <h2 className="text-xl font-bold text-foreground mb-2">No articles match these tags</h2>
                  <p className="text-muted-foreground text-sm mb-4">
                    Nothing left tagged {selectedTags.map((t) => `"${t}"`).join(" or ")}.
                  </p>
                  <button
                    onClick={handleClearTags}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                    Clear filters
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-foreground mb-2">{"You've seen all articles!"}</h2>
                  <p className="text-muted-foreground text-sm mb-4">
                    {dismissed.length > 0
                      ? `You've binned ${dismissed.length} article${dismissed.length === 1 ? "" : "s"}.`
                      : "No articles available."}
                  </p>
                  {dismissed.length > 0 && (
                    <button
                      onClick={handleRestoreAll}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restore all from Trash
                    </button>
                  )}
                </>
              )}

              {savedArticles.length > 0 && (
                <button
                  onClick={() => setShowSaved(true)}
                  className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  <Bookmark className="w-4 h-4" />
                  View Saved ({savedArticles.length})
                </button>
              )}
            </div>
          )}
        </div>

        {hasArticles && (
          <div className="reader-controls border-t border-border py-3 short:py-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] short:pb-[calc(0.375rem+env(safe-area-inset-bottom))]">
            <div className="w-full px-4 md:px-8">
              <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                <ControlButton
                  onClick={handleSwipeLeft}
                  icon={<X className="w-4 h-4 text-destructive" />}
                  iconClassName="bg-destructive/10"
                  label="Skip"
                  hint="←"
                />
                <ControlButton
                  onClick={handleSwipeRight}
                  icon={<Bookmark className="w-4 h-4 text-success" />}
                  iconClassName="bg-success/10"
                  label="Save"
                  hint="→"
                />
                <ControlButton
                  onClick={handleSwipeDown}
                  disabled={!hasPrevious}
                  icon={<ChevronUp className="w-4 h-4 text-secondary-foreground" />}
                  iconClassName="bg-secondary"
                  label="Previous"
                  hint="↑"
                />
                <ControlButton
                  onClick={handleSwipeUp}
                  disabled={!hasNext}
                  icon={<ChevronDown className="w-4 h-4 text-accent-foreground" />}
                  iconClassName="bg-accent/20"
                  label="Next"
                  hint="↓"
                />
              </div>
            </div>
          </div>
        )}
      </main>

      </div>

      {/* Article Reader Modal */}
      <AnimatePresence>
        {readingArticle && (
          <ArticleReader
            article={readingArticle}
            animateEntry={isLoaded || !initialReadingArticle}
            onClose={handleReaderClose}
            onSave={handleReaderSave}
            onDismiss={handleReaderDismiss}
            onTagClick={handleTagClickFromReader}
          />
        )}
      </AnimatePresence>

      {/* Saved Articles Panel */}
      <AnimatePresence>
        {showSaved && (
          <ArticleListPanel
            title="Saved Articles"
            articles={savedArticles}
            emptyIcon={BookOpen}
            emptyTitle="No saved articles yet"
            emptyHint="Swipe right (or press →) on articles to save them for later"
            onClose={() => setShowSaved(false)}
            onSelect={(article) => {
              openArticle(article)
              setShowSaved(false)
            }}
            rowAction={{
              icon: Trash2,
              label: "Remove from saved",
              onAction: (slug) => setSaved((prev) => prev.filter((s) => s !== slug)),
            }}
          />
        )}
      </AnimatePresence>

      {/* Trash Panel */}
      <AnimatePresence>
        {showTrash && (
          <ArticleListPanel
            title="Hidden on this device"
            articles={trashedArticles}
            emptyIcon={Trash2}
            emptyTitle="No hidden articles"
            emptyHint="Swipe left (or press ←) to hide articles on this device"
            onClose={() => setShowTrash(false)}
            onSelect={(article) => {
              openArticle(article)
              setShowTrash(false)
            }}
            rowAction={{
              icon: RotateCcw,
              label: "Restore to feed",
              onAction: (slug) => setDismissed((prev) => prev.filter((s) => s !== slug)),
              className:
                "p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors",
            }}
            headerAction={{
              icon: RotateCcw,
              label: "Restore all",
              onAction: handleRestoreAll,
            }}
            footnote="This hides articles only in this browser. Posts remain on the site for everyone else. Restore them here at any time."
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ControlButton({
  onClick,
  disabled,
  icon,
  iconClassName,
  label,
  hint,
}: {
  onClick: () => void
  disabled?: boolean
  icon: ReactNode
  iconClassName: string
  label: string
  hint: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex flex-col items-center gap-1 rounded-lg py-1 transition-opacity hover:opacity-80 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconClassName}`}>{icon}</div>
      <span className="short:hidden">
        {label}
        {/* Keyboard hints mean nothing on a touch device. */}
        <span className="reader-key-hint opacity-60 hidden sm:inline"> {hint}</span>
      </span>
    </button>
  )
}
