import type { Metadata } from "next"
import { WebmentionSubmit } from "@/components/webmention-submit"
import { webmentionEndpoint } from "@/lib/webmention-submission"
import "./webmentions.css"

export const metadata: Metadata = {
  title: "Reply with Webmentions · Bathos",
  description: "Publish a reply on your own website and tell Bathos about it using Webmention.",
  alternates: { canonical: "https://bathos.org/webmentions/" },
}

export default function Webmentions() {
  const endpoint = webmentionEndpoint()
  return <main className="webmentions-page">
    <a href="/">← Back to Bathos</a>
    <header><p className="webmention-eyebrow">A CONVERSATION ACROSS WEBSITES</p><h1>Reply from your own corner of the web.</h1><p>Write a response on your website, link to the Bathos article, and send a Webmention so Bathos can check the connection.</p></header>
    <section aria-labelledby="reply-heading"><h2 id="reply-heading">How to reply</h2><ol>
      <li><strong>Publish your reply.</strong> Make it publicly accessible without a login. Include a normal link to the permanent Bathos article URL.</li>
      <li><strong>Tell Bathos where it is.</strong> If your site sends Webmentions, use its usual reply workflow. Otherwise, use the form below when the receiver is available.</li>
      <li><strong>Allow time for verification.</strong> A received notification is a request to check the link. It does not guarantee publication or endorsement.</li>
    </ol><p>You do not need to install a Webmention receiver on your own site to send a reply.</p></section>
    <section aria-labelledby="submit-heading"><h2 id="submit-heading">Already published a reply?</h2><WebmentionSubmit endpoint={endpoint} /></section>
    <section aria-labelledby="implementation-heading"><h2 id="implementation-heading">Add support to your website</h2><p>For site owners and their authorised coding agents, the <a href="/webmentions-agent.md">implementation guide</a> includes plain HTML, Jekyll, Eleventy and Next.js examples. An agent should act with its owner’s permission and keep the reply on the owner’s website.</p><p>Mark the link to the article with <code>class="u-in-reply-to"</code> if you want to describe it explicitly as a reply. That metadata helps readers and tools; the visible hyperlink is still essential.</p><p>Compatible senders discover a receiver from the target article’s <code>rel="webmention"</code> link or HTTP Link header. Only send to an endpoint that the target actually advertises.</p>{endpoint && <p>The configured Bathos receiver is <code>{endpoint}</code>.</p>}<p>Read the <a href="https://www.w3.org/TR/webmention/">W3C Webmention standard</a> for the protocol.</p></section>
    <section aria-labelledby="privacy-heading"><h2 id="privacy-heading">What you are sharing</h2><p>Submitting sends your reply URL and the Bathos article URL to Bathos’s receiver. It may retrieve your public page to verify the link. Do not include private links, credentials or personal details in these fields. Verification, abuse checks and moderation happen at the receiver.</p></section>
  </main>
}
