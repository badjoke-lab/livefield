type KickDayFlowPayload = {
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

type EnvWithKickDayFlow = {
  KICK_COLLECTOR_DAY_FLOW_URL?: string
}

function scaffold(): KickDayFlowPayload {
  return {
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
  }
}

export const onRequestGet: PagesFunction<EnvWithKickDayFlow> = async (context) => {
  const dayFlowUrl = context.env.KICK_COLLECTOR_DAY_FLOW_URL?.trim()
  const requestUrl = new URL(context.request.url)

  if (!dayFlowUrl) {
    return new Response(JSON.stringify(scaffold()), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  }

  try {
    const workerUrl = new URL(dayFlowUrl)

    for (const key of ['day', 'date', 'top', 'mode', 'bucket']) {
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

    const payload = (await response.json()) as KickDayFlowPayload

    return new Response(JSON.stringify(payload), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  } catch (error) {
    const fallback = scaffold()
    fallback.state = "error"
    fallback.note = error instanceof Error ? error.message : "Unknown Kick collector day-flow bridge error"
    fallback.coverage = "Kick Day Flow scaffold bridge failed."

    return new Response(JSON.stringify(fallback), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  }
}
