"use client"

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import Script from "next/script"
import { Mail } from "lucide-react"

type Turnstile = {
  render: (container: HTMLElement, options: { sitekey: string; action: string; size: "compact"; theme: "light"; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string
  reset: (id: string) => void
  remove: (id: string) => void
}
const challengeApi = () => (window as Window & { turnstile?: Turnstile }).turnstile

export function SubscriptionOptions({ children }: { children: ReactNode }) {
  const [siteKey, setSiteKey] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [token, setToken] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const container = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    fetch("/api/subscriptions/status", { credentials: "omit", cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) return
        const data = await response.json()
        if (data.enabled === true && typeof data.siteKey === "string" && /^[A-Za-z0-9_-]{20,100}$/.test(data.siteKey)) setSiteKey(data.siteKey)
      }).catch(() => { /* RSS remains available when mail delivery is unavailable. */ })
      .finally(() => clearTimeout(timeout))
    return () => { controller.abort(); clearTimeout(timeout); if (widget.current) challengeApi()?.remove(widget.current) }
  }, [])

  function renderChallenge() {
    if (!container.current || !siteKey || widget.current) return
    widget.current = challengeApi()?.render(container.current, {
      sitekey: siteKey,
      action: "subscribe",
      size: "compact",
      theme: "light",
      callback: value => { setToken(value); setError("") },
      "expired-callback": () => setToken(""),
      "error-callback": () => { setToken(""); setError("Verification could not finish. Please refresh this page and try again.") },
    }) || null
  }

  async function subscribe(event: FormEvent) {
    event.preventDefault()
    if (!token || busy) return
    setBusy(true); setError(""); setMessage("")
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch("/api/subscriptions", { method: "POST", credentials: "omit", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, token }) })
      const data = await response.json()
      if (!response.ok) { setError(data.error || "Could not subscribe. Please try again."); return }
      setMessage(data.message || "Check your inbox for the confirmation email."); setEmail("")
    } catch { setError("Could not reach the subscription service. Please try again, or use RSS.") }
    finally {
      clearTimeout(timeout); setBusy(false); setToken("")
      if (widget.current) challengeApi()?.reset(widget.current)
    }
  }

  return <div className={`subscription-options${siteKey ? "" : " subscription-rss-only"}`}>
    {siteKey && <section className="email-subscription" aria-labelledby="email-heading">
      <Mail size={24} /><h2 id="email-heading">By email</h2>
      <p>New writing from Bathos, delivered to your inbox. No ads.</p>
      <form onSubmit={subscribe}>
        <label htmlFor="subscription-email">Email address</label>
        <input id="subscription-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
        <div className="subscription-challenge" ref={container} />
        <button className="subscription-button" type="submit" disabled={!token || busy}>{busy ? "Subscribing…" : "Subscribe by email"}</button>
      </form>
      {error && <p className="subscription-error" role="alert">{error}</p>}
      {message && <p className="subscription-success" role="status">{message}</p>}
      <p className="subscription-note">Confirm your address using the email we send. Your address is used only for Bathos posts, and you can unsubscribe in any email. We use Resend for delivery.</p>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={renderChallenge} onError={() => setError("Verification could not load. Please refresh this page and try again.")} />
    </section>}
    {children}
  </div>
}
