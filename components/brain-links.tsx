import { getBrain } from "@/lib/brain"
export function BrainLinks({ slug }: { slug: string }) {
  const brain = getBrain()
  const article = brain.articles.find(item => item.slug === slug)
  if (!article) return null
  return <aside aria-label="Connections and dialogue" className="my-8 border-t border-border pt-6">
    <h2 className="text-xl font-semibold">Connections and dialogue</h2>
    {article.threads.length > 0 && <ul className="my-3 space-y-2">{article.threads.map(id => { const thread = brain.threads.find(item => item.id === id)!; return <li key={id}><a className="underline text-accent" href={thread.url}>{thread.title}</a> — attributed readings, not author endorsement</li> })}</ul>}
    {article.backlinks.length > 0 && <p className="my-3">Linked from {article.backlinks.map((id, i) => { const source = brain.articles.find(item => item.slug === id)!; return <span key={id}>{i > 0 ? "; " : ""}<a className="underline text-accent" href={source.url}>{source.title}</a></span> })}.</p>}
    <p><a className="underline text-accent" href="/brain/">Explore the public brain</a></p>
  </aside>
}
