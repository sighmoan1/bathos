"use client"

import { useEffect, useState } from "react"
import { verifiedResponses, type WebmentionResponse } from "@/lib/webmention-responses"

export function WebmentionResponses({ target, enabled = process.env.NEXT_PUBLIC_BATHOS_WEBMENTIONS === "true" }: { target: string; enabled?: boolean }) {
  const [state, setState] = useState<{ target: string; responses: WebmentionResponse[]; loading: boolean; error: boolean }>({ target, responses: [], loading: true, error: false })
  useEffect(() => {
    if (!enabled) return
    let active = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    setState({ target, responses: [], loading: true, error: false })
    fetch(`/api/webmention/responses?${new URLSearchParams({ target })}`, { signal: controller.signal, credentials: "omit", cache: "no-store", redirect: "error" })
      .then(async (response) => {
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Responses unavailable")
        // The Worker caps its output. Cap the browser read too.
        const reader = response.body?.getReader()
        if (!reader) throw new Error("Missing response body")
        const chunks: Uint8Array[] = []
        let size = 0
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > 65536) throw new Error("Response list too large")
            chunks.push(value)
          }
        } finally { await reader.cancel() }
        const data = new Uint8Array(size)
        let offset = 0
        for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength }
        return verifiedResponses(JSON.parse(new TextDecoder().decode(data)), target)
      })
      .then((responses) => { if (active && !controller.signal.aborted) setState({ target, responses, loading: false, error: false }) })
      .catch(() => { if (active) setState({ target, responses: [], loading: false, error: true }) })
      .finally(() => clearTimeout(timeout))
    return () => { active = false; controller.abort(); clearTimeout(timeout) }
  }, [target, enabled])
  if (!enabled) return null
  const current = state.target === target ? state : { responses: [], loading: true, error: false }
  return <section aria-label="Responses from other websites" className="mt-10 border-t border-border pt-6">
    <h2 className="text-xl font-semibold mb-4">Responses from other websites</h2>
    <p className="text-sm text-muted-foreground mb-4">Verified links approved by Bathos.</p>
    {current.loading ? <p role="status">Loading responses…</p> : current.error ? <p role="status">Responses are temporarily unavailable.</p> : current.responses.length === 0 ? <p>No approved responses yet.</p> :
      <ul className="space-y-3">{current.responses.map((response) => <li key={response.source}>
        <a href={response.source} rel="ugc nofollow noopener noreferrer" className="underline">{response.name}</a>
        {response.author && <span> by {response.author}</span>}
        {response.published && <time dateTime={response.published} className="block text-sm text-muted-foreground">{response.published.slice(0, 10)}</time>}
      </li>)}</ul>}
  </section>
}
