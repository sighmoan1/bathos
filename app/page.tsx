import { getAllArticles, getAllTags } from "@/lib/articles"
import { SwipeFeed } from "@/components/swipe-feed"

export default function Home() {
  const articles = getAllArticles()
  const allTags = getAllTags(articles)

  return (
    <>
      <noscript>
        <style>{`[data-swipe-reader] { display: none !important; }`}</style>
        <main className="mx-auto max-w-3xl p-6">
          <h1 className="text-3xl font-bold">Bathos</h1>
          <p className="mt-4"><a className="text-accent underline" href="/articles/">Browse all articles</a> and read them without JavaScript.</p>
        </main>
      </noscript>
      <div data-swipe-reader className="contents"><SwipeFeed initialArticles={articles} allTags={allTags} /></div>
    </>
  )
}
