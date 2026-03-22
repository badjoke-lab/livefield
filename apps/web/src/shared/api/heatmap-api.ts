import demoPayload from "../../../../../fixtures/demo/heatmap.json"
import type { HeatmapPayload } from "../../../../../packages/shared/src/types/heatmap"

export type HeatmapFilters = {
  day: "today" | "yesterday" | "date"
  date: string
}

function buildQuery(filters: HeatmapFilters): string {
  const url = new URL("/api/heatmap", window.location.origin)
  url.searchParams.set("day", filters.day)
  if (filters.day === "date" && filters.date) url.searchParams.set("date", filters.date)
  return url.toString()
}

export async function getHeatmapPayload(filters: HeatmapFilters): Promise<HeatmapPayload> {
  try {
    const response = await fetch(buildQuery(filters), {
      headers: { accept: "application/json" }
    })

    if (!response.ok) {
      throw new Error(`heatmap api returned ${response.status}`)
    }

    return (await response.json()) as HeatmapPayload
  } catch {
    return structuredClone(demoPayload as HeatmapPayload)
  }
}
