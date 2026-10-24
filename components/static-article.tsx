import type { Article } from "@/lib/articles"
import { ArticleMarkdownContent } from "./article-markdown"
import { WebmentionResponses } from "./webmention-responses"
import { ReplyContext } from "./reply-context"
import { WebmentionAdoptionLink } from "./webmention-adoption-link"
import { postPath } from "@/lib/post-links"
import styles from "@/app/articles/reading.module.css"

// Shared server-rendered reading surface: canonical links remain complete even
// when JavaScript is disabled, unavailable or deliberately skipped by a crawler.
export function StaticArticle({ article, canonicalEntry = false }: { article: Article; canonicalEntry?: boolean }) {
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#article">Skip to article</a>
      <header className={styles.header}>
        <nav aria-label="Reading navigation">
          <a href="/articles/">All articles</a>
          {canonicalEntry
            ? <a href={`/read/${encodeURIComponent(article.slug)}/`}>Read this article without JavaScript</a>
            : <a href={postPath(article.slug)}>Open in swipe reader</a>}
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
          <div className={`e-content article-prose ${styles.main}`}><ArticleMarkdownContent>{article.content}</ArticleMarkdownContent></div>
          <WebmentionResponses target={`https://bathos.org${postPath(article.slug)}`} />
          <WebmentionAdoptionLink targetUrl={`https://bathos.org${postPath(article.slug)}`} />
        </article>
        <footer className={styles.footer}><a href="/articles/">Back to all articles</a></footer>
      </main>
    </div>
  )
}
