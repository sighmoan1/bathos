"use client"

import { useState } from "react"

type Preview = { enabled: boolean; posts: { title: string; summary: string; canonicalUrl: string }[]; recipients: number; preview: string; schedule: string }

export function DigestManager({ online }: { online: boolean }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  async function request(send: boolean) {
    setBusy(true); setMessage("")
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch("/api/subscriptions/digest", {
        credentials: "same-origin", cache: "no-store", signal: controller.signal,
        ...(send ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preview: preview?.preview }) } : {}),
      })
      const data = await response.json()
      if (!response.ok) {
        if (response.status === 409) setPreview(null)
        throw Error(data.error || "Could not load the email update.")
      }
      if (send) {
        setPreview(null)
        setMessage(data.queued ? `Update queued for ${data.queued} ${data.queued === 1 ? "subscriber" : "subscribers"}. Delivery starts within five minutes, subject to sending limits.` : "Nothing to send. No email was queued.")
      } else setPreview(data)
    } catch (error) { setMessage(error instanceof Error && error.name !== "AbortError" ? error.message : "The request took too long. Refresh the preview before trying again.") }
    finally { clearTimeout(timer); setBusy(false) }
  }
  return <section className="pm-panel pm-digest" aria-labelledby="digest-heading">
    <h2 id="digest-heading">Email updates</h2>
    <p>New posts are grouped into one digest on Mondays at 09:00 UK time. Edits never trigger emails. Nothing new means nothing sent.</p>
    <button disabled={!online || busy} onClick={() => void request(false)}>{busy ? "Working…" : "Preview email update"}</button>
    {preview && <div className="pm-digest-preview">
      {!preview.enabled && <p role="status">Email delivery is not enabled yet. Sender setup and inbox verification must finish before updates can be sent.</p>}
      <p>{preview.posts.length} new {preview.posts.length === 1 ? "post" : "posts"} · {preview.recipients} {preview.recipients === 1 ? "subscriber" : "subscribers"}</p>
      {preview.posts.length > 0 ? <><p>Subject: Bathos update: {preview.posts.length} new {preview.posts.length === 1 ? "post" : "posts"}</p><ul>{preview.posts.map(post => <li key={post.canonicalUrl}><a href={post.canonicalUrl} target="_blank" rel="noopener noreferrer">{post.title}</a><p>{post.summary}</p></li>)}</ul></> : <p>No new posts since the last update. Nothing will be sent.</p>}
      <button className="pm-primary" disabled={!online || busy || !preview.enabled || !preview.posts.length || !preview.recipients} onClick={() => void request(true)}>Send update now</button>
      <p className="pm-small">Only published posts are included. Sending now removes these posts from the next weekly digest. Each reader receives only posts added since they subscribed.</p>
    </div>}
    {message && <p role="status">{message}</p>}
  </section>
}
