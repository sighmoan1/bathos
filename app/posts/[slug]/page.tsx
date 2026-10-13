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
  return <SwipeFeed initialArticles={articles} allTags={getAllTags(articles)} initialReadingArticle={article} />
}
