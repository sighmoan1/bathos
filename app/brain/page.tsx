import type { Metadata } from "next"
import { getBrain } from "@/lib/brain"
import { BrainView } from "./brain-view"

export const metadata: Metadata = {
  title: "Brain | Bathos",
  description: "Many readers, provisional interpretations, live questions. A public dialogue around the ideas on Bathos, not a definitive model of a person.",
  alternates: { canonical: "https://bathos.org/brain/", types: { "application/json": "https://bathos.org/brain.json" } },
}
export default function Brain() { return <BrainView brain={getBrain()} /> }
