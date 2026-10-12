"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"

type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function ReaderPwa() {
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

  async function install() {
    if (!prompt) { setShowHelp(value => !value); return }
    await prompt.prompt()
    const choice = await prompt.userChoice
    setPrompt(null)
    if (choice.outcome === "accepted") setShowHelp(false)
  }

  return <>
    {waiting && <button className="px-3 py-2 rounded-lg bg-accent text-accent-foreground text-sm" onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}>Update app</button>}
    {!installed && <button onClick={install} aria-label="Install Bathos" aria-expanded={showHelp} className="p-2 rounded-lg hover:bg-secondary transition-colors"><Download className="w-5 h-5" /></button>}
    {showHelp && <div className="absolute top-full inset-x-0 border-b border-border bg-card p-4 shadow-xl" role="region" aria-label="Install Bathos instructions">
      <div className="flex items-center justify-between gap-4"><strong>Install Bathos</strong><button onClick={() => setShowHelp(false)} aria-label="Close installation instructions" className="p-2 rounded-lg hover:bg-secondary"><X className="w-5 h-5" /></button></div>
      <p className="text-sm text-muted-foreground max-w-prose">On iPhone or iPad, open in Safari and choose Share → Add to Home Screen. On Android or desktop, use your browser’s Install app or Add to Home screen option when available. Visit online once to make articles available offline.</p>
    </div>}
  </>
}
