"use client"

import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion"
import { X, Bookmark, ArrowRight, ChevronUp, ChevronDown, Trash2 } from "lucide-react"
import type { Article } from "@/lib/articles"
import { useRef, useState, type MouseEvent as MouseEvent_ } from "react"

interface ArticleCardProps {
  article: Article
  onSwipeLeft: () => void
  onSwipeRight: () => void
  onSwipeUp: () => void
  onSwipeDown: () => void
  onReadMore: () => void
  onTagClick: (tag: string) => void
  selectedTags: string[]
  isTop: boolean
  hasPrevious: boolean
  hasNext: boolean
}

export function ArticleCard({
  article,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onReadMore,
  onTagClick,
  selectedTags,
  isTop,
  hasPrevious,
  hasNext,
}: ArticleCardProps) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const rotate = useTransform(x, [-200, 200], [-15, 15])

  const leftIndicatorOpacity = useTransform(x, [-100, 0], [1, 0])
  const rightIndicatorOpacity = useTransform(x, [0, 100], [0, 1])
  const upIndicatorOpacity = useTransform(y, [-80, 0], [1, 0])
  const downIndicatorOpacity = useTransform(y, [0, 80], [0, 1])

  const [exitDirection, setExitDirection] = useState<"left" | "right" | "up" | "down" | null>(null)
  const didDragRef = useRef(false)

  const handleDragStart = () => {
    didDragRef.current = true
  }

  /**
   * The whole card is a drag surface, so a drag that happens to end over a
   * button must not be read as a click on it.
   */
  const guardedClick = (action: () => void) => (event: MouseEvent_) => {
    event.stopPropagation()
    if (didDragRef.current) return
    action()
  }

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Cleared after the click event that follows a drag would have fired.
    setTimeout(() => {
      didDragRef.current = false
    }, 0)

    const horizontalThreshold = 80
    const verticalThreshold = 60

    const absX = Math.abs(info.offset.x)
    const absY = Math.abs(info.offset.y)

    // Determine primary direction
    if (absX > absY && absX > horizontalThreshold) {
      // Horizontal swipe takes priority for save/dismiss
      if (info.offset.x > horizontalThreshold) {
        setExitDirection("right")
        onSwipeRight()
      } else if (info.offset.x < -horizontalThreshold) {
        setExitDirection("left")
        onSwipeLeft()
      }
    } else if (absY > verticalThreshold) {
      // Vertical swipe for navigation
      if (info.offset.y < -verticalThreshold && hasNext) {
        setExitDirection("up")
        onSwipeUp()
      } else if (info.offset.y > verticalThreshold && hasPrevious) {
        setExitDirection("down")
        onSwipeDown()
      }
    }
  }

  const exitAnimations = {
    left: { x: -400, opacity: 0 },
    right: { x: 400, opacity: 0 },
    up: { y: -300, opacity: 0 },
    down: { y: 300, opacity: 0 },
  }

  return (
    <motion.div
      className="w-full"
      style={{
        x: isTop ? x : 0,
        y: isTop ? y : 0,
        rotate: isTop ? rotate : 0,
      }}
      drag={isTop}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.6}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={exitDirection ? exitAnimations[exitDirection] : { opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.25 }}
    >
      <div className="relative w-full bg-card rounded-2xl border border-border overflow-hidden shadow-xl">
        {/* Swipe indicators */}
        {isTop && (
          <>
            {/* Left - Dismiss */}
            <motion.div
              className="absolute inset-0 bg-destructive/20 rounded-2xl z-10 pointer-events-none flex items-center justify-center"
              style={{ opacity: leftIndicatorOpacity }}
            >
              <div className="bg-destructive text-destructive-foreground px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2">
                <X className="w-4 h-4" />
                Skip
              </div>
            </motion.div>
            {/* Right - Save */}
            <motion.div
              className="absolute inset-0 bg-success/20 rounded-2xl z-10 pointer-events-none flex items-center justify-center"
              style={{ opacity: rightIndicatorOpacity }}
            >
              <div className="bg-success text-success-foreground px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2">
                <Bookmark className="w-4 h-4" />
                Save
              </div>
            </motion.div>
            {/* Up - Next */}
            {hasNext && (
              <motion.div
                className="absolute inset-0 bg-accent/30 rounded-2xl z-10 pointer-events-none flex items-center justify-center"
                style={{ opacity: upIndicatorOpacity }}
              >
                <div className="bg-accent text-accent-foreground px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2">
                  <ChevronUp className="w-4 h-4" />
                  Next
                </div>
              </motion.div>
            )}
            {/* Down - Previous */}
            {hasPrevious && (
              <motion.div
                className="absolute inset-0 bg-secondary/50 rounded-2xl z-10 pointer-events-none flex items-center justify-center"
                style={{ opacity: downIndicatorOpacity }}
              >
                <div className="bg-secondary text-secondary-foreground px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2">
                  <ChevronDown className="w-4 h-4" />
                  Previous
                </div>
              </motion.div>
            )}
          </>
        )}

        {/* Card content - More compact layout */}
        <div className="flex flex-col p-5">
          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {article.tags.slice(0, 3).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={guardedClick(() => onTagClick(tag))}
                  title={`Filter by "${tag}"`}
                  className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors ${
                    selectedTags.includes(tag)
                      ? "bg-accent text-accent-foreground ring-1 ring-accent-foreground/40"
                      : "bg-accent/50 text-accent-foreground hover:bg-accent"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Title */}
          <h2 className="text-xl font-bold text-foreground mb-2 leading-tight text-balance">{article.title}</h2>

          {/* Description */}
          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 mb-3">{article.description}</p>

          {/* Date */}
          {article.date && (
            <p className="text-muted-foreground/60 text-xs mb-4">
              {new Date(article.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          )}

          {/* Actions. The bin and bookmark buttons are the click-driven
              equivalent of swiping the card left and right. */}
          <div className="flex items-center gap-2">
            <button
              onClick={guardedClick(onSwipeLeft)}
              aria-label="Bin this article"
              title="Bin this article"
              className="shrink-0 p-3 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors active:scale-95"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            <button
              onClick={guardedClick(onReadMore)}
              className="flex-grow bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity active:scale-[0.98]"
            >
              Read Article
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={guardedClick(onSwipeRight)}
              aria-label="Save this article"
              title="Save this article"
              className="shrink-0 p-3 rounded-xl bg-success/10 text-success hover:bg-success/20 transition-colors active:scale-95"
            >
              <Bookmark className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
