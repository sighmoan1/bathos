interface WebmentionAdoptionLinkProps {
  targetUrl: string
}

/** Ordinary links keep replying discoverable in the exported HTML without JavaScript. */
export function WebmentionAdoptionLink({ targetUrl }: WebmentionAdoptionLinkProps) {
  const guideUrl = `/webmentions?target=${encodeURIComponent(targetUrl)}`

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
