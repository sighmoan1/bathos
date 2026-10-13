"use client"

import { useEffect, useState, type FormEvent } from "react"
import { validateWebmentionSubmission, webmentionResponseMessage } from "@/lib/webmention-submission"

export function WebmentionSubmit({ endpoint }: { endpoint: string | null }) {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)
  const [target, setTarget] = useState("")
  useEffect(() => {
    const candidate = new URLSearchParams(window.location.search).get("target")
    if (!candidate) return
    try {
      const valid = validateWebmentionSubmission("https://example.org/reply/", candidate)
      setTarget(valid.target)
    } catch { /* Invalid query parameters never populate the form. */ }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!endpoint || pending) return
    setMessage("")
    const values = new FormData(event.currentTarget)
    let sending = false
    try {
      const payload = validateWebmentionSubmission(String(values.get("source") ?? ""), String(values.get("target") ?? ""))
      setPending(true)
      sending = true
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
        body: new URLSearchParams(payload).toString(),
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      })
      setFailed(!response.ok)
      setMessage(webmentionResponseMessage(response.status))
    } catch (error) {
      setFailed(true)
      setMessage(sending ? "We could not confirm receipt. Check your connection and try again later." : error instanceof Error ? error.message : "We could not confirm receipt. Check your connection and try again later.")
    } finally { setPending(false) }
  }

  if (!endpoint) return <p className="webmention-notice" role="status">URL submission is currently unavailable because a Webmention receiver has not been configured. You can still publish a reply linking to the Bathos article. Return here when submission is available.</p>

  return <form onSubmit={submit} aria-busy={pending} aria-describedby="submission-explanation">
    <p id="submission-explanation">Submit only a reply you are authorised to publish. Its public page must contain a link to the Bathos article. The receiver checks that link and may moderate submissions before displaying them.</p>
    <label htmlFor="webmention-source">Your published reply URL</label>
    <input id="webmention-source" name="source" type="url" required maxLength={2048} placeholder="https://your-site.example/my-reply/" autoComplete="url" />
    <label htmlFor="webmention-target">Bathos article URL</label>
    <input id="webmention-target" name="target" value={target} onChange={(event) => setTarget(event.target.value)} type="url" required maxLength={2048} placeholder="https://bathos.org/posts/article-slug/" aria-describedby="target-help" />
    <p id="target-help" className="webmention-small">Use the article’s permanent address, including its final slash.</p>
    <button type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit published reply"}</button>
    <p role={failed ? "alert" : "status"} aria-live="polite" className="webmention-notice">{message}</p>
  </form>
}
