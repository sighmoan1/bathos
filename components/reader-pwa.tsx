"use client"

import { useCallback, useEffect, useState } from "react"
import { X } from "lucide-react"

type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export interface ReaderPwa {
  installed: boolean
  showHelp: boolean
  closeHelp: () => void
  install: () => Promise<void>
  waiting: ServiceWorker | null
  applyUpdate: () => void
}

/**
 * Install prompt and offline-cache registration. Kept as a hook so the header
 * can place its controls in a menu while registration runs from first load.
 */
export function useReaderPwa(): ReaderPwa {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [installed, setInstalled] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    const beforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt) }
    const onInstalled = () => { setInstalled(true); setPrompt(null); setShowHelp(false) }
    window.addEventListener("beforeinstallprompt", beforeInstall)
    window.addEventListener("appinstalled", onInstalled)
    let active = true
    let reloadOnChange = false
    const onControllerChange = () => { if (reloadOnChange) window.location.reload() }
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange)
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(registration => {
        if (!active) return
        const checkUpdate = () => {
          if (active && registration.waiting && navigator.serviceWorker.controller) {
            reloadOnChange = true
            setWaiting(registration.waiting)
          }
        }
        checkUpdate()
        registration.addEventListener("updatefound", () => registration.installing?.addEventListener("statechange", checkUpdate))
      }).catch(error => console.warn("Reader offline setup failed", error))
    }
    return () => {
      active = false
      window.removeEventListener("beforeinstallprompt", beforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange)
    }
  }, [])

  const install = useCallback(async () => {
    if (!prompt) { setShowHelp(value => !value); return }
    await prompt.prompt()
    const choice = await prompt.userChoice
    setPrompt(null)
    if (choice.outcome === "accepted") setShowHelp(false)
  }, [prompt])

  const closeHelp = useCallback(() => setShowHelp(false), [])
  const applyUpdate = useCallback(() => waiting?.postMessage({ type: "SKIP_WAITING" }), [waiting])

  return { installed, showHelp, closeHelp, install, waiting, applyUpdate }
}

export function InstallHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="feed-sheet" role="region" aria-label="Install Bathos instructions">
      <div className="flex items-center justify-between gap-4">
        <strong>Install Bathos</strong>
        <button onClick={onClose} aria-label="Close installation instructions" className="feed-icon-button"><X className="w-5 h-5" /></button>
      </div>
      <p className="text-sm text-muted-foreground max-w-prose">On iPhone or iPad, open in Safari and choose Share → Add to Home Screen. On Android or desktop, use your browser’s Install app or Add to Home screen option when available. Visit online once to make articles available offline.</p>
    </div>
  )
}
