"use client"

import { useEffect, useId, useState, type MouseEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Share2 } from "lucide-react"
import type { Article } from "@/lib/articles"
import { postPath } from "@/lib/post-links"

export function ShareButton({ article, allowClick = () => true, className, children }: {
  article: Article
  allowClick?: () => boolean
  className?: string
  /** Replaces the default icon, e.g. with a labelled rail icon. */
  children?: ReactNode
}) {
  const [message, setMessage] = useState("")
  const [manualLink, setManualLink] = useState("")
  const [busy, setBusy] = useState(false)
  const feedbackId = useId()

  // A copied link needs no further action; a manual link waits to be dismissed.
  useEffect(() => {
    if (!message || manualLink) return
    const timer = setTimeout(() => setMessage(""), 3000)
    return () => clearTimeout(timer)
  }, [message, manualLink])

  async function share(event: MouseEvent) {
    event.stopPropagation()
    if (!allowClick() || busy) return
    const url = new URL(postPath(article.slug), window.location.origin).href
    setBusy(true)
    setMessage("")
    setManualLink("")
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: article.title, url })
          return
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") return
        }
      }
      try {
        await navigator.clipboard.writeText(url)
        setMessage("Link copied")
      } catch {
        setMessage("Copy this link to share the article")
        setManualLink(url)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative shrink-0" onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <button type="button" onClick={share} disabled={busy} aria-label="Share this article"
        aria-describedby={message ? feedbackId : undefined} title="Share this article"
        className={className ?? "p-3 rounded-xl bg-secondary text-foreground hover:opacity-80 transition-opacity disabled:opacity-50"}>
        {children ?? <Share2 className="w-5 h-5" aria-hidden="true" />}
      </button>
      <span className="sr-only" role="status" aria-live="polite">{message}</span>
      {message && createPortal(<div id={feedbackId}
        onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}
        className="fixed inset-x-4 top-[calc(4.5rem+env(safe-area-inset-top))] z-[100] mx-auto max-w-sm rounded-xl border border-border bg-background p-3 text-sm text-foreground shadow-lg">
        {message}
        {manualLink && <input aria-label="Article link" readOnly value={manualLink}
          onClick={(event) => { event.stopPropagation(); event.currentTarget.select() }}
          className="mt-2 w-full rounded border border-border bg-secondary p-2" />}
        {message && <button type="button" onClick={(event) => { event.stopPropagation(); setMessage(""); setManualLink("") }}
          className="mt-2 block underline">Dismiss share message</button>}
      </div>, document.body)}
    </div>
  )
}
