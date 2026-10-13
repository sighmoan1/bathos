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

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    const beforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt) }
    const onInstalled = () => { setInstalled(true); setPrompt(null); setShowHelp(false) }
    window.addEventListener("beforeinstallprompt", beforeInstall)
    window.addEventListener("appinstalled", onInstalled)
    // Retire registrations left by earlier reader releases; keep the manager.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(async registrations => {
        await Promise.all(registrations.filter(registration => registration.scope === new URL("/", window.location.origin).href).map(registration => registration.unregister()))
        if ("caches" in window) await Promise.all((await caches.keys()).filter(key => key.startsWith("bathos-reader-")).map(key => caches.delete(key)))
      }).catch(error => console.warn("Reader cache cleanup failed", error))
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
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
    {!installed && <button onClick={install} aria-label="Install Bathos" aria-expanded={showHelp} className="p-2 rounded-lg hover:bg-secondary transition-colors"><Download className="w-5 h-5" /></button>}
    {showHelp && <div className="absolute top-full inset-x-0 border-b border-border bg-card p-4 shadow-xl" role="region" aria-label="Install Bathos instructions">
      <div className="flex items-center justify-between gap-4"><strong>Install Bathos</strong><button onClick={() => setShowHelp(false)} aria-label="Close installation instructions" className="p-2 rounded-lg hover:bg-secondary"><X className="w-5 h-5" /></button></div>
      <p className="text-sm text-muted-foreground max-w-prose">On iPhone or iPad, open in Safari and choose Share → Add to Home Screen. On Android or desktop, use your browser’s Install app or Add to Home screen option when available.</p>
    </div>}
  </>
}
