import type { Metadata } from "next"
import { ArrowLeft, Rss } from "lucide-react"
import { SubscriptionOptions } from "./subscription-options"
import { FEED_URL } from "@/lib/rss"
import "./subscribe.css"

export const metadata: Metadata = { title: "Subscribe · Bathos", description: "Follow new Bathos posts.", alternates: { canonical: "https://bathos.org/subscribe/" } }

export default function Subscribe() {
  return <div className="subscription-surface"><main className="subscription-page">
    <a className="subscription-back" href="/"><ArrowLeft size={18} /> Back to Bathos</a>
    <h1 className="sr-only">Subscribe to Bathos</h1>
    <SubscriptionOptions>

      <section aria-labelledby="rss-heading"><Rss size={24} /><h2 id="rss-heading">By RSS</h2><p>Add Bathos to the feed reader you already use. Every post in full, including images, in one place.</p><a className="subscription-button subscription-secondary" href="/rss.xml">Open RSS feed</a><label htmlFor="feed-url">Or copy this feed URL</label><input id="feed-url" type="url" value={FEED_URL} readOnly aria-label="RSS feed URL" /><p className="subscription-note">Tap and hold the address to copy it, then paste it into your reader.</p></section>
    </SubscriptionOptions>
  </main></div>
}
