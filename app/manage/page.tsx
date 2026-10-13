"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { ArrowLeft, Check, Download, Feather, Plus, Search, Trash2, WifiOff } from "lucide-react"
import "./manage.css"

type Post = { slug: string; title: string; description: string; date: string; tags: string[]; body: string; sha?: string }
type PostWarning = { slug: string; message: string }
type Draft = { post: Post; savedAt: string }
type DeviceDraft = Draft & { key: string }
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
class ApiError extends Error { constructor(message: string, public status: number) { super(message) } }
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(path, { ...options, credentials: "same-origin", signal: controller.signal, headers: { "Content-Type": "application/json", ...options.headers } })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new ApiError(data.error || "That request could not be completed. Please try again.", response.status)
    return data as T
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("The request took too long. Please try again.")
    throw error
  } finally { clearTimeout(timeout) }
}
const emptyPost = (): Post => ({ slug: "", title: "", description: "", date: new Date().toISOString().slice(0, 10), tags: [], body: "" })
const draftKey = (slug: string) => `bathos:post-draft:${slug || "new"}`
const validDraft = (draft: Draft) => draft?.post && typeof draft.savedAt === "string" && ["slug", "title", "description", "date", "body"].every(key => typeof draft.post[key as keyof Post] === "string") && (draft.post.sha === undefined || typeof draft.post.sha === "string") && Array.isArray(draft.post.tags) && draft.post.tags.every(tag => typeof tag === "string")
const slugify = (title: string) => title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100).replace(/-$/, "")

