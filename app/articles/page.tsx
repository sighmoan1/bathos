import type { Metadata } from "next"
import { getAllArticles } from "@/lib/articles"
import styles from "./reading.module.css"

export const metadata: Metadata = {
  title: "Articles | Bathos",
  description: "Browse all Bathos articles and read at your own pace.",
  alternates: { canonical: "https://bathos.org/articles/" },
}

export default function Articles() {
  const articles = getAllArticles().sort((a, b) => {
    const dateOrder = (b.date || "").localeCompare(a.date || "")
    return dateOrder || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)
  })

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#articles">Skip to articles</a>
      <header className={styles.header}>
        <nav aria-label="Reading navigation"><a href="/">Swipe reader</a></nav>
        <h1>Articles</h1>
        <p>All Bathos articles, newest first. Choose an article to read at your own pace.</p>
      </header>
      <main id="articles" className={styles.main}>
        <ul className={styles.list}>
          {articles.map((article) => (
            <li key={article.slug}>
              <h2><a href={`/read/${encodeURIComponent(article.slug)}/`}>{article.title}</a></h2>
              {article.date && <p className={styles.meta}><time dateTime={article.date}>{article.date}</time></p>}
              <p>{article.description}</p>
              {!!article.tags?.length && <ul aria-label="Tags" className={styles.tags}>
                {article.tags.map((tag) => <li key={tag}>{tag}</li>)}
              </ul>}
            </li>
          ))}
        </ul>
        {!articles.length && <p>No articles published yet.</p>}
      </main>
    </div>
  )
}
