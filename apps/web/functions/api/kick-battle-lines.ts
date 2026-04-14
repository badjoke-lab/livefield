type KickBattleLinesPayload = {
  source: "api" | "worker" | "demo"
  platform: "kick"
  state: "unconfigured" | "loading" | "live" | "partial" | "empty" | "error" | "complete"
  updatedAt?: string
  lastUpdated: string | null
  coverage: string
  note: string
  filters?: {
    day: "today" | "yesterday" | "date"
    date: string
    top: 3 | 5 | 10
    metric: "viewers" | "indexed"
    bucketMinutes: 1 | 5 | 10
    focus?: string
  }
  buckets: string[]
  lines: Array<{
    streamerId: string
    name: string
    color: string
    points: number[]
    viewerPoints: number[]
    peakViewers: number
    latestViewers: number
    risePerMin: number
    reversalCount: number
  }>
  focusStrip: Array<{
    streamerId: string
    name: string
  }>
  focusDetail?: {
    streamerId: string
    name: string
    peakViewers: number
    latestViewers: number
    biggestRiseTime: string
    reversalCount: number
  }
  events: Array<unknown>
  recommendation?: {
    primaryBattle: unknown | null
    secondaryBattles: unknown[]
    latestReversal: string
    fastestChallenger: string
    reversalStrip: unknown[]
  }
  pairs: Array<unknown>
  summary: {
    observedPairs?: number
    strongestPair?: string | null
    strongestReversalWindow?: string | null
    strongestPressureSide?: string | null
    leader?: string
    biggestRise?: string
    peakMoment?: string
    reversals?: number
    liveBattleNow?: string
    latestReversal?: string
    fastestChallenger?: string
    mostHeatedBattle?: string
  }
}

type EnvWithKickBattleLines = {
  KICK_COLLECTOR_BATTLE_LINES_URL?: string
}

function toTop(value: string | null): 3 | 5 | 10 {
  if (value === "3") return 3
  if (value === "10") return 10
  return 5
}

function toMetric(value: string | null): "viewers" | "indexed" {
  return value === "indexed" ? "indexed" : "viewers"
}

function toBucketMinutes(value: string | null): 1 | 5 | 10 {
  if (value === "1") return 1
  if (value === "10") return 10
  return 5
}

function readFilters(url: URL): NonNullable<KickBattleLinesPayload["filters"]> {
  const day = url.searchParams.get("day")
  const dayMode = day === "yesterday" || day === "date" ? day : "today"
  return {
    day: dayMode,
    date: url.searchParams.get("date") ?? "",
    top: toTop(url.searchParams.get("top")),
    metric: toMetric(url.searchParams.get("metric")),
    bucketMinutes: toBucketMinutes(url.searchParams.get("bucket")),
    focus: url.searchParams.get("focus") ?? "",
  }
}

function buildScaffold(filters: NonNullable<KickBattleLinesPayload["filters"]>): KickBattleLinesPayload {
  return {
    source: "api",
    platform: "kick",
    state: "unconfigured",
    updatedAt: new Date().toISOString(),
    lastUpdated: null,
    coverage: "Kick collector not wired yet.",
    note: "Kick Rivalry Radar is still in scaffold mode.",
    filters,
    buckets: [],
    lines: [],
    focusStrip: [],
    focusDetail: {
      streamerId: "",
      name: "N/A",
      peakViewers: 0,
      latestViewers: 0,
      biggestRiseTime: "N/A",
      reversalCount: 0,
    },
    events: [],
    recommendation: {
      primaryBattle: null,
      secondaryBattles: [],
      latestReversal: "No reversal yet",
      fastestChallenger: "N/A",
      reversalStrip: [],
    },
    pairs: [],
    summary: {
      observedPairs: 0,
      strongestPair: null,
      strongestReversalWindow: null,
      strongestPressureSide: null,
      leader: "No leader",
      biggestRise: "No rise",
      peakMoment: "N/A",
      reversals: 0,
      liveBattleNow: "No live battle",
      latestReversal: "No reversal yet",
      fastestChallenger: "N/A",
      mostHeatedBattle: "No heated battle",
    },
  }
}

export const onRequestGet: PagesFunction<EnvWithKickBattleLines> = async (context) => {
  const battleLinesUrl = context.env.KICK_COLLECTOR_BATTLE_LINES_URL?.trim()
  const requestUrl = new URL(context.request.url)
  const filters = readFilters(requestUrl)

  if (!battleLinesUrl) {
    return new Response(JSON.stringify(buildScaffold(filters)), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  }

  try {
    const workerUrl = new URL(battleLinesUrl)

    for (const key of ["day", "date", "top", "metric", "bucket", "focus"]) {
      const value = requestUrl.searchParams.get(key)
      if (value) workerUrl.searchParams.set(key, value)
    }

    const response = await fetch(workerUrl.toString(), {
      headers: { accept: "application/json" },
      cache: "no-store"
    })

    if (!response.ok) {
      throw new Error(`kick collector battle-lines returned ${response.status}`)
    }

    const payload = (await response.json()) as KickBattleLinesPayload
    if (!payload.filters) payload.filters = filters
    if (!payload.updatedAt) payload.updatedAt = payload.lastUpdated ?? new Date().toISOString()

    return new Response(JSON.stringify(payload), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  } catch (error) {
    const fallback = buildScaffold(filters)
    fallback.state = "error"
    fallback.note = error instanceof Error ? error.message : "Unknown Kick collector battle-lines bridge error"
    fallback.coverage = "Kick Rivalry Radar proxy failed."

    return new Response(JSON.stringify(fallback), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  }
}
