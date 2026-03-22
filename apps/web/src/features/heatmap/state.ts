import type { HeatmapPayload } from "../../../../../packages/shared/src/types/heatmap"
import { getHeatmapPayload } from "../../shared/api/heatmap-api"

export type HeatmapMode = "live" | "stale" | "partial" | "empty" | "error" | "demo"

export type HeatmapPageState =
  | { status: "loading" }
  | {
      status: "ready"
      mode: HeatmapMode
      payload: HeatmapPayload
      filters: { day: "today" | "yesterday" | "date"; date: string }
      frameLabel: string
      isHistorical: boolean
    }
  | { status: "error"; message: string }

function parseDateParam(rawDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return ""
  const ts = Date.parse(`${rawDate}T00:00:00.000Z`)
  return Number.isNaN(ts) ? "" : rawDate
}

function readHeatmapFilters(): { day: "today" | "yesterday" | "date"; date: string } {
  const params = new URLSearchParams(window.location.search)
  const day = params.get("day") === "yesterday" ? "yesterday" : params.get("day") === "date" ? "date" : "today"
  const date = parseDateParam(params.get("date") ?? "")
  if (day === "date" && !date) return { day: "today", date: "" }
  return { day, date }
}

function resolveFrameLabel(filters: { day: "today" | "yesterday" | "date"; date: string }): string {
  if (filters.day === "today") return "Today · live window"
  if (filters.day === "yesterday") return "Yesterday · historical playback"
  return `${filters.date} · historical playback`
}

function getAgeMinutes(updatedAt: string): number | null {
  const ts = Date.parse(updatedAt)
  if (Number.isNaN(ts)) return null
  return Math.max(0, (Date.now() - ts) / 1000 / 60)
}

function resolveMode(payload: HeatmapPayload): HeatmapMode {
  if (payload.source === "demo" || payload.state === "demo") return "demo"
  if (payload.state === "error") return "error"
  if (payload.state === "empty") return "empty"
  if (payload.state === "partial") return "partial"
  if (payload.state === "stale") return "stale"

  const ageMinutes = getAgeMinutes(payload.updatedAt)
  if (ageMinutes !== null && ageMinutes > 5) return "stale"
  return "live"
}

export async function loadHeatmapPageState(): Promise<HeatmapPageState> {
  const filters = readHeatmapFilters()
  try {
    const payload = await getHeatmapPayload(filters)
    return {
      status: "ready",
      mode: resolveMode(payload),
      payload,
      filters,
      frameLabel: resolveFrameLabel(filters),
      isHistorical: filters.day !== "today"
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "unknown heatmap error"
    }
  }
}
