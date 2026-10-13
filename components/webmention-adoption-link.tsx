import { webmentionEndpoint } from "@/lib/webmention-submission"

interface WebmentionAdoptionLinkProps {
  targetUrl: string
}

/** Ordinary links keep replying discoverable in the exported HTML without JavaScript. */
export function WebmentionAdoptionLink({ targetUrl }: WebmentionAdoptionLinkProps) {
  const guideUrl = `/webmentions?target=${encodeURIComponent(targetUrl)}`
  // Set only after the receiver is deployed and verified, using the guide's shared validator.
  const receiver = webmentionEndpoint()

  return (
    <aside aria-label="Reply from your own website" className="mt-10 border-t border-border pt-6 text-sm">
      <p className="font-medium text-foreground">Want to reply from your own website?</p>
      <p className="mt-2 text-muted-foreground">
        Publish a reply linking to this article, then follow the{" "}
        <a href={guideUrl} className="underline underline-offset-4 hover:text-foreground">
          Webmention reply guide
        </a>
        .
      </p>
      {receiver && (
        <p className="mt-2 text-muted-foreground">
          <a rel="webmention" href={receiver} className="underline underline-offset-4 hover:text-foreground">
            Webmention receiver (for sending tools)
          </a>
          . Use the reply guide above to submit in your browser.
        </p>
      )}
      <p className="mt-2 text-muted-foreground">
        For your authorised coding agent: {" "}
        <a href="/webmentions-agent.md" className="underline underline-offset-4 hover:text-foreground">
          Webmention implementation instructions
        </a>
        .
      </p>
    </aside>
  )
}
