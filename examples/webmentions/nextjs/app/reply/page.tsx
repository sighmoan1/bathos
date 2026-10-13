import type { Metadata } from 'next'

const source = 'https://your-blog.example/reply/'
const target = 'https://bathos.org/posts/example/'

export const metadata: Metadata = {
  title: 'A reply to an article',
  alternates: { canonical: source },
}

export default function Reply() {
  return (
    <article className="h-entry">
      <h1 className="p-name">A reply to an article</h1>
      <a className="u-url" href={source}>Permalink</a>
      <p>In reply to <a className="u-in-reply-to" href={target}>the original article</a>.</p>
      <div className="e-content"><p>Write your considered response here.</p></div>
    </article>
  )
}
