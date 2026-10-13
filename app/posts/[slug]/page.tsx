import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getAllArticles, getAllTags } from "@/lib/articles"
import { postPath } from "@/lib/post-links"
import { SwipeFeed } from "@/components/swipe-feed"

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

export default async function Post({ params }: Props) {
  const { slug } = await params
  const articles = getAllArticles()
  const article = articles.find((post) => post.slug === slug)
  if (!article) notFound()
  return (
    <>
      <noscript>
        <style>{`[data-swipe-reader] { display: none !important; }`}</style>
        <main className="mx-auto max-w-3xl p-6">
          <h1 className="text-3xl font-bold">{article.title}</h1>
          <p className="mt-4"><a className="text-accent underline" href={`/read/${encodeURIComponent(article.slug)}/`}>Read this article without JavaScript</a></p>
          <p className="mt-4"><a className="text-accent underline" href="/articles/">Browse all articles</a></p>
        </main>
      </noscript>
      <div data-swipe-reader className="contents"><SwipeFeed initialArticles={articles} allTags={getAllTags(articles)} initialReadingArticle={article} /></div>
    </>
  )
}
