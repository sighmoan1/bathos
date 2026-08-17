"use client"

import { X } from "lucide-react"
import type { TagCount } from "@/lib/articles"

interface TagFilterProps {
  tags: TagCount[]
  selected: string[]
  onToggle: (tag: string) => void
  onClear: () => void
}

/**
 * Horizontally scrollable chip bar. Selecting several tags matches articles
 * carrying *any* of them (OR), so the deck widens rather than narrows.
 */
export function TagFilter({ tags, selected, onToggle, onClear }: TagFilterProps) {
  if (tags.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={onClear}
        aria-pressed={selected.length === 0}
        className={`shrink-0 flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
          selected.length === 0
            ? "bg-primary text-primary-foreground border-transparent"
            : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/70"
        }`}
      >
        All
        {selected.length > 0 && <X className="w-3 h-3" />}
      </button>

      {tags.map(({ tag, count }) => {
        const isSelected = selected.includes(tag)
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            aria-pressed={isSelected}
            className={`shrink-0 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              isSelected
                ? "bg-accent text-accent-foreground border-transparent"
                : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/70"
            }`}
          >
            {tag}
            <span className="ml-1.5 opacity-60">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
