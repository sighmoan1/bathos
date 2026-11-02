import { getBrain } from "@/lib/brain"
export const dynamic = "force-static"
export function GET() {
  return new Response(JSON.stringify(getBrain()), { headers: { "Content-Type": "application/json; charset=utf-8" } })
}
