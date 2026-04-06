type KickHeatmapPayload = {
  source: "api" | "worker"
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

type EnvWithKickHeatmap = {
  KICK_COLLECTOR_HEATMAP_URL?: string
}

function scaffold(): KickHeatmapPayload {
  return {
    source: "api",
    platform: "kick",
    state: "unconfigured",
    lastUpdated: null,
    coverage: "Kick collector not wired yet.",
    note: "Kick Heatmap is still in scaffold mode.",
    nodes: [],
    summary: {
      activeStreams: 0,
      totalViewersObserved: 0,
      strongestMomentumStream: null,
      highestActivityStream: null
    }
  }
}

export const onRequestGet: PagesFunction<EnvWithKickHeatmap> = async (context) => {
  const heatmapUrl = context.env.KICK_COLLECTOR_HEATMAP_URL?.trim()

  if (!heatmapUrl) {
    return new Response(JSON.stringify(scaffold()), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  }

  try {
    const response = await fetch(heatmapUrl, {
      headers: { accept: "application/json" },
      cache: "no-store"
    })

    if (!response.ok) {
      throw new Error(`kick collector heatmap returned ${response.status}`)
    }

    const payload = (await response.json()) as KickHeatmapPayload

    return new Response(JSON.stringify(payload), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  } catch (error) {
    const fallback = scaffold()
    fallback.state = "error"
    fallback.note = error instanceof Error ? error.message : "Unknown Kick collector heatmap bridge error"
    fallback.coverage = "Kick Heatmap scaffold bridge failed."

    return new Response(JSON.stringify(fallback), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  }
}
