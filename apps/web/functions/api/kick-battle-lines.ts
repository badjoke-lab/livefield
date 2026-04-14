type WorkerPairLabel = "neck_and_neck" | "closing_fast" | "reversal_watch" | "clear_lead"

type WorkerPair = {
  leftSlug: string
  rightSlug: string
  leftViewers: number
  rightViewers: number
  viewerGap: number
  previousGap: number | null
  swing: number | null
  label: WorkerPairLabel
}

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
  pairs: WorkerPair[]
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

const COLORS = [
  "#8ec5ff",
  "#c7a6ff",
  "#7ee0b5",
  "#ffd27a",
  "#ff9ab3",
  "#9be7ff",
  "#b8f27c",
  "#ffb86b",
  "#d6bcff",
  "#95f0d8",
] as const

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

function tryParseDate(value: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function buildBuckets(lastUpdated: string | null, bucketMinutes: number): string[] {
  const current = tryParseDate(lastUpdated) ?? new Date()
  const previous = new Date(current.getTime() - bucketMinutes * 60_000)
  return [previous.toISOString(), current.toISOString()]
}

function tagFromLabel(label: WorkerPairLabel): "closing" | "recent-reversal" | "rising-challenger" | "heated" {
  if (label === "reversal_watch") return "recent-reversal"
  if (label === "closing_fast") return "rising-challenger"
  return "closing"
}

function gapTrendFromPair(pair: WorkerPair): "closing" | "widening" | "flat" {
  if (pair.previousGap === null) return "flat"
  if (Math.abs(pair.viewerGap) < Math.abs(pair.previousGap)) return "closing"
  if (Math.abs(pair.viewerGap) > Math.abs(pair.previousGap)) return "widening"
  return "flat"
}

function buildLinesAndUi(
  raw: KickBattleLinesPayload,
  filters: NonNullable<KickBattleLinesPayload["filters"]>
) {
  const orderedIds: string[] = []
  const viewerMap = new Map<string, number>()
  const reversalCountMap = new Map<string, number>()

  for (const pair of raw.pairs ?? []) {
    if (!viewerMap.has(pair.leftSlug)) orderedIds.push(pair.leftSlug)
    if (!viewerMap.has(pair.rightSlug)) orderedIds.push(pair.rightSlug)

    viewerMap.set(pair.leftSlug, pair.leftViewers)
    viewerMap.set(pair.rightSlug, pair.rightViewers)

    if (pair.label === "reversal_watch") {
      reversalCountMap.set(pair.leftSlug, (reversalCountMap.get(pair.leftSlug) ?? 0) + 1)
      reversalCountMap.set(pair.rightSlug, (reversalCountMap.get(pair.rightSlug) ?? 0) + 1)
    }
  }

  const visibleIds = orderedIds.slice(0, filters.top)
  const buckets = buildBuckets(raw.lastUpdated, filters.bucketMinutes)

  const lines = visibleIds.map((id, index) => {
    const viewers = viewerMap.get(id) ?? 0
    const reversalCount = reversalCountMap.get(id) ?? 0
    return {
      streamerId: id,
      name: id,
      color: COLORS[index % COLORS.length],
      points: [viewers, viewers],
      viewerPoints: [viewers, viewers],
      peakViewers: viewers,
      latestViewers: viewers,
      risePerMin: 0,
      reversalCount,
    }
  })

  const focusStrip = lines.map((line) => ({
    streamerId: line.streamerId,
    name: line.name,
  }))

  const focusId =
    (filters.focus && lines.some((line) => line.streamerId === filters.focus) ? filters.focus : "") ||
    lines[0]?.streamerId ||
    ""

  const focusLine =
    lines.find((line) => line.streamerId === focusId) ??
    lines[0] ?? {
      streamerId: "",
      name: "N/A",
      peakViewers: 0,
      latestViewers: 0,
      reversalCount: 0,
    }

  const focusDetail = {
    streamerId: focusLine.streamerId,
    name: focusLine.name,
    peakViewers: focusLine.peakViewers,
    latestViewers: focusLine.latestViewers,
    biggestRiseTime: raw.lastUpdated ?? "N/A",
    reversalCount: focusLine.reversalCount,
  }

  const primaryPair =
    (raw.summary.strongestPair
      ? (raw.pairs ?? []).find((pair) => `${pair.leftSlug} vs ${pair.rightSlug}` === raw.summary.strongestPair)
      : null) ?? (raw.pairs ?? [])[0] ?? null

  function candidateFromPair(pair: WorkerPair | null, scoreBias = 0) {
    if (!pair) return null
    const gap = Math.abs(pair.viewerGap)
    return {
      key: `${pair.leftSlug}::${pair.rightSlug}`,
      leftId: pair.leftSlug,
      rightId: pair.rightSlug,
      leftName: pair.leftSlug,
      rightName: pair.rightSlug,
      score: Math.max(0, 100000 - gap) + scoreBias,
      gap,
      gapTrend: gapTrendFromPair(pair),
      lastReversalAt: pair.label === "reversal_watch" ? (raw.summary.strongestReversalWindow ?? raw.lastUpdated ?? null) : null,
      tag: tagFromLabel(pair.label),
      currentGapLabel: `${gap} gap`,
    }
  }

  const primaryBattle = candidateFromPair(primaryPair, 1000)
  const secondaryBattles = (raw.pairs ?? [])
    .filter((pair) => !primaryPair || `${pair.leftSlug}::${pair.rightSlug}` !== `${primaryPair.leftSlug}::${primaryPair.rightSlug}`)
    .slice(0, 2)
    .map((pair, idx) => candidateFromPair(pair, 100 - idx))
    .filter((value): value is NonNullable<typeof value> => value !== null)

  const reversalStrip = (raw.pairs ?? [])
    .filter((pair) => pair.label === "reversal_watch")
    .slice(0, 3)
    .map((pair) => ({
      timestamp: raw.summary.strongestReversalWindow ?? raw.lastUpdated ?? "N/A",
      label: `${pair.leftSlug} vs ${pair.rightSlug}`,
      passer: pair.viewerGap >= 0 ? pair.leftSlug : pair.rightSlug,
      passed: pair.viewerGap >= 0 ? pair.rightSlug : pair.leftSlug,
      gapBefore: Math.abs(pair.previousGap ?? pair.viewerGap),
      gapAfter: Math.abs(pair.viewerGap),
      heatOverlap: false,
    }))

  const leader = lines[0]?.name ?? "No leader"
  const reversalCount = (raw.pairs ?? []).filter((pair) => pair.label === "reversal_watch").length

  return {
    buckets,
    lines,
    focusStrip,
    focusDetail,
    recommendation: {
      primaryBattle,
      secondaryBattles,
      latestReversal: raw.summary.strongestReversalWindow ?? "No reversal yet",
      fastestChallenger: raw.summary.strongestPressureSide ?? "N/A",
      reversalStrip,
    },
    summary: {
      observedPairs: raw.summary.observedPairs ?? (raw.pairs?.length ?? 0),
      strongestPair: raw.summary.strongestPair ?? null,
      strongestReversalWindow: raw.summary.strongestReversalWindow ?? null,
      strongestPressureSide: raw.summary.strongestPressureSide ?? null,
      leader,
      biggestRise: raw.summary.strongestPressureSide ?? "No rise",
      peakMoment: raw.lastUpdated ?? "N/A",
      reversals: reversalCount,
      liveBattleNow: raw.summary.strongestPair ?? "No live battle",
      latestReversal: raw.summary.strongestReversalWindow ?? "No reversal yet",
      fastestChallenger: raw.summary.strongestPressureSide ?? "N/A",
      mostHeatedBattle: raw.summary.strongestPair ?? "No heated battle",
    },
  }
}

function bridgePayload(
  workerPayload: KickBattleLinesPayload,
  filters: NonNullable<KickBattleLinesPayload["filters"]>
): KickBattleLinesPayload {
  const bridged = buildScaffold(filters)
  bridged.source = "api"
  bridged.platform = "kick"
  bridged.state = workerPayload.state
  bridged.updatedAt = workerPayload.lastUpdated ?? new Date().toISOString()
  bridged.lastUpdated = workerPayload.lastUpdated
  bridged.coverage = workerPayload.coverage
  bridged.note = workerPayload.note
  bridged.pairs = workerPayload.pairs ?? []
  bridged.filters = filters

  const derived = buildLinesAndUi(workerPayload, filters)
  bridged.buckets = derived.buckets
  bridged.lines = derived.lines
  bridged.focusStrip = derived.focusStrip
  bridged.focusDetail = derived.focusDetail
  bridged.events = []
  bridged.recommendation = derived.recommendation
  bridged.summary = derived.summary

  if (!bridged.lines.length && (workerPayload.state === "live" || workerPayload.state === "partial")) {
    bridged.state = "empty"
  }

  return bridged
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

    const workerPayload = (await response.json()) as KickBattleLinesPayload
    const bridged = bridgePayload(workerPayload, filters)

    return new Response(JSON.stringify(bridged), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  } catch (error) {
    const fallback = buildScaffold(filters)
    fallback.state = "error"
    fallback.note = error instanceof Error ? error.message : "Unknown Kick collector battle-lines bridge error"
    fallback.coverage = "Kick Rivalry Radar scaffold bridge failed."

    return new Response(JSON.stringify(fallback), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  }
}
