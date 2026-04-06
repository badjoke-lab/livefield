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

type CollectorDayFlowPayload = {
  source: "worker"
  platform: "kick"
  state: "unconfigured"
  lastUpdated: null
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

type CollectorBattleLinesPayload = {
  source: "worker"
  platform: "kick"
  state: "unconfigured"
  lastUpdated: null
  coverage: string
  note: string
  pairs: Array<unknown>
  summary: {
    observedPairs: number
    strongestPair: string | null
    strongestReversalWindow: string | null
    strongestPressureSide: string | null
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

function getDayFlowPayload(): CollectorDayFlowPayload {
  return {
    source: "worker",
    platform: "kick",
    state: "unconfigured",
    lastUpdated: null,
    coverage: "Kick day-flow worker scaffold exists, but real collection is not wired yet.",
    note: "This worker currently exposes a Day Flow scaffold only. No Kick provider, bucket rollups, or ownership windows are connected yet.",
    points: [],
    summary: {
      observedBuckets: 0,
      totalViewersObserved: 0,
      strongestWindow: null,
      strongestStreamer: null
    }
  }
}

function getBattleLinesPayload(): CollectorBattleLinesPayload {
  return {
    source: "worker",
    platform: "kick",
    state: "unconfigured",
    lastUpdated: null,
    coverage: "Kick rivalry worker scaffold exists, but real collection is not wired yet.",
    note: "This worker currently exposes a Rivalry Radar scaffold only. No Kick pair scoring, reversal windows, or pressure metrics are connected yet.",
    pairs: [],
    summary: {
      observedPairs: 0,
      strongestPair: null,
      strongestReversalWindow: null,
      strongestPressureSide: null
    }
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/status") return json(getStatusPayload())
    if (url.pathname === "/heatmap") return json(getHeatmapPayload())
    if (url.pathname === "/day-flow") return json(getDayFlowPayload())
    if (url.pathname === "/battle-lines") return json(getBattleLinesPayload())

    if (url.pathname === "/" || url.pathname === "") {
      return json({
        ok: true,
        service: "livefield-kick-collector",
        routes: ["/status", "/heatmap", "/day-flow", "/battle-lines"]
      })
    }

    return json(
      {
        ok: false,
        error: "not_found",
        message: "Use /status, /heatmap, /day-flow, or /battle-lines for the current collector scaffold responses."
      },
      { status: 404 }
    )
  },

  async scheduled(): Promise<void> {
    // Kick cron collection is intentionally not wired yet.
  }
}
