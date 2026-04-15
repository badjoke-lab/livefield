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
  events: Array<{
    type: "peak" | "rise" | "reversal"
    bucket: string
    label: string
    streamerId: string
    rivalId?: string
  }>
  recommendation?: {
    primaryBattle: {
      key: string
      leftId: string
      rightId: string
      leftName: string
      rightName: string
      score: number
      gap: number
      gapTrend: "closing" | "widening" | "flat"
      lastReversalAt: string | null
      tag: "closing" | "recent-reversal" | "rising-challenger" | "heated"
      currentGapLabel: string
    } | null
    secondaryBattles: Array<{
      key: string
      leftId: string
      rightId: string
      leftName: string
      rightName: string
      score: number
      gap: number
      gapTrend: "closing" | "widening" | "flat"
      lastReversalAt: string | null
      tag: "closing" | "recent-reversal" | "rising-challenger" | "heated"
      currentGapLabel: string
    }>
    latestReversal: string
    fastestChallenger: string
    reversalStrip: Array<{
      timestamp: string
      label: string
      passer: string
      passed: string
      gapBefore: number
      gapAfter: number
      heatOverlap: boolean
    }>
  }
  pairs: Array<{
    leftSlug: string
    rightSlug: string
    leftViewers: number
    rightViewers: number
    viewerGap: number
    previousGap: number | null
    swing: number | null
    label: "neck_and_neck" | "closing_fast" | "reversal_watch" | "clear_lead"
  }>
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

type Env = {
  DB?: D1Database
}

type RunRow = {
  id: number | string
  created_at: string
  state: string
  coverage_note: string | null
  observed_count: number | string | null
}

type SnapshotRow = {
  run_id: number | string
  slug: string | null
  stream_title: string | null
  viewer_count: number | string | null
}

type BattleFilters = NonNullable<KickBattleLinesPayload["filters"]>
type BattleGapTrend = "closing" | "widening" | "flat"
type BattleCandidateTag = "closing" | "recent-reversal" | "rising-challenger" | "heated"
type BattleLine = KickBattleLinesPayload["lines"][number]

