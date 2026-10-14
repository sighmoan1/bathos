import type { Components } from "react-markdown"

const localVideoPath = /^\/images\/posts\/[A-Za-z0-9-]+(?:\/[A-Za-z0-9-]+)*\.mp4$/

export const ArticleMarkdownAnchor: NonNullable<Components["a"]> = ({ node: _node, href, children, ...props }) => {
  if (href && localVideoPath.test(href)) {
    const captions = href.replace(/\.mp4$/, ".en.vtt")
    const label = typeof children === "string" ? children : "Article video"
    return (
      <figure className="my-8">
        <video className="block h-auto w-full" controls preload="metadata" aria-label={label}>
          <source src={href} type="video/mp4" />
          <track kind="captions" src={captions} srcLang="en" label="English" default />
          Your browser does not support embedded video.
        </video>
        <figcaption className="mt-2 text-sm">
          {children}. <a href={href}>Open or download the video</a>; <a href={captions}>download the captions</a>.
        </figcaption>
      </figure>
    )
  }
  return <a href={href} {...props}>{children}</a>
}

export const articleMarkdownComponents: Components = { a: ArticleMarkdownAnchor }
