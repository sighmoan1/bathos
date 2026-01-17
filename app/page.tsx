import { getAllArticles, shuffleArray } from "@/lib/articles"
import { SwipeFeed } from "@/components/swipe-feed"

export default function Home() {
  const articles = getAllArticles()
  const shuffledArticles = shuffleArray(articles)

  return <SwipeFeed initialArticles={shuffledArticles} />
}
