export type KickDayFlowScaffoldPayload = {
  source: "api" | "worker"
  platform: "kick"
  state: "unconfigured" | "loading" | "live" | "partial" | "empty" | "error"
  lastUpdated: string | null
  coverage: string
  note: string
  points: Array<unknown>
  summary: {
    observedBuckets: number
    totalViewersObserved: number
    strongestWindow: string | null
    strongestStreamer: string | null
  }
}

export async function getKickDayFlowScaffoldPayload(signal?: AbortSignal): Promise<KickDayFlowScaffoldPayload> {
  const response = await fetch("/api/kick-day-flow", {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal
  })

  if (!response.ok) {
    throw new Error(`kick day-flow api returned ${response.status}`)
  }

  return (await response.json()) as KickDayFlowScaffoldPayload
}