type ReversalRecord = {
  key: string
  leftId: string
  rightId: string
  leftName: string
  rightName: string
  timestamp: string
  passerId: string
  passerName: string
  passedId: string
  passedName: string
  gapBefore: number
  gapAfter: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const BATTLE_COLORS = ["#8ec5ff", "#c7a6ff", "#7ee0b5", "#ffd27a", "#ff9ab3", "#9be7ff", "#b8f27c", "#ffb86b", "#d6bcff", "#95f0d8"] as const
const battleNumberFmt = new Intl.NumberFormat("en-US")

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

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function toIsoMinute(date: Date): string {
  return `${date.toISOString().slice(0, 16)}:00.000Z`
}

function toDbSecond(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ")
}

function normalizeDbTimestamp(value: string | null): string | null {
  if (!value) return null
  if (value.includes("T")) return value.endsWith("Z") ? value : `${value}Z`
  return `${value.replace(" ", "T")}Z`
}

function floorToBucket(iso: string, minutes: 1 | 5 | 10): string {
  const d = new Date(iso)
  d.setUTCSeconds(0, 0)
  d.setUTCMinutes(d.getUTCMinutes() - (d.getUTCMinutes() % minutes))
  return toIsoMinute(d)
}

function isoMinuteLabel(iso: string): string {
  return iso.slice(11, 16)
}

function parseMinute(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function readFilters(url: URL): BattleFilters {
  const now = new Date()
  const rawDay = url.searchParams.get("day")
  const rawDate = url.searchParams.get("date")
  let day: "today" | "yesterday" | "date" = "today"
  let date = startOfUtcDay(now).toISOString().slice(0, 10)

  if (rawDay === "yesterday") {
    day = "yesterday"
    date = new Date(startOfUtcDay(now).getTime() - DAY_MS).toISOString().slice(0, 10)
  } else if (rawDay === "date" && rawDate) {
    const parsed = new Date(`${rawDate}T00:00:00.000Z`)
    if (!Number.isNaN(parsed.getTime())) {
      day = "date"
      date = startOfUtcDay(parsed).toISOString().slice(0, 10)
    }
  }

  return {
    day,
    date,
    top: toTop(url.searchParams.get("top")),
    metric: toMetric(url.searchParams.get("metric")),
    bucketMinutes: toBucketMinutes(url.searchParams.get("bucket")),
    focus: url.searchParams.get("focus") ?? "",
  }
}

function buildScaffold(
  filters: BattleFilters,
  state: KickBattleLinesPayload["state"],
  coverage: string,
  note: string,
  lastUpdated: string | null,
): KickBattleLinesPayload {
  return {
    source: "api",
    platform: "kick",
    state,
    updatedAt: lastUpdated ?? undefined,
    lastUpdated,
    coverage,
    note,
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

async function fetchUsableRunsInRange(db: D1Database, startDb: string, endDb: string): Promise<RunRow[]> {
  const result = await db.prepare(`
    SELECT
      kr.id,
      kr.created_at,
      kr.state,
      kr.coverage_note,
      kr.observed_count
    FROM kick_runs kr
    WHERE kr.state != 'error'
      AND COALESCE(kr.observed_count, 0) > 0
      AND kr.created_at >= ?
      AND kr.created_at <= ?
      AND EXISTS (
        SELECT 1
        FROM kick_livestream_snapshots kls
        WHERE kls.run_id = kr.id
          AND kls.slug IS NOT NULL
          AND TRIM(kls.slug) != ''
      )
    ORDER BY kr.created_at ASC, kr.id ASC
  `).bind(startDb, endDb).all()

  return Array.isArray(result.results) ? result.results as unknown as RunRow[] : []
}

async function fetchSnapshotsForRunIds(db: D1Database, runIds: number[]): Promise<Map<number, Map<string, { viewers: number; title: string }>>> {
  const out = new Map<number, Map<string, { viewers: number; title: string }>>()
  if (!runIds.length) return out

  const chunkSize = 200
  for (let start = 0; start < runIds.length; start += chunkSize) {
    const chunk = runIds.slice(start, start + chunkSize)
    const placeholders = chunk.map(() => "?").join(",")
    const result = await db.prepare(`
      SELECT run_id, slug, stream_title, viewer_count
      FROM kick_livestream_snapshots
      WHERE run_id IN (${placeholders})
      ORDER BY run_id ASC, viewer_count DESC, id ASC
    `).bind(...chunk).all()

    const rows = Array.isArray(result.results) ? result.results as unknown as SnapshotRow[] : []
    for (const row of rows) {
      const runId = typeof row.run_id === "number" ? row.run_id : Number(row.run_id ?? 0)
      const slug = typeof row.slug === "string" ? row.slug : null
      if (!Number.isFinite(runId) || !slug) continue
      let runMap = out.get(runId)
      if (!runMap) {
        runMap = new Map<string, { viewers: number; title: string }>()
        out.set(runId, runMap)
      }
      runMap.set(slug, {
        viewers: typeof row.viewer_count === "number" ? row.viewer_count : Number(row.viewer_count ?? 0),
        title: typeof row.stream_title === "string" && row.stream_title.trim() ? row.stream_title : slug,
      })
    }
  }

  return out
}

function classifyPair(currentGap: number, previousGap: number | null): "neck_and_neck" | "closing_fast" | "reversal_watch" | "clear_lead" {
  const absGap = Math.abs(currentGap)
  if (previousGap !== null && currentGap !== 0 && previousGap !== 0 && Math.sign(currentGap) !== Math.sign(previousGap)) {
    return "reversal_watch"
  }
  if (absGap <= 500) return "neck_and_neck"
  if (previousGap !== null && Math.abs(previousGap) - absGap >= 500) return "closing_fast"
  return "clear_lead"
}

function buildPairKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join("|")
}

function formatGap(value: number): string {
  return `${battleNumberFmt.format(Math.max(0, Math.round(value)))} gap`
}

function gapTrendFrom(previousGap: number, latestGap: number): BattleGapTrend {
  if (latestGap < previousGap) return "closing"
  if (latestGap > previousGap) return "widening"
  return "flat"
}

function pickBattleTag(args: {
  latestGap: number
  latestReversalAt: string | null
  gapTrend: BattleGapTrend
  combinedRise: number
}): BattleCandidateTag {
  if (args.latestReversalAt) return "recent-reversal"
  if (args.latestGap <= 150 && args.combinedRise > 0) return "heated"
  if (args.gapTrend === "closing") return "closing"
  return "rising-challenger"
}

function buildBuckets(filters: BattleFilters, lastObservedIso: string | null): string[] {
  const start = new Date(`${filters.date}T00:00:00.000Z`)
  const out: string[] = []

  if (filters.day === "today") {
    const endIso = lastObservedIso ?? new Date().toISOString()
    const end = new Date(floorToBucket(endIso, filters.bucketMinutes))
    if (Number.isNaN(end.getTime()) || end.getTime() < start.getTime()) return []
    for (let ts = start.getTime(); ts <= end.getTime(); ts += filters.bucketMinutes * 60_000) {
      out.push(toIsoMinute(new Date(ts)))
    }
    return out
  }

  const endExclusive = new Date(start.getTime() + DAY_MS)
  for (let ts = start.getTime(); ts < endExclusive.getTime(); ts += filters.bucketMinutes * 60_000) {
    out.push(toIsoMinute(new Date(ts)))
  }
  return out
}

function buildReversalRecords(lines: BattleLine[], buckets: string[]): ReversalRecord[] {
  const records: ReversalRecord[] = []
  for (let left = 0; left < lines.length; left += 1) {
    for (let right = left + 1; right < lines.length; right += 1) {
      const a = lines[left]
      const b = lines[right]
      const key = buildPairKey(a.streamerId, b.streamerId)
      for (let idx = 1; idx < buckets.length; idx += 1) {
        const prevLeft = a.viewerPoints[idx - 1] ?? 0
        const prevRight = b.viewerPoints[idx - 1] ?? 0
        const nextLeft = a.viewerPoints[idx] ?? 0
        const nextRight = b.viewerPoints[idx] ?? 0
        const prevDelta = prevLeft - prevRight
        const nextDelta = nextLeft - nextRight
        if (prevDelta === 0 || nextDelta === 0) continue
        if (!((prevDelta > 0 && nextDelta < 0) || (prevDelta < 0 && nextDelta > 0))) continue
        const passerIsLeft = nextLeft > nextRight
        records.push({
          key,
          leftId: a.streamerId,
          rightId: b.streamerId,
          leftName: a.name,
          rightName: b.name,
          timestamp: buckets[idx] ?? buckets[0] ?? new Date().toISOString(),
          passerId: passerIsLeft ? a.streamerId : b.streamerId,
          passerName: passerIsLeft ? a.name : b.name,
          passedId: passerIsLeft ? b.streamerId : a.streamerId,
          passedName: passerIsLeft ? b.name : a.name,
          gapBefore: Math.abs(prevDelta),
          gapAfter: Math.abs(nextDelta),
        })
      }
    }
  }
  return records.sort((a, b) => parseMinute(b.timestamp) - parseMinute(a.timestamp))
}

function buildEvents(lines: BattleLine[], buckets: string[], reversalRecords: ReversalRecord[]): KickBattleLinesPayload["events"] {
  const events: KickBattleLinesPayload["events"] = []
  for (const line of lines) {
    if (!line.viewerPoints.length) continue
    let peakIdx = 0
    let riseIdx = 0
    let bestRise = Number.NEGATIVE_INFINITY
    for (let idx = 0; idx < line.viewerPoints.length; idx += 1) {
      if ((line.viewerPoints[idx] ?? 0) > (line.viewerPoints[peakIdx] ?? 0)) peakIdx = idx
      if (idx > 0) {
        const rise = (line.viewerPoints[idx] ?? 0) - (line.viewerPoints[idx - 1] ?? 0)
        if (rise > bestRise) {
          bestRise = rise
          riseIdx = idx
        }
      }
    }
    events.push({
      type: "peak",
      bucket: buckets[peakIdx] ?? buckets[0] ?? new Date().toISOString(),
      label: `${line.name} peak`,
      streamerId: line.streamerId,
    })
    events.push({
      type: "rise",
      bucket: buckets[riseIdx] ?? buckets[0] ?? new Date().toISOString(),
      label: `${line.name} rise`,
      streamerId: line.streamerId,
    })
  }
  for (const record of reversalRecords) {
    events.push({
      type: "reversal",
      bucket: record.timestamp,
      label: `${record.passerName} passed ${record.passedName}`,
      streamerId: record.passerId,
      rivalId: record.passedId,
    })
  }
  return events.sort((a, b) => parseMinute(b.bucket) - parseMinute(a.bucket))
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const requestUrl = new URL(context.request.url)
  const filters = readFilters(requestUrl)
  const db = context.env.DB

  if (!db) {
    return new Response(JSON.stringify(buildScaffold(
      filters,
      "unconfigured",
      "Kick D1 binding is not available.",
      "Kick Battle Lines DB binding is missing.",
      null,
    )), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    })
  }

  const dayStart = new Date(`${filters.date}T00:00:00.000Z`)
  const dayEndExclusive = new Date(dayStart.getTime() + DAY_MS)
  const queryStartDb = toDbSecond(dayStart)
  const queryEndDb = filters.day === "today"
    ? toDbSecond(new Date())
    : toDbSecond(new Date(dayEndExclusive.getTime() - 1000))

  const usableRuns = await fetchUsableRunsInRange(db, queryStartDb, queryEndDb)
  if (!usableRuns.length) {
    return new Response(JSON.stringify(buildScaffold(
      filters,
      filters.day === "today" ? "partial" : "empty",
      "No usable Kick runs matched the selected range.",
      "No non-empty observed windows are available for the selected date.",
      null,
    )), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    })
  }

  const bucketToRun = new Map<string, RunRow>()
  for (const run of usableRuns) {
    const createdIso = normalizeDbTimestamp(run.created_at)
    if (!createdIso) continue
    bucketToRun.set(floorToBucket(createdIso, filters.bucketMinutes), run)
  }

  const latestObservedBucket = [...bucketToRun.keys()].sort().at(-1) ?? null
  const buckets = buildBuckets(filters, latestObservedBucket)
  if (!buckets.length) {
    return new Response(JSON.stringify(buildScaffold(
      filters,
      filters.day === "today" ? "partial" : "empty",
      "No bucketed Kick rivalry history is available.",
      "No bucketed Kick rivalry history is available for the selected range.",
      null,
    )), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    })
  }

  const selectedRunIds = Array.from(new Set(
    buckets
      .map((bucket) => bucketToRun.get(bucket))
      .filter((run): run is RunRow => Boolean(run))
      .map((run) => Number(run.id))
      .filter((id) => Number.isFinite(id))
  ))

  const snapshotsByRun = await fetchSnapshotsForRunIds(db, selectedRunIds)
  const totalsBySlug = new Map<string, number>()
  for (const bucket of buckets) {
    const run = bucketToRun.get(bucket)
    const runId = Number(run?.id)
    if (!Number.isFinite(runId)) continue
    const snapshot = snapshotsByRun.get(runId)
    if (!snapshot) continue
    for (const [slug, item] of snapshot.entries()) {
      totalsBySlug.set(slug, (totalsBySlug.get(slug) ?? 0) + item.viewers * filters.bucketMinutes)
    }
  }

  const rankedSlugs = [...totalsBySlug.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([slug]) => slug)
    .slice(0, filters.top)

  if (!rankedSlugs.length) {
    return new Response(JSON.stringify(buildScaffold(
      filters,
      filters.day === "today" ? "partial" : "empty",
      "Kick rivalry ranking produced no qualifying streams.",
      "No qualifying visible streams were available after ranking.",
      null,
    )), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    })
  }

  const viewerPointsBySlug = new Map<string, number[]>()
  const bucketHasRun = buckets.map((bucket) => bucketToRun.has(bucket))
  for (const slug of rankedSlugs) viewerPointsBySlug.set(slug, new Array<number>(buckets.length).fill(0))

  let lastUpdated: string | null = null
  let latestCoverage = "Kick rivalry radar is built from stored top-viewer snapshot history."

  for (let bucketIndex = 0; bucketIndex < buckets.length; bucketIndex += 1) {
    const bucket = buckets[bucketIndex]
    const run = bucketToRun.get(bucket)
    const runId = Number(run?.id)
    if (!Number.isFinite(runId)) continue

    if (bucketIndex === buckets.length - 1) {
      lastUpdated = normalizeDbTimestamp(typeof run?.created_at === "string" ? run.created_at : null)
      latestCoverage = typeof run?.coverage_note === "string" && run.coverage_note.trim()
        ? run.coverage_note
        : latestCoverage
    }

    const snapshot = snapshotsByRun.get(runId)
    if (!snapshot) continue
    for (const slug of rankedSlugs) {
      const entry = snapshot.get(slug)
      if (!entry) continue
      const series = viewerPointsBySlug.get(slug)
      if (!series) continue
      series[bucketIndex] = entry.viewers
    }
  }

  const lines: BattleLine[] = rankedSlugs.map((slug, index) => {
    const viewerPoints = [...(viewerPointsBySlug.get(slug) ?? new Array<number>(buckets.length).fill(0))]
    const displayPoints = viewerPoints.map((value, idx) => {
      if (!bucketHasRun[idx] && value === 0) return null
      return value
    })

    const peakViewers = viewerPoints.reduce((best, value) => Math.max(best, value), 0)
    let risePerMin = 0
    for (let idx = 1; idx < viewerPoints.length; idx += 1) {
      risePerMin = Math.max(risePerMin, (viewerPoints[idx] - viewerPoints[idx - 1]) / filters.bucketMinutes)
    }

    const latestViewers = (() => {
      for (let idx = viewerPoints.length - 1; idx >= 0; idx -= 1) {
        if ((viewerPoints[idx] ?? 0) > 0) return viewerPoints[idx]
      }
      return viewerPoints[viewerPoints.length - 1] ?? 0
    })()

    const points = filters.metric === "indexed"
      ? (peakViewers > 0
          ? displayPoints.map((value) => (typeof value === "number" ? Math.round((value / peakViewers) * 1000) / 10 : null))
          : displayPoints.map((value) => (typeof value === "number" ? 0 : null)))
      : [...displayPoints]

    return {
      streamerId: slug,
      name: slug,
      color: BATTLE_COLORS[index % BATTLE_COLORS.length],
      points: points as unknown as number[],
      viewerPoints,
      peakViewers,
      latestViewers,
      risePerMin,
      reversalCount: 0,
    }
  })

  const reversalRecords = buildReversalRecords(lines, buckets)
  const reversalCountById = new Map<string, number>()
  for (const record of reversalRecords) {
    reversalCountById.set(record.leftId, (reversalCountById.get(record.leftId) ?? 0) + 1)
    reversalCountById.set(record.rightId, (reversalCountById.get(record.rightId) ?? 0) + 1)
  }
  for (const line of lines) {
    line.reversalCount = reversalCountById.get(line.streamerId) ?? 0
  }

  const pairCandidates: Array<{
    key: string
    leftId: string
    rightId: string
    leftName: string
    rightName: string
    score: number
    gap: number
    gapTrend: BattleGapTrend
    lastReversalAt: string | null
    tag: BattleCandidateTag
    currentGapLabel: string
    pair: KickBattleLinesPayload["pairs"][number]
  }> = []

  for (let left = 0; left < lines.length; left += 1) {
    for (let right = left + 1; right < lines.length; right += 1) {
      const a = lines[left]
      const b = lines[right]
      const latestGapSigned = (a.latestViewers ?? 0) - (b.latestViewers ?? 0)
      const prevA = a.viewerPoints.length >= 2 ? a.viewerPoints[a.viewerPoints.length - 2] ?? a.latestViewers : a.latestViewers
      const prevB = b.viewerPoints.length >= 2 ? b.viewerPoints[b.viewerPoints.length - 2] ?? b.latestViewers : b.latestViewers
      const previousGapSigned = prevA - prevB
      const latestGap = Math.abs(latestGapSigned)
      const previousGap = Math.abs(previousGapSigned)
      const label = classifyPair(latestGapSigned, previousGapSigned)
      const reversal = reversalRecords.find((record) => record.key === buildPairKey(a.streamerId, b.streamerId)) ?? null
      const gapTrend = gapTrendFrom(previousGap, latestGap)
      const combinedRise = Math.max(0, a.risePerMin) + Math.max(0, b.risePerMin)
      const score =
        Math.max(0, 3000 - latestGap * 6) +
        (reversal ? 1800 : 0) +
        Math.max(0, combinedRise) * 6 +
        (label === "reversal_watch" ? 1000 : 0) +
        (label === "closing_fast" ? 500 : 0)

      pairCandidates.push({
        key: `${a.streamerId}::${b.streamerId}`,
        leftId: a.streamerId,
        rightId: b.streamerId,
        leftName: a.name,
        rightName: b.name,
        score,
        gap: latestGap,
        gapTrend,
        lastReversalAt: reversal?.timestamp ?? null,
        tag: pickBattleTag({
          latestGap,
          latestReversalAt: reversal?.timestamp ?? null,
          gapTrend,
          combinedRise,
        }),
        currentGapLabel: formatGap(latestGap),
        pair: {
          leftSlug: a.streamerId,
          rightSlug: b.streamerId,
          leftViewers: a.latestViewers,
          rightViewers: b.latestViewers,
          viewerGap: latestGapSigned,
          previousGap: previousGapSigned,
          swing: latestGapSigned - previousGapSigned,
          label,
        },
      })
    }
  }

  pairCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.gap !== b.gap) return a.gap - b.gap
    return a.key.localeCompare(b.key)
  })

  const pairs = pairCandidates.slice(0, 10).map((item) => item.pair)
  const primaryBattle = pairCandidates[0] ? {
    key: pairCandidates[0].key,
    leftId: pairCandidates[0].leftId,
    rightId: pairCandidates[0].rightId,
    leftName: pairCandidates[0].leftName,
    rightName: pairCandidates[0].rightName,
    score: pairCandidates[0].score,
    gap: pairCandidates[0].gap,
    gapTrend: pairCandidates[0].gapTrend,
    lastReversalAt: pairCandidates[0].lastReversalAt,
    tag: pairCandidates[0].tag,
    currentGapLabel: pairCandidates[0].currentGapLabel,
  } : null

  const secondaryBattles = pairCandidates.slice(1, 4).map((item) => ({
    key: item.key,
    leftId: item.leftId,
    rightId: item.rightId,
    leftName: item.leftName,
    rightName: item.rightName,
    score: item.score,
    gap: item.gap,
    gapTrend: item.gapTrend,
    lastReversalAt: item.lastReversalAt,
    tag: item.tag,
    currentGapLabel: item.currentGapLabel,
  }))

  const events = buildEvents(lines, buckets, reversalRecords)
  const fastest = [...lines].sort((a, b) => b.risePerMin - a.risePerMin)[0] ?? null
  const latestReversal = reversalRecords[0] ?? null

  const focusId =
    (filters.focus && lines.some((line) => line.streamerId === filters.focus) ? filters.focus : "") ||
    lines[0]?.streamerId ||
    ""

  const focusLine = lines.find((line) => line.streamerId === focusId) ?? lines[0] ?? null
  const focusRise = events.find((event) => event.type === "rise" && event.streamerId === (focusLine?.streamerId ?? "")) ?? null
  const hasGaps = buckets.some((_, idx) => idx < buckets.length - 1 && !bucketHasRun[idx])
  const state: KickBattleLinesPayload["state"] =
    filters.day === "today"
      ? "partial"
      : (hasGaps ? "partial" : "complete")

  const payload: KickBattleLinesPayload = {
    source: "api",
    platform: "kick",
    state,
    updatedAt: lastUpdated ?? undefined,
    lastUpdated,
    coverage: latestCoverage,
    note: hasGaps
      ? "Some Kick snapshot buckets are missing and were forward-filled for continuity."
      : "Kick rivalry radar is built from stored top-viewer snapshot history.",
    filters,
    buckets,
    lines,
    focusStrip: lines.map((line) => ({ streamerId: line.streamerId, name: line.name })),
    focusDetail: {
      streamerId: focusLine?.streamerId ?? "",
      name: focusLine?.name ?? "N/A",
      peakViewers: focusLine?.peakViewers ?? 0,
      latestViewers: focusLine?.latestViewers ?? 0,
      biggestRiseTime: focusRise?.bucket ? isoMinuteLabel(focusRise.bucket) : "N/A",
      reversalCount: focusLine?.reversalCount ?? 0,
    },
    events,
    recommendation: {
      primaryBattle,
      secondaryBattles,
      latestReversal: latestReversal
        ? `${latestReversal.passerName} passed ${latestReversal.passedName} @ ${isoMinuteLabel(latestReversal.timestamp)}`
        : "No reversal yet",
      fastestChallenger: fastest
        ? `${fastest.name} (+${battleNumberFmt.format(Math.round(fastest.risePerMin))}/min)`
        : "N/A",
      reversalStrip: reversalRecords.slice(0, 6).map((record) => ({
        timestamp: record.timestamp,
        label: `${record.passerName} passed ${record.passedName}`,
        passer: record.passerName,
        passed: record.passedName,
        gapBefore: record.gapBefore,
        gapAfter: record.gapAfter,
        heatOverlap: false,
      })),
    },
    pairs,
    summary: {
      observedPairs: pairs.length,
      strongestPair: primaryBattle ? `${primaryBattle.leftName} vs ${primaryBattle.rightName}` : null,
      strongestReversalWindow: latestReversal?.timestamp ?? null,
      strongestPressureSide: fastest?.name ?? null,
      leader: lines[0]?.name ?? "No leader",
      biggestRise: fastest?.name ?? "No rise",
      peakMoment: events.find((event) => event.type === "peak")?.bucket ?? (lastUpdated ?? "N/A"),
      reversals: reversalRecords.length,
      liveBattleNow: primaryBattle
        ? `${primaryBattle.leftName} vs ${primaryBattle.rightName} · ${primaryBattle.currentGapLabel} · ${primaryBattle.gapTrend}`
        : "No live battle",
      latestReversal: latestReversal
        ? `${latestReversal.passerName} passed ${latestReversal.passedName} @ ${isoMinuteLabel(latestReversal.timestamp)}`
        : "No reversal yet",
      fastestChallenger: fastest?.name ?? "N/A",
      mostHeatedBattle: primaryBattle
        ? `${primaryBattle.leftName} vs ${primaryBattle.rightName} · ${primaryBattle.tag}`
        : "No heated battle",
    },
  }

  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  })
}
