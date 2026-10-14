"use client"

import { useEffect, useMemo, useRef, type MouseEvent } from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "framer-motion"
import { ArrowRight, Bookmark, Share2, Trash2 } from "lucide-react"
import type { Article } from "@/lib/articles"
import { postPath } from "@/lib/post-links"
import { previewParagraphs, readingMinutes } from "@/lib/article-preview"
import { ShareButton } from "./share-button"

interface FeedSlideProps {
  article: Article
  position: number
  total: number
  current: boolean
  saved: boolean
  /** Set by the feed when this article is being binned; the card flies out, then `onBinned` fires. */
  leaving: boolean
  selectedTags: string[]
  onBin: () => void
  onBinned: () => void
  onSwipeSave: () => void
  onToggleSave: () => void
  onRead: () => void
  onTagClick: (tag: string) => void
}

// A deliberate sideways drag, or a shorter flick.
const SWIPE_DISTANCE = 96
const FLICK_DISTANCE = 40
const FLICK_VELOCITY = 600

/**
 * One full-screen article in the feed. The browser owns vertical scrolling
 * (the card only claims horizontal drags, so `touch-action: pan-y` keeps
 * native momentum); dragging sideways bins left and bookmarks right.
 */
export function FeedSlide({
  article,
  position,
  total,
  current,
  saved,
  leaving,
  selectedTags,
  onBin,
  onBinned,
  onSwipeSave,
  onToggleSave,
  onRead,
  onTagClick,
}: FeedSlideProps) {
  const reducedMotion = useReducedMotion()
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-300, 300], [-6, 6])
  const saveReveal = useTransform(x, [0, SWIPE_DISTANCE], [0, 1])
  const binReveal = useTransform(x, [-SWIPE_DISTANCE, 0], [1, 0])
  const didDragRef = useRef(false)
  const binnedRef = useRef(onBinned)
  binnedRef.current = onBinned

  const preview = useMemo(() => previewParagraphs(article.content, 4, article.description), [article.content, article.description])
  const minutes = useMemo(() => readingMinutes(article.content), [article.content])

  useEffect(() => {
    if (!leaving) return
    if (reducedMotion) {
      binnedRef.current()
      return
    }
    const controls = animate(x, -window.innerWidth * 1.1, { duration: 0.22, ease: "easeIn" })
    controls.then(() => binnedRef.current())
    return () => controls.stop()
  }, [leaving, reducedMotion, x])

  /** The card is a drag surface: a drag that ends over a control is not a click. */
  const guarded = (action: () => void) => (event: MouseEvent) => {
    event.stopPropagation()
    if (!didDragRef.current) action()
  }

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    setTimeout(() => {
      didDragRef.current = false
    }, 0)
    const { x: dx } = info.offset
    const { x: vx } = info.velocity
    const toward = (sign: 1 | -1) => sign * dx > SWIPE_DISTANCE || (sign * dx > FLICK_DISTANCE && sign * vx > FLICK_VELOCITY)
    if (toward(-1)) {
      onBin()
      return
    }
    if (toward(1)) onSwipeSave()
    animate(x, 0, { type: "spring", stiffness: 500, damping: 40 })
  }

  return (
    <section
      className="feed-slide"
      data-current={current || undefined}
      inert={!current}
      aria-roledescription="slide"
      aria-label={`${position} of ${total}: ${article.title}`}
    >
      <div className="feed-card-wrap">
        <motion.div className="feed-reveal feed-reveal-save" style={{ opacity: saveReveal }} aria-hidden="true">
          <Bookmark className="w-7 h-7" />
          {saved ? "Saved" : "Save"}
        </motion.div>
        <motion.div className="feed-reveal feed-reveal-bin" style={{ opacity: binReveal }} aria-hidden="true">
          Bin
          <Trash2 className="w-7 h-7" />
        </motion.div>

        <motion.div
          className="feed-card"
          style={{ x, rotate: reducedMotion ? 0 : rotate }}
          drag={current && !leaving ? "x" : false}
          dragMomentum={false}
          dragElastic={0.9}
          dragConstraints={{ left: 0, right: 0 }}
          onDragStart={() => {
            didDragRef.current = true
          }}
          onDragEnd={handleDragEnd}
        >
          <div className="feed-card-body" onClick={guarded(onRead)}>
            {article.tags && article.tags.length > 0 && (
              <div className="feed-tags">
                {article.tags.slice(0, 3).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={guarded(() => onTagClick(tag))}
                    aria-pressed={selectedTags.includes(tag)}
                    title={`Filter by "${tag}"`}
                    className="feed-tag"
                  >
                    <span>{tag}</span>
                  </button>
                ))}
              </div>
            )}

            <h2 className="reader-title">
              <a
                href={postPath(article.slug)}
                // A native link drag would swallow mouse swipes that start on the title.
                draggable={false}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  event.preventDefault()
                  guarded(onRead)(event)
                }}
              >
                {/* Framer Motion won't start a drag whose target is a link or
                    button, so labels sit in spans to keep swipes working there. */}
                <span>{article.title}</span>
              </a>
            </h2>

            {article.description && <p className="feed-description">{article.description}</p>}

            <p className="feed-meta">
              {article.date && (
                <>
                  {new Date(article.date).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}
                  <span aria-hidden="true"> · </span>
                </>
              )}
              {minutes} min read
            </p>

            {preview.length > 0 && (
              <div className="feed-preview" aria-hidden="true">
                {preview.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            )}
          </div>

          <button type="button" data-focus-key="read" onClick={guarded(onRead)} className="feed-read">
            <span>Read Article</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>

      <div className="feed-rail">
        <button
          type="button"
          data-focus-key="save"
          onClick={onToggleSave}
          aria-label="Save"
          aria-pressed={saved}
          title={saved ? "Remove bookmark" : "Bookmark this article (→)"}
          className="feed-rail-button is-save"
        >
          <span className="feed-rail-icon">
            <Bookmark className="w-6 h-6" fill={saved ? "currentColor" : "none"} />
          </span>
          <span className="feed-rail-label">{saved ? "Saved" : "Save"}</span>
        </button>
        <button
          type="button"
          data-focus-key="bin"
          onClick={onBin}
          aria-label="Bin"
          title="Bin this article (←)"
          className="feed-rail-button is-bin"
        >
          <span className="feed-rail-icon">
            <Trash2 className="w-6 h-6" />
          </span>
          <span className="feed-rail-label">Bin</span>
        </button>
        <ShareButton article={article} className="feed-rail-button">
          <span className="feed-rail-icon">
            <Share2 className="w-6 h-6" aria-hidden="true" />
          </span>
          <span className="feed-rail-label">Share</span>
        </ShareButton>
      </div>
    </section>
  )
}
