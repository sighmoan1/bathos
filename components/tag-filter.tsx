"use client"

import { X } from "lucide-react"
import type { TagCount } from "@/lib/articles"

interface TagFilterProps {
  tags: TagCount[]
  selected: string[]
  onToggle: (tag: string) => void
  onClear: () => void
  onDone: () => void
}

/**
 * Topic sheet below the header. Selecting several tags matches articles
 * carrying *any* of them (OR), so the feed widens rather than narrows.
 */
export function TagFilter({ tags, selected, onToggle, onClear, onDone }: TagFilterProps) {
  return (
    <div className="feed-sheet" role="region" aria-label="Filter by topic">
      <div className="flex items-center justify-between gap-3">
        <strong>Topics</strong>
        <div className="flex items-center gap-1">
          {selected.length > 0 && (
            <button type="button" onClick={onClear} className="feed-text-button">
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
          <button type="button" onClick={onDone} className="feed-text-button feed-text-button-strong">Done</button>
        </div>
      </div>
      <div className="feed-tag-filter">
        {tags.map(({ tag, count }) => (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            aria-pressed={selected.includes(tag)}
            className="feed-chip"
          >
            {tag}
            <span className="feed-chip-count">{count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
