export type KickBattleLinesPayload = {
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

export async function getKickBattleLinesScaffoldPayload(options?: {
  day?: "today" | "yesterday" | "date"
  date?: string
  top?: 3 | 5 | 10
  metric?: "viewers" | "indexed"
  bucketMinutes?: 1 | 5 | 10
  focus?: string
  signal?: AbortSignal
}): Promise<KickBattleLinesPayload> {
  const params = new URLSearchParams()

  if (options?.day) params.set("day", options.day)
  if (options?.day === "date" && options?.date) params.set("date", options.date)
  if (options?.top) params.set("top", String(options.top))
  if (options?.metric) params.set("metric", options.metric)
  if (options?.bucketMinutes) params.set("bucket", String(options.bucketMinutes))
  if (options?.focus) params.set("focus", options.focus)

  const url = params.size > 0
    ? `/api/kick-battle-lines?${params.toString()}`
    : "/api/kick-battle-lines"

  const init: RequestInit = {
    headers: { accept: "application/json" },
    cache: "no-store"
  }

  const maybeSignal = options?.signal as unknown
  if (
    maybeSignal &&
    typeof maybeSignal === "object" &&
    "aborted" in (maybeSignal as object) &&
    "addEventListener" in (maybeSignal as object)
  ) {
    init.signal = maybeSignal as AbortSignal
  }

  const response = await fetch(url, init)

  if (!response.ok) {
    throw new Error(`kick battle-lines api returned ${response.status}`)
  }

  return (await response.json()) as KickBattleLinesPayload
}
