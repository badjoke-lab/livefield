import { bridgeKickDayFlow } from "./_shared/kick-day-flow-bridge"

type WorkerPayload = {
  source: "api" | "worker"
  platform: "kick"
  state: "unconfigured" | "loading" | "live" | "partial" | "empty" | "error"
  lastUpdated: string | null
  coverage: string
  note: string
  points: Array<{
    ts: string
    totalViewersObserved: number
    observedCount: number
    strongestStreamer: string | null
  }>
  summary: {
    observedBuckets: number
    totalViewersObserved: number
    strongestWindow: string | null
    strongestStreamer: string | null
  }
}

type EnvWithKickDayFlow = {
  KICK_COLLECTOR_DAY_FLOW_URL?: string
}

export const onRequestGet: PagesFunction<EnvWithKickDayFlow> = async (context) => {
  const dayFlowUrl = context.env.KICK_COLLECTOR_DAY_FLOW_URL?.trim()
  const requestUrl = new URL(context.request.url)

  const toResponse = (payload: WorkerPayload) =>
    new Response(JSON.stringify(bridgeKickDayFlow(payload, requestUrl)), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })

  if (!dayFlowUrl) {
    return toResponse({
      source: "api",
      platform: "kick",
      state: "unconfigured",
      lastUpdated: null,
      coverage: "Kick collector not wired yet.",
      note: "Kick Day Flow is still in scaffold mode.",
      points: [],
      summary: {
        observedBuckets: 0,
        totalViewersObserved: 0,
        strongestWindow: null,
        strongestStreamer: null
      }
    })
  }

  try {
    const workerUrl = new URL(dayFlowUrl)
    for (const key of ["day", "date", "top", "mode", "bucket"]) {
      const value = requestUrl.searchParams.get(key)
      if (value) workerUrl.searchParams.set(key, value)
    }

    const response = await fetch(workerUrl.toString(), {
      headers: { accept: "application/json" },
      cache: "no-store"
    })

    if (!response.ok) {
      throw new Error(`kick collector day-flow returned ${response.status}`)
    }

    return toResponse((await response.json()) as WorkerPayload)
  } catch (error) {
    return toResponse({
      source: "api",
      platform: "kick",
      state: "error",
      lastUpdated: null,
      coverage: "Kick Day Flow bridge failed.",
      note: error instanceof Error ? error.message : "Unknown Kick collector day-flow bridge error",
      points: [],
      summary: {
        observedBuckets: 0,
        totalViewersObserved: 0,
        strongestWindow: null,
        strongestStreamer: null
      }
    })
  }
}
