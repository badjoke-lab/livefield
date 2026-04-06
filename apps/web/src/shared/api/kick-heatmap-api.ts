export type KickHeatmapScaffoldPayload = {
  source: "api"
  platform: "kick"
  state: "unconfigured" | "loading" | "live" | "partial" | "empty" | "error"
  lastUpdated: string | null
  coverage: string
  note: string
  nodes: Array<unknown>
  summary: {
    activeStreams: number
    totalViewersObserved: number
    strongestMomentumStream: string | null
    highestActivityStream: string | null
  }
}

export async function getKickHeatmapScaffoldPayload(signal?: AbortSignal): Promise<KickHeatmapScaffoldPayload> {
  const response = await fetch("/api/kick-heatmap", {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal
  })

  if (!response.ok) {
    throw new Error(`kick heatmap api returned ${response.status}`)
  }

  return (await response.json()) as KickHeatmapScaffoldPayload
}
