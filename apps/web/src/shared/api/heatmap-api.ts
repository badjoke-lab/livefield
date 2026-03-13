import demoPayload from "../../../../../fixtures/demo/heatmap.json"
import type { HeatmapPayload } from "../../../../../packages/shared/src/types/heatmap"

export async function getHeatmapPayload(): Promise<HeatmapPayload> {
  try {
    const response = await fetch("/api/heatmap", {
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
