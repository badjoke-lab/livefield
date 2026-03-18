import type { DayFlowPayload } from "../../../../../packages/shared/src/types/day-flow"

function buildQuery(filters: {
  day: "today" | "rolling24h" | "yesterday" | "date"
  date: string
  top: 10 | 20 | 50
  mode: "volume" | "share"
  bucket: 5 | 10
}): string {
  const url = new URL("/api/day-flow", window.location.origin)
  url.searchParams.set("day", filters.day)
  url.searchParams.set("rangeMode", filters.day)
  if (filters.day === "date" && filters.date) {
    url.searchParams.set("date", filters.date)
  }
  url.searchParams.set("top", String(filters.top))
  url.searchParams.set("mode", filters.mode)
  url.searchParams.set("metric", filters.mode)
  url.searchParams.set("bucket", String(filters.bucket))
  return url.toString()
}

export async function getDayFlowPayload(filters: {
  day: "today" | "rolling24h" | "yesterday" | "date"
  date: string
  top: 10 | 20 | 50
  mode: "volume" | "share"
  bucket: 5 | 10
  signal?: AbortSignal
}): Promise<DayFlowPayload> {
  const response = await fetch(buildQuery(filters), {
    headers: { accept: "application/json" },
    signal: filters.signal
  })
  if (!response.ok) {
    throw new Error(`day-flow api returned ${response.status}`)
  }

  return (await response.json()) as DayFlowPayload
}
