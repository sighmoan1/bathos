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
  onVerticalStart: () => void
  onVerticalEnd: (cancelled: boolean) => void
  onSkip: () => void
  onSave: () => void
}

// A trackpad reports one flick as a burst of events followed by a momentum
// tail. A gap this long means the burst is over and the next event starts a
// fresh gesture.
const GESTURE_GAP_MS = 160
const VERTICAL_SETTLE_MS = 120
// Binning needs a deliberate sideways gesture.
const HORIZONTAL_THRESHOLD = 60
// ...and they have to be clearly sideways, since no trackpad swipe is ever
// perfectly on-axis.
const HORIZONTAL_DOMINANCE = 1.4

/**
 * The browser owns vertical trackpad scrolling and momentum, revealing adjacent
 * slides as the fingers move. Only sideways save/bin gestures are intercepted.
 * A vertical movement or reversal must never wait for a momentum-tail timeout.
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
    let vertical = false
    let settle: ReturnType<typeof setTimeout> | undefined

    const onWheel = (event: WheelEvent) => {
      // Preserve browser zoom and native vertical scrolling, including small
      // deltas and direction changes during a trackpad's momentum tail.
      if (event.ctrlKey) return
      const now = Date.now()
      if (now - lastEventAt > GESTURE_GAP_MS) {
        accX = 0
        accY = 0
        fired = false
      }
      lastEventAt = now
      accX += event.deltaX
      accY += event.deltaY
      // A noisy sideways sample inside a vertical gesture is still scrolling.
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) * HORIZONTAL_DOMINANCE ||
          Math.abs(accX) <= Math.abs(accY) * HORIZONTAL_DOMINANCE) {
        if (!event.deltaY) return
        vertical = true
        handlersRef.current.onVerticalStart()
        clearTimeout(settle)
        settle = setTimeout(() => {
          vertical = false
          handlersRef.current.onVerticalEnd(false)
        }, VERTICAL_SETTLE_MS)
        return
      }
      if (vertical) {
        clearTimeout(settle)
        vertical = false
        handlersRef.current.onVerticalEnd(true)
      }
      // A sideways swipe must not become browser back/forward navigation.
      event.preventDefault()

      if (fired) return

      if (Math.abs(accX) < HORIZONTAL_THRESHOLD) return
      fired = true
      // Natural scrolling reports a leftward finger swipe as positive deltaX.
      if (accX > 0) handlersRef.current.onSkip()
      else handlersRef.current.onSave()
    }

    element.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      element.removeEventListener("wheel", onWheel)
      clearTimeout(settle)
      if (vertical) handlersRef.current.onVerticalEnd(true)
    }
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