export default function ManagePosts() {
  const [session, setSession] = useState<"loading" | "in" | "out">("loading")
  const [login, setLogin] = useState("")
  const [posts, setPosts] = useState<Post[]>([])
  const [warnings, setWarnings] = useState<PostWarning[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [storageError, setStorageError] = useState("")
  const [query, setQuery] = useState("")
  const [post, setPost] = useState<Post | null>(null)
  const [original, setOriginal] = useState("")
  const [draftSlug, setDraftSlug] = useState("")
  const [recovery, setRecovery] = useState<Draft | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const [deviceDrafts, setDeviceDrafts] = useState<DeviceDraft[]>([])
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(true)
  const [conflict, setConflict] = useState(false)
  const [notice, setNotice] = useState("")
  const [deployment, setDeployment] = useState<{ sha: string; text: string } | null>(null)
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const [installHelp, setInstallHelp] = useState(false)
  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null)
  const dirty = !!post && JSON.stringify(post) !== original
  const stateRef = useRef({ post, dirty, draftSlug, busy })
  stateRef.current = { post, dirty, draftSlug, busy }

  const loadDrafts = useCallback(() => {
    try {
      const found: DeviceDraft[] = []
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index)
        if (!key?.startsWith("bathos:post-draft:")) continue
        try {
          const draft = JSON.parse(localStorage.getItem(key) || "null")
          if (validDraft(draft)) found.push({ ...draft, key })
        } catch { /* An unreadable draft does not hide the other drafts. */ }
      }
      setDeviceDrafts(found.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || "")))
    } catch { setStorageError("Your browser could not read device drafts. Keep the editor open if you have unsaved writing.") }
  }, [])

  const keepDraft = useCallback((value: Post, key: string) => {
    try {
      localStorage.setItem(draftKey(key), JSON.stringify({ post: value, savedAt: new Date().toISOString() }))
      setDraftSaved(true)
      setStorageError("")
      loadDrafts()
      return true
    } catch { setStorageError("Your browser could not save this draft on your device. Keep this page open or copy your writing before leaving."); return false }
  }, [loadDrafts])

  const loadPosts = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const result = await api<{ posts: Post[]; warnings?: PostWarning[] }>("/api/posts")
      setPosts(result.posts)
      setWarnings(result.warnings || [])
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setSession("out")
      setError(e instanceof Error ? e.message : "Could not load your posts.")
    } finally { setLoading(false) }
  }, [])

  const checkSession = useCallback(async () => {
    setSession("loading"); setError("")
    try {
      const result = await api<{ authenticated: boolean; user?: { login: string } }>("/api/session")
      setSession(result.authenticated ? "in" : "out"); setLogin(result.user?.login || "")
      if (result.authenticated) await loadPosts()
    } catch (e) {
      setSession("out")
      if (!(e instanceof ApiError && e.status === 401)) setError(e instanceof Error ? e.message : "Could not check sign-in.")
    }
    const params = new URLSearchParams(window.location.search)
    if (params.has("auth_error") || params.has("error")) setError(params.get("auth_error") === "permission" ? "That GitHub account does not have permission to manage Bathos. Sign in with the site owner’s account." : "GitHub sign-in did not finish. Please try signing in again.")
  }, [loadPosts])

  useEffect(() => { void checkSession() }, [checkSession])
  useEffect(() => {
    const viewport = window.visualViewport
    const sync = () => document.documentElement.style.setProperty("--pm-keyboard-inset", `${Math.max(0, window.innerHeight - (viewport?.height || window.innerHeight) - (viewport?.offsetTop || 0))}px`)
    sync(); viewport?.addEventListener("resize", sync); viewport?.addEventListener("scroll", sync)
    return () => { viewport?.removeEventListener("resize", sync); viewport?.removeEventListener("scroll", sync); document.documentElement.style.removeProperty("--pm-keyboard-inset") }
  }, [])
  useEffect(() => { loadDrafts() }, [loadDrafts])
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    sync(); window.addEventListener("online", sync); window.addEventListener("offline", sync)
    const install = (e: Event) => { e.preventDefault(); setInstallPrompt(e as InstallPrompt) }
    window.addEventListener("beforeinstallprompt", install)
    let alive = true
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/manage/sw.js", { scope: "/manage/" }).then(registration => {
      if (!alive) return
      if (registration.waiting) setUpdateWorker(registration.waiting)
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing
        worker?.addEventListener("statechange", () => { if (alive && worker.state === "installed" && navigator.serviceWorker.controller) setUpdateWorker(worker) })
      })
    }).catch(() => { /* Authoring remains available without offline installation. */ })
    return () => { alive = false; window.removeEventListener("online", sync); window.removeEventListener("offline", sync); window.removeEventListener("beforeinstallprompt", install) }
  }, [])

  useEffect(() => {
    if (!post || !dirty || recovery) return
    setDraftSaved(false)
    const timer = setTimeout(() => keepDraft(post, draftSlug), 600)
    return () => clearTimeout(timer)
  }, [post, dirty, draftSlug, recovery, keepDraft])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const current = stateRef.current
      if (current.dirty || current.busy) { if (current.post && current.dirty) keepDraft(current.post, current.draftSlug); event.preventDefault(); event.returnValue = "" }
    }
    const back = () => {
      const current = stateRef.current
      if (!current.post) return
      if (current.busy || (current.dirty && !window.confirm("Leave the editor? Your writing will stay as a draft on this device."))) { history.pushState({ editor: true }, ""); return }
      if (current.dirty && !keepDraft(current.post, current.draftSlug)) { history.pushState({ editor: true }, ""); return }
      setPost(null); setRecovery(null); setError("")
    }
    window.addEventListener("beforeunload", beforeUnload); window.addEventListener("popstate", back)
    return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("popstate", back) }
  }, [keepDraft])

  useEffect(() => {
    if (!deployment) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const sha = deployment.sha
    const poll = async (attempt: number) => {
      try {
        const result = await api<{ state: string; message?: string }>(`/api/deployment/${encodeURIComponent(sha)}`)
        if (cancelled) return
        if (["success", "published", "deployed"].includes(result.state)) { setDeployment({ sha, text: "Published. Your changes are live on Bathos." }); return }
        if (["failure", "failed", "error", "cancelled", "canceled"].includes(result.state)) { setDeployment({ sha, text: "Saved to GitHub, but publishing failed. Your changes are safe; check the deployment before retrying." }); return }
      } catch { if (cancelled) return }
      if (attempt >= 20) { setDeployment({ sha, text: "Saved to GitHub. Publishing could not be confirmed yet; check your site again shortly." }); return }
      timer = setTimeout(() => void poll(attempt + 1), 6000)
    }
    void poll(0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [deployment?.sha])

  function enter(value: Post) {
    setPost(value); setOriginal(JSON.stringify(value)); setDraftSlug(value.sha ? value.slug : ""); setPreview(false); setConflict(false); setError(""); setNotice(""); setDraftSaved(false); setRecovery(null)
    history.pushState({ editor: true }, "")
    try {
      const stored = localStorage.getItem(draftKey(value.sha ? value.slug : ""))
      if (stored) {
        const draft = JSON.parse(stored)
        if (validDraft(draft)) setRecovery(draft)
      }
    } catch { setStorageError("Draft recovery is unavailable on this device.") }
    window.scrollTo(0, 0)
  }
  function continueDraft(draft: DeviceDraft) {
    const value = draft.post
    setPost(value); setOriginal(""); setDraftSlug(draft.key.slice("bathos:post-draft:".length) === "new" ? "" : draft.key.slice("bathos:post-draft:".length)); setPreview(false); setConflict(false); setError(""); setNotice("Device draft recovered. Saving checks for changes to the current post."); setDraftSaved(true); setRecovery(null)
    history.pushState({ editor: true }, ""); window.scrollTo(0, 0)
  }
  function discardDraft(draft: DeviceDraft) {
    if (!window.confirm(`Discard the device draft “${draft.post.title || "Untitled post"}”? Your published post will not change.`)) return
    try { localStorage.removeItem(draft.key); loadDrafts() }
    catch { setStorageError("Could not remove the draft from this device.") }
  }
  async function openPost(slug: string) {
    setBusy(true); setError("")
    try { enter(await api<Post>(`/api/posts/${encodeURIComponent(slug)}`)) }
    catch (e) { handleError(e) }
    finally { setBusy(false) }
  }
  function handleError(e: unknown) {
    if (e instanceof ApiError && e.status === 401) setSession("out")
    if (e instanceof ApiError && e.status === 409) setConflict(true)
    setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
  }
  function change(field: keyof Post, value: string | string[]) {
    if (!post) return
    setPost({ ...post, [field]: value }); setNotice("")
  }
  async function save() {
    if (!post || busy || !online || session !== "in" || conflict) return
    const value = { ...post, slug: post.slug || slugify(post.title), tags: [...new Set(post.tags.map(tag => tag.trim()).filter(Boolean))] }
    if (!value.title.trim() || !value.body.trim() || !(value.sha ? /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/ : /^[a-z0-9]+(?:-[a-z0-9]+)*$/).test(value.slug) || !value.date) { setError("Add a title, a date, some writing, and a URL name using letters, numbers and hyphens."); return }
    setBusy(true); setError(""); setPost(value); keepDraft(value, draftSlug)
    try {
      const result = await api<{ post: Post; commitSha: string }>(value.sha ? `/api/posts/${encodeURIComponent(value.slug)}` : "/api/posts", { method: value.sha ? "PUT" : "POST", body: JSON.stringify(value) })
      setPost(result.post); setOriginal(JSON.stringify(result.post)); setDraftSlug(result.post.slug); setDraftSaved(false); setRecovery(null)
      try { localStorage.removeItem(draftKey(draftSlug)); loadDrafts() } catch { setStorageError("Saved to the site, but this device could not remove the old draft.") }
      setNotice("Saved to GitHub."); setDeployment({ sha: result.commitSha, text: "Saved to GitHub. Publishing to Bathos…" }); void loadPosts()
    } catch (e) { handleError(e) }
    finally { setBusy(false) }
  }
  async function remove() {
    if (!post?.sha || busy || !online || !window.confirm(`Delete “${post.title}” from Bathos? This removes the post when the site publishes.${dirty ? " Unsaved writing in this editor will also be removed." : ""}`)) return
    setBusy(true); setError("")
    try {
      const result = await api<{ commitSha: string }>(`/api/posts/${encodeURIComponent(post.slug)}`, { method: "DELETE", body: JSON.stringify({ sha: post.sha }) })
      try { localStorage.removeItem(draftKey(draftSlug)); loadDrafts() } catch { setStorageError("Deleted from the site, but the local draft could not be removed.") }
      setPost(null); setOriginal(""); setRecovery(null); history.replaceState({}, ""); setDeployment({ sha: result.commitSha, text: "Deleted from GitHub. Publishing to Bathos…" }); void loadPosts()
    } catch (e) { handleError(e) }
    finally { setBusy(false) }
  }
  async function reloadConflict() {
    if (!post || !keepDraft(post, draftSlug)) return
    setBusy(true)
    try {
      const current = await api<Post>(`/api/posts/${encodeURIComponent(post.slug)}`)
      setRecovery({ post, savedAt: new Date().toISOString() }); setPost(current); setOriginal(JSON.stringify(current)); setConflict(false); setError(""); setNotice("Loaded the current post. Your earlier writing is kept as a device draft.")
    } catch (e) { handleError(e) } finally { setBusy(false) }
  }
  const visiblePosts = posts.filter(p => `${p.slug} ${p.title} ${p.description} ${p.tags?.join(" ")}`.toLowerCase().includes(query.toLowerCase()))

  return <main className={`post-manager${post ? " pm-is-editing" : ""}`}>
    <header className="pm-header"><a href="/" onClick={e => { if (busy || (dirty && !window.confirm("Leave the editor? Your writing will stay as a draft on this device."))) e.preventDefault(); else if (post && dirty && !keepDraft(post, draftSlug)) e.preventDefault() }}><ArrowLeft size={18} /> Bathos</a><button className="pm-quiet" onClick={() => setInstallHelp(!installHelp)}><Download size={17} /> Install</button></header>
    <div className="pm-shell">
      <div className="pm-masthead"><span className="pm-eyebrow"><Feather size={16} /> YOUR WRITING ROOM</span><h1>{post ? post.sha ? "Edit your post" : "A new thought" : "Manage posts"}</h1><p>{post ? "A little space to put your words in order." : "Write, polish and publish, wherever you are."}</p></div>
      {installHelp && <section className="pm-panel"><h2>Keep Bathos on your home screen</h2>{installPrompt ? <button onClick={async () => { await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null) }}>Install Bathos</button> : <p>On iPhone or iPad, open this page in Safari, tap Share, then Add to Home Screen. On Android, choose Install app or Add to Home screen in your browser menu.</p>}<p className="pm-small">Installed or in your browser, drafts stay on this device. Publishing needs a connection.</p></section>}
      {updateWorker && <div className="pm-banner">An app update is ready. <button disabled={busy} onClick={() => { if (dirty && post && !keepDraft(post, draftSlug)) return; if (dirty && !window.confirm("Update the app? Your writing is kept as a device draft.")) return; navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true }); updateWorker.postMessage({ type: "SKIP_WAITING" }) }}>Update app</button></div>}
      {!online && <div className="pm-banner"><WifiOff size={17} /><span>You’re offline. You can write a device draft; reconnect to save to the site.</span></div>}
      {storageError && <div role="alert" className="pm-error">{storageError}</div>}
      {error && <div role="alert" className="pm-error">{error}{conflict && <button onClick={reloadConflict} disabled={busy}>Load current post & keep my draft</button>}</div>}
      {!post && warnings.length > 0 && <section className="pm-panel pm-warnings" aria-label="Posts needing attention"><h2>Posts needing attention</h2><p>These files are still in GitHub. Your other posts are available.</p><ul>{warnings.map(warning => <li key={warning.slug}><a href={`https://github.com/sighmoan1/bathos/blob/main/content/${encodeURIComponent(warning.slug)}.md`} target="_blank" rel="noopener noreferrer">{warning.slug}.md</a>: {warning.message}</li>)}</ul></section>}
      {deployment && <div role="status" className="pm-banner pm-publishing"><Check size={17} /><span>{deployment.text}</span></div>}
      {session === "loading" && <p role="status" className="pm-loading">Checking sign-in…</p>}
      {session === "out" && <section className="pm-panel pm-login"><h2>Your posts, in your pocket.</h2><p>Sign in with GitHub to manage your Bathos posts. You can also start writing a draft now.</p><a className="pm-primary pm-button" href="/api/login" onClick={e => { if (post && dirty && !keepDraft(post, draftSlug)) e.preventDefault() }}>Sign in with GitHub</a><button className="pm-quiet" onClick={() => void checkSession()} disabled={!online}>Check sign-in again</button>{!post && <button onClick={() => enter(emptyPost())}>Write a device draft</button>}</section>}
      {post ? <section className="pm-editor" aria-label="Post editor">
        <div className="pm-editor-top"><button className="pm-quiet" disabled={busy} onClick={() => { if (dirty && !window.confirm("Back to posts? Your writing will stay as a draft on this device.")) return; if (dirty && !keepDraft(post, draftSlug)) return; setPost(null); setRecovery(null); setError(""); history.replaceState({}, "") }}><ArrowLeft size={17} /> All posts</button><span className="pm-small">{dirty ? draftSaved ? "Draft saved on this device" : "Saving device draft…" : post.sha ? "Saved post" : "New device draft"}</span></div>
        {recovery && <div className="pm-panel pm-recovery"><h2>Your device draft is here</h2><p>Recover your earlier writing, or keep the version below.</p><button onClick={() => { setPost({ ...recovery.post, sha: post.sha, ...(post.sha ? { slug: post.slug } : {}) }); setRecovery(null); setDraftSaved(true) }}>Recover device draft</button><button className="pm-quiet" onClick={() => { setRecovery(null); try { localStorage.removeItem(draftKey(draftSlug)); loadDrafts() } catch { setStorageError("Could not remove the draft from this device.") } }}>Keep current version</button></div>}
        <fieldset disabled={busy}>
          <label>Title<input value={post.title} maxLength={300} placeholder="What’s on your mind?" onChange={e => change("title", e.target.value)} /></label>
          <label>Description<textarea className="pm-description" value={post.description} maxLength={2000} placeholder="A short introduction for the reader" onChange={e => change("description", e.target.value)} /></label>
          <div className="pm-fields"><label>Date<input type="date" value={post.date.slice(0, 10)} onChange={e => change("date", e.target.value)} /></label><label>Tags<input value={post.tags.join(", ")} placeholder="life, ideas" onChange={e => change("tags", e.target.value.split(",").map(t => t.trim()))} /><span className="pm-small">Separate tags with commas.</span></label></div>
          {!post.sha && <label>URL name<input value={post.slug} placeholder={slugify(post.title) || "my-new-post"} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} onChange={e => change("slug", e.target.value)} /><span className="pm-small">Leave blank to use the title.</span></label>}
          <div className="pm-writing-head"><label htmlFor="post-body">Your writing</label><div className="pm-tabs" role="group" aria-label="Editor view"><button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>Write</button><button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>Preview</button></div></div>
          {preview ? <article className="pm-preview"><h2>{post.title || "Untitled post"}</h2>{post.body ? <ReactMarkdown components={{ a: props => <a {...props} target="_blank" rel="noopener noreferrer" /> }}>{post.body}</ReactMarkdown> : <p>Your writing will appear here.</p>}</article> : <textarea id="post-body" className="pm-body" value={post.body} placeholder="Start writing…\n\nMarkdown works here." onChange={e => change("body", e.target.value)} />}
        </fieldset>
        {notice && <p role="status" className="pm-small">{notice}</p>}
        <div className="pm-actions"><button className="pm-primary" onClick={save} disabled={busy || !online || session !== "in" || conflict || !!recovery}>{busy ? "Working…" : "Save to site"}</button><button onClick={() => keepDraft(post, draftSlug)} disabled={busy}>Save device draft</button>{post.sha && <button className="pm-delete" aria-label="Delete post" disabled={busy || !online || session !== "in" || conflict} onClick={remove}><Trash2 size={19} /><span>Delete</span></button>}</div>
      </section> : <>
        {deviceDrafts.length > 0 && <section className="pm-device-drafts" aria-label="Device drafts"><h2>Device drafts</h2><p className="pm-small">Writing kept on this device. Continue online or offline; nothing publishes until you save to the site.</p>{deviceDrafts.map(draft => <div className="pm-device-draft" key={draft.key}><div><h3>{draft.post.title || "Untitled post"}</h3><span className="pm-small">{draft.savedAt && !Number.isNaN(Date.parse(draft.savedAt)) ? `Saved ${new Date(draft.savedAt).toLocaleString()}` : "Saved on this device"}</span></div><div className="pm-draft-buttons"><button aria-label={`Continue draft ${draft.post.title || "Untitled post"}`} onClick={() => continueDraft(draft)}>Continue draft</button><button className="pm-quiet" aria-label={`Discard draft ${draft.post.title || "Untitled post"}`} onClick={() => discardDraft(draft)}>Discard</button></div></div>)}</section>}
        <div className="pm-list-tools"><label className="pm-search"><Search size={18} /><span className="pm-sr-only">Search posts</span><input type="search" placeholder="Search your posts" value={query} onChange={e => setQuery(e.target.value)} /></label><button className="pm-primary" onClick={() => enter(emptyPost())} disabled={busy}><Plus size={19} /> New post</button></div>
        {session === "in" && <div className="pm-list-meta"><span>{posts.length} {posts.length === 1 ? "post" : "posts"} · {login}</span><button className="pm-quiet" disabled={loading || !online} onClick={loadPosts}>Refresh posts</button><button className="pm-quiet" disabled={busy || !online} onClick={async () => { setBusy(true); try { await api("/api/logout", { method: "POST", body: "{}" }); setSession("out"); setPosts([]); setWarnings([]) } catch (e) { handleError(e) } finally { setBusy(false) } }}>Sign out</button></div>}
        {loading ? <p role="status" className="pm-loading">Loading your posts…</p> : session === "in" && <div className="pm-posts">{visiblePosts.length ? visiblePosts.map(item => <button className="pm-post" key={item.slug} disabled={busy || !online} onClick={() => void openPost(item.slug)}><span className="pm-post-date">{item.date?.slice(0, 10)}</span><h2>{item.title}</h2><p>{item.description}</p><span className="pm-post-tags">{item.tags?.filter(Boolean).join(" · ")}</span><span className="pm-edit-label">Edit post ↗</span></button>) : <section className="pm-panel"><h2>{query ? "No posts match that search." : "Your next post starts here."}</h2><p>{query ? "Try another title or tag." : "Tap New post to start writing."}</p></section>}</div>}
        {error && session === "in" && <button disabled={loading || !online} onClick={loadPosts}>Retry loading posts</button>}
      </>}
      <footer className="pm-footer">A quiet corner of Bathos.</footer>
    </div>
  </main>
}
