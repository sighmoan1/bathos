"use client"

import { useId, useLayoutEffect, useRef } from "react"
import { useIsPresent } from "framer-motion"

const activeDialogs = new Set<HTMLElement>()

const focusable = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Presence-aware modal lifecycle: exiting panels must yield focus to the next dialog. */
export function useReaderDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const present = useIsPresent()
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog || !present) return
    activeDialogs.add(dialog)
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.focus()
    const background = document.querySelector<HTMLElement>('[data-reader-background]')
    if (background) {
      background.inert = true
      background.setAttribute('aria-hidden', 'true')
    }
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusable)).filter(element => element.getClientRects().length > 0)
    const onKeyDown = (event: KeyboardEvent) => {
      if (Array.from(activeDialogs).at(-1) !== dialog) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
      } else if (event.key === 'Tab') {
        const items = controls()
        const first = items[0]
        const last = items[items.length - 1]
        if (!first || (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) || (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog))) {
          event.preventDefault()
          ;(event.shiftKey ? last : first)?.focus()
        }
      }
    }
    const onFocus = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node)) dialog.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocus)
      activeDialogs.delete(dialog)
      if (background && activeDialogs.size === 0) {
        background.inert = false
        background.removeAttribute('aria-hidden')
      }
      // Wait for the replacement panel to mount and for removed card openers to disappear.
      requestAnimationFrame(() => {
        if (document.querySelector('[data-reader-dialog="active"]')) return
        const active = document.activeElement
        if (active instanceof HTMLElement && active.matches(focusable) && !active.closest("[data-reader-dialog]")) return
        const target = opener?.isConnected && opener.matches(focusable) && !opener.closest('[inert], [aria-hidden="true"]') ? opener : document.querySelector<HTMLElement>('[data-dialog-fallback]')
        target?.focus()
      })
    }
  }, [present])

  // Removing a focused row action must leave focus inside the still-open panel.
  useLayoutEffect(() => {
    const dialog = ref.current
    if (present && dialog && Array.from(activeDialogs).at(-1) === dialog && !dialog.contains(document.activeElement)) dialog.focus()
  })

  return { ref, titleId, present }
}
