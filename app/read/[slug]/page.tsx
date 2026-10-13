import type { Metadata } from "next"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"
import { WebmentionResponses } from "@/components/webmention-responses"
import { getAllArticles } from "@/lib/articles"
import { postPath } from "@/lib/post-links"
import { ReplyContext } from "@/components/reply-context"
import styles from "../../articles/reading.module.css"

export const dynamicParams = false
export function generateStaticParams() {
  return getAllArticles().map(({ slug }) => ({ slug }))
}
type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = getAllArticles().find((post) => post.slug === slug)
  if (!article) notFound()
  const url = `https://bathos.org${postPath(slug)}`
  return {
    title: `${article.title} | Bathos`,
    description: article.description,
    alternates: { canonical: url },
    openGraph: { title: article.title, description: article.description, url, type: "article" },
    twitter: { card: "summary", title: article.title, description: article.description },
  }
}

export default async function Read({ params }: Props) {
  const { slug } = await params
  const article = getAllArticles().find((post) => post.slug === slug)
  if (!article) notFound()
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#article">Skip to article</a>
      <header className={styles.header}>
        <nav aria-label="Reading navigation">
          <a href="/articles/">All articles</a>
          <a href={postPath(article.slug)}>Open in swipe reader</a>
        </nav>
      </header>
      <main id="article" className={styles.main}>
        <article className="h-entry">
          <header className={styles.header}>
            <h1 className="p-name">{article.title}</h1>
            <a className="u-url" href={`https://bathos.org${postPath(article.slug)}`}>Permalink</a>
            <ReplyContext inReplyTo={article.inReplyTo} />
            <p>{article.description}</p>
            {article.date && <p className={styles.meta}><time dateTime={article.date}>{article.date}</time></p>}
            {!!article.tags?.length && <ul aria-label="Tags" className={styles.tags}>
              {article.tags.map((tag) => <li key={tag}>{tag}</li>)}
            </ul>}
          </header>
          <div className={`e-content article-prose ${styles.main}`}><ReactMarkdown>{article.content}</ReactMarkdown></div>
          <WebmentionResponses target={`https://bathos.org${postPath(article.slug)}`} />
        </article>
        <footer className={styles.footer}><a href="/articles/">Back to all articles</a></footer>
      </main>
    </div>
  )
}
