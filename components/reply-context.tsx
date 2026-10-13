import { parseInReplyTo } from "@/lib/reply-metadata"

/** Shared by the initial HTML and hydrated reader, so each target appears once. */
export function ReplyContext({ inReplyTo }: { inReplyTo?: string[] }) {
  const targets = parseInReplyTo(inReplyTo)
  if (!targets.length) return null

  return (
    <aside aria-label="Reply context" className="mb-6 text-sm text-muted-foreground">
      <p>In reply to:</p>
      <ul className="mt-2 space-y-2">
        {targets.map((target) => (
          <li key={target}>
            <a className="u-in-reply-to underline break-all" href={target}>
              {target}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  )
}
