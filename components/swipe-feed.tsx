"use client"

import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react"
import { animate, AnimatePresence, useReducedMotion, type AnimationPlaybackControls } from "framer-motion"
import {
  Bookmark,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Download,
  MoreHorizontal,
  RotateCcw,
  Rss,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react"
import type { Article, TagCount } from "@/lib/articles"
import { sessionFeedOrder } from "@/lib/feed-order"
import { postPath } from "@/lib/post-links"
import { FeedSlide } from "./feed-slide"
import { ArticleReader } from "./article-reader"
import { ArticleListPanel } from "./article-list-panel"
import { TagFilter } from "./tag-filter"
import { useMobileLayout } from "@/lib/use-mobile-layout"
import { InstallHelp, useReaderPwa } from "./reader-pwa"
import { useFeedKeyboard, useFeedWheel } from "@/lib/use-feed-controls"

interface SwipeFeedProps {
  initialArticles: Article[]
  allTags: TagCount[]
  initialReadingArticle?: Article
}

const DISMISSED_KEY = "swipe-reader-dismissed"
const SAVED_KEY = "swipe-reader-saved"
const TAGS_KEY = "swipe-reader-tags"
const HINT_KEY = "swipe-reader-hint-seen"

interface Toast {
  id: number
  message: string
  action?: { label: string; run: () => void }
}

export function SwipeFeed({ initialArticles, allTags, initialReadingArticle }: SwipeFeedProps) {
  useMobileLayout()
  const pwa = useReaderPwa()
  const reducedMotion = useReducedMotion()
  const [orderedArticles, setOrderedArticles] = useState(initialArticles)
  const [dismissed, setDismissed] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [leavingSlug, setLeavingSlug] = useState<string | null>(null)
  const [readingArticle, setReadingArticle] = useState<Article | null>(initialReadingArticle ?? null)
  const [showSaved, setShowSaved] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
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
    // Run after hydration: exported HTML stays deterministic, randomness is per tab.
    let storage: Storage | undefined
    try { storage = window.sessionStorage } catch { /* Storage may be disabled. */ }
    setOrderedArticles(sessionFeedOrder(initialArticles, storage))
    const storedDismissed = localStorage.getItem(DISMISSED_KEY)
    const storedSaved = localStorage.getItem(SAVED_KEY)
    const storedTags = localStorage.getItem(TAGS_KEY)

    if (storedDismissed) setDismissed(JSON.parse(storedDismissed))
    if (storedSaved) setSaved(JSON.parse(storedSaved))
    if (storedTags) setSelectedTags(JSON.parse(storedTags))
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (isLoaded) localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed))
  }, [dismissed, isLoaded])

  useEffect(() => {
    if (isLoaded) localStorage.setItem(SAVED_KEY, JSON.stringify(saved))
  }, [saved, isLoaded])

  useEffect(() => {
    if (isLoaded) localStorage.setItem(TAGS_KEY, JSON.stringify(selectedTags))
  }, [selectedTags, isLoaded])

  // Filter the session deck without changing its relative order.
  const articles = useMemo(
    () =>
      orderedArticles.filter((article) => {
        if (dismissed.includes(article.slug)) return false
        if (selectedTags.length === 0) return true
        return (article.tags || []).some((tag) => selectedTags.includes(tag))
      }),
    [orderedArticles, dismissed, selectedTags],
  )

  // One slide per article plus the closing "caught up" slide.
  const slideCount = articles.length + 1
  const currentIndex = Math.min(draggingIndex ?? index, slideCount - 1)
  const currentArticle = articles[currentIndex]
  const hasArticles = articles.length > 0

  // Count only bookmarks that resolve in this catalog, just like the saved list.
  // Keep stored slugs so restored posts retain bookmarks.
  const savedArticles = orderedArticles.filter((a) => saved.includes(a.slug))
  const trashedArticles = orderedArticles.filter((a) => dismissed.includes(a.slug))

  const showToast = useCallback((message: string, action?: Toast["action"]) => {
    setToast({ id: Date.now(), message, action })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), toast.action ? 5000 : 2500)
    return () => clearTimeout(timer)
  }, [toast])

  // --- Scroll position -----------------------------------------------------
  // The scroller is the source of truth for which slide is current. Removing
  // a slide leaves scrollTop alone, so the next article slides into its place.
  const feedRef = useRef<HTMLElement>(null)
  const targetRef = useRef<number | null>(null)
  const scrollAnimationRef = useRef<AnimationPlaybackControls | null>(null)
  const snapRestoreRef = useRef<string | null>(null)
  const nativeScrollRef = useRef<{ index: number; top: number; snap: string } | null>(null)
  useEffect(() => () => scrollAnimationRef.current?.stop(), [])
  const slideCountRef = useRef(slideCount)
  slideCountRef.current = slideCount

  useEffect(() => {
    const scroller = feedRef.current
    if (!scroller) return
    let frame = 0
    let idle: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      clearTimeout(idle)
      // Navigation targets expire once scrolling settles.
      idle = setTimeout(() => {
        targetRef.current = null
      }, 180)
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const height = scroller.clientHeight || 1
        setIndex(Math.max(0, Math.min(slideCountRef.current - 1, Math.round(scroller.scrollTop / height))))
      })
    }
    scroller.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      scroller.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
      clearTimeout(idle)
    }
  }, [isLoaded])

  const goTo = useCallback(
    (target: number, instant = false) => {
      const scroller = feedRef.current
      if (!scroller) return
      const next = Math.max(0, Math.min(slideCountRef.current - 1, target))
      targetRef.current = next
      nativeScrollRef.current = null
      scrollAnimationRef.current?.stop()
      scrollAnimationRef.current = null
      const top = next * scroller.clientHeight
      const snap = snapRestoreRef.current
      if (snap !== null && !instant && !reducedMotion) {
        // Keep native snapping disabled through the settling animation. Turning
        // it on halfway through would fight a quick reversal or snap backwards.
        scrollAnimationRef.current = animate(scroller.scrollTop, top, {
          duration: 0.26,
          ease: [0.22, 1, 0.36, 1],
          onUpdate: (value) => scroller.scrollTo({ top: value, behavior: "instant" }),
          onComplete: () => {
            scroller.style.scrollSnapType = snap
            snapRestoreRef.current = null
            scrollAnimationRef.current = null
          },
        })
      } else {
        scroller.scrollTo({ top, behavior: instant || reducedMotion ? "instant" : "smooth" })
        if (snap !== null) {
          scroller.style.scrollSnapType = snap
          snapRestoreRef.current = null
        }
      }
    },
    [reducedMotion],
  )

  const beginNativeScroll = useCallback(() => {
    const scroller = feedRef.current
    if (!scroller || nativeScrollRef.current) return
    scrollAnimationRef.current?.stop()
    scrollAnimationRef.current = null
    nativeScrollRef.current = {
      index: Math.round(scroller.scrollTop / (scroller.clientHeight || 1)),
      top: scroller.scrollTop,
      snap: snapRestoreRef.current ?? scroller.style.scrollSnapType,
    }
    snapRestoreRef.current = nativeScrollRef.current.snap
    targetRef.current = null
    // Let every native wheel delta move the feed, without the browser snapping
    // back between small trackpad events. Restore snapping when input settles.
    scroller.style.scrollSnapType = "none"
    // A new gesture takes over immediately from a prior settling animation.
    scroller.scrollTo({ top: scroller.scrollTop, behavior: "instant" })
  }, [])

  const endNativeScroll = useCallback((cancelled: boolean) => {
    const scroller = feedRef.current
    const origin = nativeScrollRef.current
    if (!scroller || !origin) return
    nativeScrollRef.current = null
    const distance = scroller.scrollTop - origin.top
    let target = Math.round(scroller.scrollTop / (scroller.clientHeight || 1))
    // A short, deliberate flick still advances a card; longer gestures can
    // naturally scroll across several cards. Reversals use actual net travel.
    if (target === origin.index && Math.abs(distance) > 40) target += Math.sign(distance)
    if (cancelled) {
      scroller.style.scrollSnapType = origin.snap
      snapRestoreRef.current = null
    } else goTo(target)
  }, [goTo])

  const verticalDragRef = useRef<{ index: number; top: number; snap: string } | null>(null)
  const dragVertically = useCallback((offset: number) => {
    const scroller = feedRef.current
    if (!scroller) return
    if (!verticalDragRef.current) {
      endNativeScroll(true)
      scrollAnimationRef.current?.stop()
      scrollAnimationRef.current = null
      const origin = Math.round(scroller.scrollTop / (scroller.clientHeight || 1))
      verticalDragRef.current = { index: origin, top: origin * scroller.clientHeight, snap: snapRestoreRef.current ?? scroller.style.scrollSnapType }
      snapRestoreRef.current = verticalDragRef.current.snap
      // Pin interaction to the grabbed card until release. Neighboring cards
      // remain visible but inert while the feed follows the mouse.
      setDraggingIndex(origin)
      targetRef.current = null
      scroller.style.scrollSnapType = "none"
    }
    scroller.scrollTo({ top: verticalDragRef.current.top - offset, behavior: "instant" })
  }, [endNativeScroll])

  const endVerticalDrag = useCallback((offset: number, velocity: number) => {
    const scroller = feedRef.current
    const origin = verticalDragRef.current
    if (!scroller || !origin) return
    verticalDragRef.current = null
    setDraggingIndex(null)
    const deliberate = Math.abs(offset) > 96 || (Math.abs(offset) > 40 && Math.sign(offset) * velocity > 600)
    goTo(origin.index + (deliberate ? (offset < 0 ? 1 : -1) : 0))
  }, [goTo])

  // Steps compose: two quick presses move two slides even mid-animation. The
  // end of the feed wraps back to the first article.
  const step = useCallback(
    (delta: number) => {
      const scroller = feedRef.current
      if (!scroller) return
      // Read the scroller rather than React state, which lags a frame behind.
      const from = targetRef.current ?? Math.round(scroller.scrollTop / (scroller.clientHeight || 1))
      if (delta > 0 && from >= slideCountRef.current - 1) goTo(0)
      else goTo(from + delta)
    },
    [goTo],
  )

  const handleNext = useCallback(() => step(1), [step])
  const handlePrevious = useCallback(() => step(-1), [step])

  // A new filter is a new feed: start it from the top.
  const tagsKey = selectedTags.join("\n")
  const lastTagsKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isLoaded) return
    if (lastTagsKeyRef.current !== null && lastTagsKeyRef.current !== tagsKey) goTo(0, true)
    lastTagsKeyRef.current = tagsKey
  }, [tagsKey, isLoaded, goTo])

  // Keyboard focus follows the current slide, so arrow navigation never strands
  // focus inside a slide that has just become inert.
  const focusKeyRef = useRef<string | null>(null)
  useEffect(() => {
    const scroller = feedRef.current
    if (!scroller) return
    const onFocusIn = (event: FocusEvent) => {
      const key = (event.target as HTMLElement).closest<HTMLElement>("[data-focus-key]")?.dataset.focusKey
      focusKeyRef.current = key ?? null
    }
    // Leaving a slide that is still on screen is deliberate; only focus lost to
    // a slide becoming inert should follow the feed.
    const onFocusOut = (event: FocusEvent) => {
      if ((event.target as HTMLElement).closest(".feed-slide[data-current]")) focusKeyRef.current = null
    }
    scroller.addEventListener("focusin", onFocusIn)
    scroller.addEventListener("focusout", onFocusOut)
    return () => {
      scroller.removeEventListener("focusin", onFocusIn)
      scroller.removeEventListener("focusout", onFocusOut)
    }
  }, [isLoaded])

  useLayoutEffect(() => {
    const active = document.activeElement
    const stranded = !active || active === document.body || Boolean(active.closest(".feed-slide:not([data-current])"))
    if (!stranded || !focusKeyRef.current || document.querySelector("[data-reader-dialog=\"active\"]")) return
    feedRef.current
      ?.querySelector<HTMLElement>(`.feed-slide[data-current] [data-focus-key="${focusKeyRef.current}"]`)
      ?.focus({ preventScroll: true })
  }, [currentIndex, articles])

  // --- Actions ---------------------------------------------------------------
  const isSaved = useCallback((slug: string) => saved.includes(slug), [saved])

  const save = useCallback((slug: string) => {
    setSaved((prev) => (prev.includes(slug) ? prev : [...prev, slug]))
  }, [])

  const unsave = useCallback((slug: string) => {
    setSaved((prev) => prev.filter((s) => s !== slug))
  }, [])

  const restore = useCallback((slug: string) => {
    setDismissed((prev) => prev.filter((s) => s !== slug))
  }, [])

  // Undo returns to the restored post. (Scroll anchoring would otherwise keep
  // the post that slid into its place on screen.)
  const [returnTo, setReturnTo] = useState<string | null>(null)
  useLayoutEffect(() => {
    if (!returnTo) return
    const position = articles.findIndex((article) => article.slug === returnTo)
    if (position >= 0) goTo(position, true)
    setReturnTo(null)
  }, [returnTo, articles, goTo])

  const bin = useCallback(
    (slug: string) => {
      setDismissed((prev) => (prev.includes(slug) ? prev : [...prev, slug]))
      showToast("Binned", {
        label: "Undo",
        run: () => {
          restore(slug)
          setReturnTo(slug)
          setToast(null)
        },
      })
    },
    [restore, showToast],
  )

  const requestBin = useCallback(() => {
    if (currentArticle && !leavingSlug) setLeavingSlug(currentArticle.slug)
  }, [currentArticle, leavingSlug])

  const handleBinned = useCallback(() => {
    if (leavingSlug) bin(leavingSlug)
    setLeavingSlug(null)
  }, [leavingSlug, bin])

  // Swiping right (or →) bookmarks and moves on, like accepting a card.
  const saveAndAdvance = useCallback(() => {
    if (!currentArticle) return
    save(currentArticle.slug)
    showToast("Saved to bookmarks", { label: "View", run: () => { setToast(null); setShowSaved(true) } })
    step(1)
  }, [currentArticle, save, showToast, step])

  const toggleSave = useCallback(() => {
    if (!currentArticle) return
    if (isSaved(currentArticle.slug)) {
      unsave(currentArticle.slug)
      showToast("Removed from bookmarks")
    } else {
      save(currentArticle.slug)
      showToast("Saved to bookmarks", { label: "View", run: () => { setToast(null); setShowSaved(true) } })
    }
  }, [currentArticle, isSaved, save, unsave, showToast])

  const handleRead = useCallback(() => {
    if (currentArticle) openArticle(currentArticle)
  }, [currentArticle, openArticle])

  const handleReaderSave = useCallback(() => {
    if (readingArticle) save(readingArticle.slug)
    closeArticle()
    step(1)
  }, [readingArticle, save, step, closeArticle])

  const handleReaderDismiss = useCallback(() => {
    if (readingArticle) bin(readingArticle.slug)
    closeArticle()
  }, [readingArticle, bin, closeArticle])

  const handleRestoreAll = useCallback(() => setDismissed([]), [])

  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }, [])

  const handleTagClickFromReader = useCallback(
    (tag: string) => {
      setSelectedTags([tag])
      closeArticle()
    },
    [closeArticle],
  )

  const handleClearTags = useCallback(() => setSelectedTags([]), [])

  // First visit: say what the gestures do, once.
  useEffect(() => {
    if (!isLoaded || initialReadingArticle || localStorage.getItem(HINT_KEY)) return
    localStorage.setItem(HINT_KEY, "1")
    const touch = window.matchMedia("(pointer: coarse)").matches
    showToast(touch ? "Swipe up for the next post · left to bin · right to save" : "↑ ↓ to browse · ← bin · → save · Enter to read")
  }, [isLoaded, initialReadingArticle, showToast])

  const overlayOpen = readingArticle !== null || showSaved || showTrash
  const feedControls = isLoaded && !overlayOpen
  useFeedKeyboard(feedControls, {
    onNext: handleNext,
    onPrevious: handlePrevious,
    onSkip: requestBin,
    onSave: saveAndAdvance,
    onRead: handleRead,
  })
  useFeedWheel(feedRef, feedControls, {
    onVerticalStart: beginNativeScroll,
    onVerticalEnd: endNativeScroll,
    onSkip: requestBin,
    onSave: saveAndAdvance,
  })

  // Close the header menu on outside press or Escape.
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showMenu) return
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setShowMenu(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowMenu(false)
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [showMenu])

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
    return <div className="feed-shell" aria-busy="true" />
  }

  return (
    <div className={`feed-shell${selectedTags.length > 0 ? " has-filter" : ""}`}>
      <div data-reader-background className="contents">
        <header className="feed-topbar">
          <div className="feed-topbar-row">
            <h1 className="feed-brand">
              <button type="button" onClick={() => goTo(0)} aria-label="Bathos, back to the first post">Bathos</button>
            </h1>
            <nav className="feed-links" aria-label="Site">
              <a href="/articles/">Articles</a>
              <a href="/subscribe/" aria-label="Subscribe to Bathos">Subscribe</a>
            </nav>

            <div className="feed-tools">
              <button
                onClick={() => {
                  setShowFilters((prev) => !prev)
                  setShowMenu(false)
                }}
                aria-label="Filter by tag"
                aria-expanded={showFilters}
                className="feed-icon-button"
              >
                <SlidersHorizontal className="w-5 h-5" />
                {selectedTags.length > 0 && <span className="feed-badge">{selectedTags.length}</span>}
              </button>
              <button
                onClick={() => setShowSaved(true)}
                aria-label="Open saved articles"
                data-dialog-fallback
                className="feed-icon-button"
              >
                <Bookmark className="w-5 h-5" />
                {savedArticles.length > 0 && <span className="feed-badge feed-badge-success">{savedArticles.length}</span>}
              </button>
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => {
                    setShowMenu((prev) => !prev)
                    setShowFilters(false)
                  }}
                  aria-label="More options"
                  aria-expanded={showMenu}
                  className="feed-icon-button"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {showMenu && (
                  <div className="feed-menu">
                    <a href="/articles/" className="feed-menu-item feed-menu-mobile">
                      <BookOpen className="w-5 h-5" /> All articles
                    </a>
                    <a href="/subscribe/" className="feed-menu-item feed-menu-mobile" aria-label="Subscribe to Bathos">
                      <Rss className="w-5 h-5" /> Subscribe
                    </a>
                    <button
                      className="feed-menu-item"
                      onClick={() => {
                        setShowMenu(false)
                        setShowTrash(true)
                      }}
                      aria-label="Open binned articles"
                    >
                      <Trash2 className="w-5 h-5" /> Binned
                      {dismissed.length > 0 && <span className="feed-menu-count">{dismissed.length}</span>}
                    </button>
                    {!pwa.installed && (
                      <button
                        className="feed-menu-item"
                        onClick={() => {
                          setShowMenu(false)
                          void pwa.install()
                        }}
                        aria-label="Install Bathos"
                      >
                        <Download className="w-5 h-5" /> Install app
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectedTags.length > 0 && !showFilters && (
            <div className="feed-filter-summary">
              <button type="button" onClick={() => setShowFilters(true)} className="feed-filter-summary-label">
                Showing {selectedTags.join(", ")}
              </button>
              <button type="button" onClick={handleClearTags} aria-label="Clear topic filter" className="feed-filter-summary-clear">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {showFilters && (
            <TagFilter
              tags={allTags}
              selected={selectedTags}
              onToggle={handleToggleTag}
              onClear={handleClearTags}
              onDone={() => setShowFilters(false)}
            />
          )}
          {pwa.showHelp && <InstallHelp onClose={pwa.closeHelp} />}
        </header>

        <main
          ref={feedRef}
          className="feed-scroller"
          aria-roledescription="carousel"
          aria-label="Article feed"
        >
          {articles.map((article, position) => (
            <FeedSlide
              key={article.slug}
              article={article}
              position={position + 1}
              total={articles.length}
              current={position === currentIndex}
              saved={saved.includes(article.slug)}
              leaving={leavingSlug === article.slug}
              selectedTags={selectedTags}
              onBin={requestBin}
              onBinned={handleBinned}
              onSwipeSave={saveAndAdvance}
              onVerticalDrag={dragVertically}
              onVerticalDragEnd={endVerticalDrag}
              onToggleSave={toggleSave}
              onRead={handleRead}
              onTagClick={handleToggleTag}
            />
          ))}

          <section
            className="feed-slide feed-end"
            data-current={currentIndex === articles.length || undefined}
            inert={currentIndex !== articles.length}
            aria-roledescription="slide"
            aria-label="End of feed"
          >
            <div className="feed-end-content">
              {selectedTags.length > 0 && !hasArticles ? (
                <>
                  <h2 className="feed-end-title">No posts match these topics</h2>
                  <p className="text-muted-foreground">Nothing left tagged {selectedTags.map((t) => `“${t}”`).join(" or ")}.</p>
                  <button data-focus-key="end" onClick={handleClearTags} className="feed-read">
                    <X className="w-5 h-5" />
                    Clear filters
                  </button>
                </>
              ) : (
                <>
                  <h2 className="feed-end-title">{hasArticles ? "You’re all caught up" : "Nothing left in the feed"}</h2>
                  <p className="text-muted-foreground">
                    {dismissed.length > 0
                      ? `You’ve binned ${dismissed.length} post${dismissed.length === 1 ? "" : "s"}.`
                      : "That’s every post for now."}
                  </p>
                  {hasArticles && (
                    <button data-focus-key="end" onClick={() => goTo(0)} className="feed-read">
                      <ChevronUp className="w-5 h-5" />
                      Back to the first post
                    </button>
                  )}
                  {dismissed.length > 0 && (
                    <button onClick={handleRestoreAll} className="feed-secondary-button">
                      <RotateCcw className="w-4 h-4" />
                      Restore binned posts
                    </button>
                  )}
                </>
              )}
              {savedArticles.length > 0 && (
                <button onClick={() => setShowSaved(true)} className="feed-secondary-button">
                  <Bookmark className="w-4 h-4" />
                  View saved ({savedArticles.length})
                </button>
              )}
            </div>
          </section>
        </main>

        <nav className="feed-nav" aria-label="Feed navigation">
          <button onClick={handlePrevious} disabled={currentIndex === 0} aria-label="Previous" title="Previous (↑)" className="feed-nav-button">
            <ChevronUp className="w-6 h-6" />
          </button>
          {hasArticles && (
            <span className="feed-nav-count">
              {Math.min(currentIndex + 1, articles.length)}
              <span aria-hidden="true">/</span>
              <span className="sr-only"> of </span>
              {articles.length}
            </span>
          )}
          <button onClick={handleNext} aria-label="Next" title="Next (↓)" className="feed-nav-button">
            <ChevronDown className="w-6 h-6" />
          </button>
        </nav>

        <div className="feed-toast-region" role="status" aria-live="polite">
          {toast && (
            <div key={toast.id} className="feed-toast">
              <span>{toast.message}</span>
              {toast.action && (
                <button type="button" onClick={toast.action.run} className="feed-toast-action">
                  {toast.action.label}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Article Reader Modal */}
      <AnimatePresence>
        {readingArticle && (
          <ArticleReader
            article={readingArticle}
            animateEntry={isLoaded || !initialReadingArticle}
            onClose={closeArticle}
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
            emptyHint="Swipe a post right (or press →) to save it for later"
            onClose={() => setShowSaved(false)}
            onSelect={(article) => {
              openArticle(article)
              setShowSaved(false)
            }}
            rowAction={{
              icon: Trash2,
              label: "Remove from saved",
              onAction: unsave,
            }}
          />
        )}
      </AnimatePresence>

      {/* Bin Panel */}
      <AnimatePresence>
        {showTrash && (
          <ArticleListPanel
            title="Binned articles"
            articles={trashedArticles}
            emptyIcon={Trash2}
            emptyTitle="Nothing in the bin"
            emptyHint="Swipe a post left (or press ←) to bin it"
            onClose={() => setShowTrash(false)}
            onSelect={(article) => {
              openArticle(article)
              setShowTrash(false)
            }}
            rowAction={{
              icon: RotateCcw,
              label: "Restore to feed",
              onAction: restore,
              className:
                "p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors",
            }}
            headerAction={{
              icon: RotateCcw,
              label: "Restore all",
              onAction: handleRestoreAll,
            }}
            footnote="Binning hides posts only in this browser. They remain on the site for everyone else, and you can restore them here at any time."
          />
        )}
      </AnimatePresence>
    </div>
  )
}
