"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import type { Article } from "@/lib/articles"

interface CardPeekProps {
  article: Article
  direction: "up" | "down"
  onClick: () => void
}

/**
 * A dimmed sliver of the neighbouring article, tucked behind the active card
 * so the deck reads as a stack. Clicking it navigates in that direction.
 */
export function CardPeek({ article, direction, onClick }: CardPeekProps) {
  const Icon = direction === "up" ? ChevronUp : ChevronDown

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${direction === "up" ? "Previous" : "Next"}: ${article.title}`}
      className="group w-full flex items-center gap-2 px-4 py-3 bg-card border border-border rounded-2xl shadow-lg scale-95 opacity-40 blur-[1px] hover:opacity-70 hover:blur-0 hover:scale-[0.97] transition-all cursor-pointer text-left"
    >
      {direction === "up" && <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />}
      <span className="flex-grow truncate text-sm font-medium text-foreground">{article.title}</span>
      {direction === "down" && <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />}
    </button>
  )
}
