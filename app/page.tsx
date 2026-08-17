import { getAllArticles, getAllTags, shuffleArray } from "@/lib/articles"
import { SwipeFeed } from "@/components/swipe-feed"

export default function Home() {
  const articles = getAllArticles()
  const shuffledArticles = shuffleArray(articles)
  const allTags = getAllTags(articles)

  return <SwipeFeed initialArticles={shuffledArticles} allTags={allTags} />
}
