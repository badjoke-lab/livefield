type CollectorStatusPayload = {
  source: "worker"
  platform: "kick"
  state: "unconfigured"
  collectorState: "not_wired"
  lastAttempt: null
  lastSuccess: null
  lastFailure: null
  lastError: null
  coverage: string
  note: string
  knownLimitations: string[]
}

type CollectorHeatmapPayload = {
  source: "worker"
  platform: "kick"
  state: "unconfigured"
  lastUpdated: null
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

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    ...init
  })
}

function getStatusPayload(): CollectorStatusPayload {
  return {
    source: "worker",
    platform: "kick",
    state: "unconfigured",
    collectorState: "not_wired",
    lastAttempt: null,
    lastSuccess: null,
    lastFailure: null,
    lastError: null,
    coverage: "Kick collector worker scaffold exists, but real collection is not wired yet.",
    note: "This worker currently exposes status only. No Kick provider, cron, D1 writes, or rollups are connected yet.",
    knownLimitations: [
      "No Kick provider is implemented yet.",
      "No cron trigger is configured yet.",
      "No D1 snapshot writes are configured yet.",
      "This worker is only a scaffold for future collector truth."
    ]
  }
}

function getHeatmapPayload(): CollectorHeatmapPayload {
  return {
    source: "worker",
    platform: "kick",
    state: "unconfigured",
    lastUpdated: null,
    coverage: "Kick heatmap worker scaffold exists, but real collection is not wired yet.",
    note: "This worker currently exposes a Heatmap scaffold only. No Kick provider, ranking ingest, or tile payload is connected yet.",
    nodes: [],
    summary: {
      activeStreams: 0,
      totalViewersObserved: 0,
      strongestMomentumStream: null,
      highestActivityStream: null
    }
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/status") {
      return json(getStatusPayload())
    }

    if (url.pathname === "/heatmap") {
      return json(getHeatmapPayload())
    }

    if (url.pathname === "/" || url.pathname === "") {
      return json({
        ok: true,
        service: "livefield-kick-collector",
        routes: ["/status", "/heatmap"]
      })
    }

    return json(
      {
        ok: false,
        error: "not_found",
        message: "Use /status or /heatmap for the current collector scaffold responses."
      },
      { status: 404 }
    )
  },

  async scheduled(): Promise<void> {
    // Kick cron collection is intentionally not wired yet.
  }
}
