"use client"

import { useEffect, useRef, type RefObject } from "react"

interface FeedKeyboardHandlers {
  onNext: () => void
  onPrevious: () => void
  onSkip: () => void
  onSave: () => void
  onRead: () => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.closest("button, a[href], [role=button], [role=link], [tabindex]")) return true
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

/**
 * Window-level keyboard navigation for the card feed. Disabled while an
 * overlay is open so the reader and panels own their own key handling.
 */
export function useFeedKeyboard(enabled: boolean, handlers: FeedKeyboardHandlers) {
  // Handlers are re-created every render; keep them in a ref so toggling
  // `enabled` is the only thing that re-subscribes the listener.
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return

      switch (event.key) {
        case "ArrowDown":
        case "j":
          handlersRef.current.onNext()
          break
        case "ArrowUp":
        case "k":
          handlersRef.current.onPrevious()
          break
        case "ArrowLeft":
          handlersRef.current.onSkip()
          break
        case "ArrowRight":
          handlersRef.current.onSave()
          break
        case "Enter":
        case " ":
          handlersRef.current.onRead()
          break
        default:
          return
      }

      event.preventDefault()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled])
}

interface FeedWheelHandlers {
  onNext: () => void
  onPrevious: () => void
  onSkip: () => void
  onSave: () => void
}

// A trackpad reports one flick as a burst of events followed by a momentum
// tail. A gap this long means the burst is over and the next event starts a
// fresh gesture.
const GESTURE_GAP_MS = 160
// How far a gesture has to travel before it counts. Skipping bins an article,
// so sideways gestures need a firmer push than vertical ones.
const VERTICAL_THRESHOLD = 40
const HORIZONTAL_THRESHOLD = 60
// ...and they have to be clearly sideways, since no trackpad swipe is ever
// perfectly on-axis.
const HORIZONTAL_DOMINANCE = 1.4

/**
 * Two-finger trackpad / wheel navigation on both axes: vertical moves through
 * the deck, horizontal skips and saves, mirroring the touch swipe directions.
 *
 * Deltas are accumulated across each gesture and the axis is decided once the
 * gesture is big enough to read, rather than from the first (tiny, ambiguous)
 * event. Exactly one action fires per gesture, so a firm flick and its
 * momentum tail can't run away with several cards.
 */
export function useFeedWheel(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  handlers: FeedWheelHandlers,
) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return

    let lastEventAt = 0
    let accX = 0
    let accY = 0
    let fired = false

    const onWheel = (event: WheelEvent) => {
      // Chrome reads a horizontal two-finger swipe as browser back/forward.
      // Claim it before it gets that far. Vertical events are left alone so a
      // short viewport can still scroll normally.
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault()
      }

      const now = Date.now()
      if (now - lastEventAt > GESTURE_GAP_MS) {
        accX = 0
        accY = 0
        fired = false
      }
      lastEventAt = now

      accX += event.deltaX
      accY += event.deltaY
      if (fired) return

      const absX = Math.abs(accX)
      const absY = Math.abs(accY)

      if (absX > absY * HORIZONTAL_DOMINANCE) {
        if (absX < HORIZONTAL_THRESHOLD) return
        fired = true
        // With natural scrolling, fingers moving left report deltaX > 0 —
        // the same direction as dragging the card left to skip it.
        if (accX > 0) handlersRef.current.onSkip()
        else handlersRef.current.onSave()
      } else {
        if (absY < VERTICAL_THRESHOLD) return
        fired = true
        if (accY > 0) handlersRef.current.onNext()
        else handlersRef.current.onPrevious()
      }
    }

    element.addEventListener("wheel", onWheel, { passive: false })
    return () => element.removeEventListener("wheel", onWheel)
  }, [ref, enabled])
}

/** Closes the topmost overlay on Escape. */
export function useEscapeKey(enabled: boolean, onEscape: () => void) {
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onEscapeRef.current()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled])
}
