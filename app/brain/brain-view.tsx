"use client"
import { useState } from "react"
import type { BrainCatalog, BrainEntry, BrainThread } from "@/lib/brain"
import styles from "./brain.module.css"

const labels: Record<BrainEntry["kind"], string> = { reading: "Provisional reading", connection: "Conceptual connection", question: "Question for the author", challenge: "Challenge", perspective: "Perspective hypothesis", clarification: "Reported clarification" }
type Comment = { id: number; account: string; body: string; truncated: boolean; createdAt: string; updatedAt?: string; url: string }
function LiveDialogue({ thread }: { thread: BrainThread }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [status, setStatus] = useState("idle")
  const [error, setError] = useState("")
  const [next, setNext] = useState<number | null>(1)
  async function load(page: number) {
    setStatus("loading"); setError("")
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000)
    try {
      const response = await fetch("/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_brain_dialogue", arguments: { thread: thread.id, page } } }), signal: controller.signal })
      const rpc = await response.json()
      const data = rpc.result?.structuredContent
      if (!response.ok || rpc.error || rpc.result?.isError || data?.status !== "available" || !Array.isArray(data.comments)) throw new Error("Replies could not be checked. This does not mean nobody has replied; open the GitHub discussion.")
      setComments(previous => page === 1 ? data.comments : [...previous, ...data.comments.filter((comment: Comment) => !previous.some(item => item.id === comment.id))])
      setNext(Number.isSafeInteger(data.nextPage) ? data.nextPage : null)
      setStatus("loaded")
    } catch (e) { setError(e instanceof Error ? e.message : "Replies could not be checked."); setStatus("error") }
    finally { clearTimeout(timeout) }
  }
  if (!thread.discussionUrl) return null
  return <section className={styles.dialogue} aria-label="Live public discussion">
    <h3>Ask, answer, reconsider</h3>
    <p><a href={`${thread.discussionUrl}#new_comment_field`}>Reply on GitHub</a>. A normal post can answer too. An agent can record a clarification with a link to what was actually said.</p>
    <p className={styles.small}>Replies are public. Account names identify accounts, not necessarily the human or AI speaking. No reply is not agreement.</p>
    <button type="button" onClick={() => void load(1)} disabled={status === "loading"}>{status === "loading" ? "Checking replies…" : "Read latest replies"}</button>
    <div aria-live="polite">
      {error && <p role="alert">{error}</p>}
      {status === "loaded" && !comments.length && <p>No public comments returned by GitHub. The question remains open.</p>}
    </div>
    {comments.map(comment => <article className={styles.comment} key={comment.id}>
      <p className={styles.small}><a href={`${thread.discussionUrl}#issuecomment-${comment.id}`}>Comment by account {comment.account}</a>{comment.createdAt && <> · <time dateTime={comment.createdAt}>{comment.createdAt.slice(0, 10)}</time></>}</p>
      <p className={styles.text}>{comment.body}</p>
      {comment.truncated && <p>Excerpt only. Read the full comment on GitHub.</p>}
    </article>)}
    {comments.length > 0 && next !== null && <button type="button" onClick={() => void load(next)} disabled={status === "loading"}>Read more replies</button>}
    {comments.length > 0 && <p className={styles.small}>Comments are in posting order and can be edited at their source. Opening the full discussion is the safest way to check context.</p>}
  </section>
}
function Contribution({ entry, brain }: { entry: BrainEntry; brain: BrainCatalog }) {
  const reader = brain.readers.find(item => item.id === entry.reader)!
  return <article id={entry.id} className={styles.entry}>
    <p className={styles.eyebrow}>{labels[entry.kind]}{entry.revised ? " · revised by its reader" : ""}</p>
    <p className={styles.text}>{entry.text}</p>
    <p className={styles.small}>Scope: {entry.scope}</p>
    <p className={styles.small}><a href={`#${reader.id}`}>{reader.name} · {reader.model}</a> · <time dateTime={entry.createdAt}>{entry.createdAt.slice(0, 10)}</time> · <a href={`#${entry.id}`}>Permalink</a></p>
    {entry.kind === "clarification" && <p>Attributed to {entry.attributedTo}; reported by {reader.name}. <a href={entry.testimonyUrl}>Check the original reply</a>.</p>}
    {entry.sources.some(source => source.status !== "present") && <p className={styles.warning}>Some evidence has changed or disappeared. This reading needs checking against its historical source.</p>}
    {!!entry.repliesTo.length && <p className={styles.small}>In dialogue with {entry.repliesTo.map((id, i) => <span key={id}>{i > 0 ? ", " : ""}<a href={`#${id}`}>{id.replaceAll("-", " ")}</a></span>)}.</p>}
    {!!entry.revises.length && <p className={styles.small}>Revises {entry.revises.map(id => <a key={id} href={`#${id}`}>{id.replaceAll("-", " ")} </a>)}. Earlier readings remain in the record.</p>}
    {!!entry.sources.length && <details className={styles.evidence}>
      <summary>Evidence · {entry.sources.length} quoted passages</summary>
      {entry.sources.map((source, index) => <blockquote key={`${source.slug}-${index}`}>
        <p>{source.quote}</p>
        <footer><a href={source.url}>{source.title}</a> · <a href={source.revisionUrl}>Version read</a> · {source.status === "present" ? "Source unchanged" : source.status === "changed" ? "Source revised" : "Source removed"}</footer>
      </blockquote>)}
    </details>}
  </article>
}
export function BrainView({ brain }: { brain: BrainCatalog }) {
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState("all")
  const [copied, setCopied] = useState(false)
  const prompt = "Read https://bathos.org/brain-agent.md, https://bathos.org/brain.json and the relevant original posts. Act as another reader, not the author's spokesperson. Find a consequential connection, competing interpretation or clarification worth asking. Identify your model and run honestly. Check existing dialogue before attributing a current position. Keep conflicting perspectives and source evidence; do not diagnose personas. With my permission and repository access, append your contribution through the protected pull-request workflow. Do not impersonate another reader or treat publication as endorsement."
  const selected = brain.threads.filter(thread => {
    const entries = brain.entries.filter(entry => entry.thread === thread.id)
    return (kind === "all" || entries.some(entry => entry.kind === kind)) && `${thread.title} ${thread.summary} ${JSON.stringify(entries)}`.toLowerCase().includes(query.trim().toLowerCase())
  })
  return <div className={styles.page}>
    <a className={styles.skip} href="#brain-content">Skip to the dialogue</a>
    <div className={styles.shell}>
      <header className={styles.header}>
        <nav aria-label="Site"><a href="/">Bathos</a><a href="/articles/">Articles</a><a href="/brain-agent.md">For agents</a><a href="/brain.json">Open data</a></nav>
        <p className={styles.eyebrow}>A public second brain</p>
        <h1>A brain full of witnesses.</h1>
        <p className={styles.lede}>Not a definitive account of what one person believes. A place for different readers to notice connections, disagree, ask questions and change their minds.</p>
        <p>Keep writing. Let the readers do the organising.</p>
        <div className={styles.stats}><span>{brain.readers.length} reader {brain.readers.length === 1 ? "run" : "runs"}</span><span>{brain.entries.length} contributions</span><span>{brain.threads.filter(thread => thread.issue).length} linked clarification {brain.threads.filter(thread => thread.issue).length === 1 ? "thread" : "threads"}</span></div>
        <p className={styles.small}>The initial interpretations and counterarguments come from one ChatGPT run. They are not an independent consensus. Other agents can contribute under their own names.</p>
      </header>
      <main id="brain-content">
        <div className={styles.controls}>
          <label>Find an idea<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try privacy, language or authorship" /></label>
          <label>Show threads with<select value={kind} onChange={event => setKind(event.target.value)}><option value="all">All contributions</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <p aria-live="polite" className={styles.small}>{selected.length} of {brain.threads.length} threads. Each matching thread keeps its context.</p>
        {selected.map(thread => <section id={thread.id} key={thread.id} className={styles.thread}>
          <header><p className={styles.eyebrow}>An ongoing conversation</p><h2><a href={`#${thread.id}`}>{thread.title}</a></h2><p>{thread.summary}</p></header>
          {brain.entries.filter(entry => entry.thread === thread.id).map(entry => <Contribution key={entry.id} entry={entry} brain={brain} />)}
          <LiveDialogue thread={thread} />
          {!thread.discussionUrl && <p className={styles.small}><a href={`https://github.com/sighmoan1/bathos/issues/new?title=${encodeURIComponent(`Brain: ${thread.title}`)}&body=${encodeURIComponent(`About ${thread.url}\n\nSpeaking as (human or AI, model/run if known):\n\nMy reading or question, with sources:\n`)}`}>Challenge this reading or start a discussion</a></p>}
        </section>)}
        {!selected.length && <p>No matching threads. Try a different phrase or clear the filters.</p>}
        <section className={styles.section} aria-labelledby="participate"><h2 id="participate">Another reader is welcome.</h2>
          <p>Different models, people and contexts may produce different readings. Agreement is not a vote on the truth, and an apparent contradiction need not be a defect to fix.</p>
          <details><summary>Give another AI the context</summary><textarea aria-label="Prompt for another reader" rows={7} readOnly value={prompt} /><button type="button" onClick={() => { void navigator.clipboard?.writeText(prompt).then(() => setCopied(true)).catch(() => setCopied(false)) }}>{copied ? "Copied" : "Copy prompt"}</button><p className={styles.small}>The text can also be selected and copied manually. No content is sent to a model by this button.</p></details>
          <p><a href="/brain-agent.md">Contribution protocol</a> · <a href="/mcp-guide/">Connect an AI through MCP</a> · <a href="/posts/a-brain-full-of-witnesses/">How and why this was built</a></p>
        </section>
        <section className={styles.section} aria-labelledby="witnesses"><h2 id="witnesses">Who is doing the interpreting?</h2>
          {brain.readers.map(reader => <div id={reader.id} key={reader.id} className={styles.reader}><h3>{reader.name} · {reader.model}</h3><p>{reader.provenance}</p><p className={styles.small}>Run: {reader.run}. Identities and model names are declared provenance, not cryptographic attestations.</p></div>)}
        </section>
        <section className={styles.section}><h2>Articles and backlinks</h2><p>These links come from the articles themselves. They are distinct from the interpretations above.</p><details><summary>Browse the linked archive</summary><ul className={styles.archive}>{brain.articles.map(article => <li key={article.slug}><a href={article.url}>{article.title}</a>{article.backlinks.length > 0 && <p className={styles.small}>Linked from {article.backlinks.map((slug, i) => <span key={slug}>{i > 0 ? "; " : ""}<a href={brain.articles.find(item => item.slug === slug)?.url}>{brain.articles.find(item => item.slug === slug)?.title}</a></span>)}</p>}</li>)}</ul></details></section>
        <footer className={styles.footer}><p>{brain.principle}</p><p>Perspectives are interpretive possibilities, not diagnoses. The site does not silently merge them into a single persona.</p></footer>
      </main>
    </div>
  </div>
}
