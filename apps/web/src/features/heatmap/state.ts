import type { HeatmapPayload } from "../../../../../packages/shared/src/types/heatmap"
import { getHeatmapPayload } from "../../shared/api/heatmap-api"

export type HeatmapMode = "live" | "stale" | "demo"

export type HeatmapPageState =
  | { status: "loading" }
  | { status: "ready"; mode: HeatmapMode; payload: HeatmapPayload }
  | { status: "error"; message: string }

function getAgeMinutes(updatedAt: string): number | null {
  const ts = Date.parse(updatedAt)
  if (Number.isNaN(ts)) return null
  return Math.max(0, (Date.now() - ts) / 1000 / 60)
}

function resolveMode(payload: HeatmapPayload): HeatmapMode {
  if (payload.source === "demo") {
    return "demo"
  }

  const ageMinutes = getAgeMinutes(payload.updatedAt)
  if (ageMinutes !== null && ageMinutes > 5) {
    return "stale"
  }

  return "live"
}

export async function loadHeatmapPageState(): Promise<HeatmapPageState> {
  try {
    const payload = await getHeatmapPayload()
    return {
      status: "ready",
      mode: resolveMode(payload),
      payload
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "unknown heatmap error"
    }
  }
}
