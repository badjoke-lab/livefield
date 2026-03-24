import { resolveApiState } from "./_shared/state"
import type {
  BattleCandidate,
  BattleCandidateTag,
  BattleGapTrend,
  BattleLine,
  BattleLinesEvent,
  BattleLinesFilters,
  BattleLinesMetricMode,
  BattleLinesPayload,
  BattleLinesRecommendation,
  BattleLinesState,
  BattleReversalStripItem
} from "../../../../packages/shared/src/types/battle-lines"

type Env = {
  DB?: {
    prepare: (sql: string) => {
      bind: (...params: unknown[]) => { all: () => Promise<{ results: SnapshotRow[] }> }
      all: () => Promise<{ results: SnapshotRow[] }>
    }
  }
}

type SnapshotRow = {
  bucket_minute: string
  collected_at: string
  covered_pages: number
  has_more: number
  payload_json: string
}

type SnapshotPayload = {
  streams?: Array<{
    userId?: string
    displayName?: string
    viewerCount?: number
    language?: string
  }>
}

type DraftLine = Omit<BattleLine, "reversalCount">
type RollupSeriesRow = {
  bucket_time: string
  streamer_id: string
  display_name: string
  viewers: number
  indexed_base_peak: number | null
}

type PairReversalRecord = {
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
  heatOverlap: boolean
}

type BattleReversalEventRow = {
  bucket_time: string
  left_streamer_id: string
  right_streamer_id: string
  passer_streamer_id: string
  passed_streamer_id: string
  gap_before: number
  gap_after: number
  heat_overlap: number | null
}

const DAY_MS = 24 * 60 * 60 * 1000
const COLORS = ["#7aa2ff", "#4cdfff", "#8cf3c5", "#bd9bff", "#ff9ac6", "#f5cb6b", "#9fb3d8", "#d99fff", "#7df2c8", "#ffc38f"]

const numberFmt = new Intl.NumberFormat("en-US")

function normalizeTop(raw: string | null): 3 | 5 | 10 {
  return raw === "3" ? 3 : raw === "10" ? 10 : 5
}

function normalizeBucket(raw: string | null): 1 | 5 | 10 {
  return raw === "1" ? 1 : raw === "10" ? 10 : 5
}

function normalizeMetric(raw: string | null): BattleLinesMetricMode {
  return raw === "indexed" ? "indexed" : "viewers"
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function parseDay(rawDate: string | null, rawDay: string | null): { day: BattleLinesFilters["day"]; date: Date } {
  const now = new Date()
  if (rawDay === "yesterday") {
    return { day: "yesterday", date: new Date(startOfUtcDay(now).getTime() - DAY_MS) }
  }
  if (rawDate) {
    const parsed = new Date(`${rawDate}T00:00:00.000Z`)
    if (!Number.isNaN(parsed.getTime())) return { day: "date", date: parsed }
  }
  return { day: "today", date: startOfUtcDay(now) }
}

function toIsoMinute(date: Date): string {
  return `${date.toISOString().slice(0, 16)}:00.000Z`
}

function floorToBucket(iso: string, minutes: 1 | 5 | 10): string {
  const d = new Date(iso)
  d.setUTCSeconds(0, 0)
  const m = d.getUTCMinutes()
  d.setUTCMinutes(m - (m % minutes))
  return toIsoMinute(d)
}

function isoMinuteLabel(iso: string): string {
  return iso.slice(11, 16)
}

function parseIsoMinute(iso: string | null | undefined): number {
  if (!iso) return 0
  const time = Date.parse(iso)
  return Number.isNaN(time) ? 0 : time
}

function formatGap(value: number): string {
  return `${numberFmt.format(Math.max(0, Math.round(value)))} gap`
}

function buildBuckets(day: Date, bucketMinutes: 1 | 5 | 10, now: Date): string[] {
  const start = startOfUtcDay(day)
  const end = new Date(start.getTime() + DAY_MS)
  const isToday = start.getTime() === startOfUtcDay(now).getTime()
  const limit = isToday ? now : end

  const buckets: string[] = []
  for (let ts = start.getTime(); ts < limit.getTime(); ts += bucketMinutes * 60 * 1000) {
    buckets.push(toIsoMinute(new Date(ts)))
  }
  return buckets
}

function buildCandidateKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join("|")
}

function gapTrendFrom(previousGap: number, latestGap: number): BattleGapTrend {
  if (latestGap < previousGap) return "closing"
  if (latestGap > previousGap) return "widening"
  return "flat"
}

function pickCandidateTag(args: {
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

function buildPairReversalRecords(lines: DraftLine[], buckets: string[]): PairReversalRecord[] {
  const records: PairReversalRecord[] = []

  for (let left = 0; left < lines.length; left += 1) {
    for (let right = left + 1; right < lines.length; right += 1) {
      const a = lines[left]
      const b = lines[right]
      const key = buildCandidateKey(a.streamerId, b.streamerId)

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
          heatOverlap: false
        })
      }
    }
  }

  return records.sort((a, b) => parseIsoMinute(b.timestamp) - parseIsoMinute(a.timestamp))
}

function enrichLinesAndBuildRecommendation(
  draftLines: DraftLine[],
  buckets: string[],
  reversalRecords?: PairReversalRecord[]
): { lines: BattleLine[]; events: BattleLinesEvent[]; recommendation: BattleLinesRecommendation } {
  const pairReversals = reversalRecords ?? buildPairReversalRecords(draftLines, buckets)
  const reversalCountById = new Map<string, number>()

  for (const record of pairReversals) {
    reversalCountById.set(record.passerId, (reversalCountById.get(record.passerId) ?? 0) + 1)
    reversalCountById.set(record.passedId, (reversalCountById.get(record.passedId) ?? 0) + 1)
  }

  const lines: BattleLine[] = draftLines.map((line) => ({
    ...line,
    reversalCount: reversalCountById.get(line.streamerId) ?? 0
  }))

  const candidateByKey = new Map<string, BattleCandidate>()
  const newestTimestamp = parseIsoMinute(buckets[buckets.length - 1] ?? null)

  for (let left = 0; left < lines.length; left += 1) {
    for (let right = left + 1; right < lines.length; right += 1) {
      const a = lines[left]
      const b = lines[right]
      const key = buildCandidateKey(a.streamerId, b.streamerId)
      const pairEvents = pairReversals.filter((event) => event.key === key)
      const latestReversalAt = pairEvents[0]?.timestamp ?? null

      const latestGap = Math.abs((a.latestViewers ?? 0) - (b.latestViewers ?? 0))
      const prevA = a.viewerPoints.length >= 2 ? a.viewerPoints[a.viewerPoints.length - 2] ?? a.latestViewers : a.latestViewers
      const prevB = b.viewerPoints.length >= 2 ? b.viewerPoints[b.viewerPoints.length - 2] ?? b.latestViewers : b.latestViewers
      const previousGap = Math.abs(prevA - prevB)
      const gapTrend = gapTrendFrom(previousGap, latestGap)
      const combinedRise = Math.max(0, a.risePerMin) + Math.max(0, b.risePerMin)

      const closenessScore = Math.max(0, 3000 - latestGap * 6)
      const recencyMinutes = latestReversalAt ? Math.max(1, Math.floor((newestTimestamp - parseIsoMinute(latestReversalAt)) / 60000)) : 9999
      const reversalRecencyScore = latestReversalAt ? Math.max(0, 1800 - recencyMinutes * 45) : 0
      const momentumConflictScore = Math.max(0, combinedRise) * 6
      const rankRelevanceScore = Math.max(0, 420 - left * 60 - right * 35)
      const score = closenessScore + reversalRecencyScore + momentumConflictScore + rankRelevanceScore

      candidateByKey.set(key, {
        key,
        leftId: a.streamerId,
        rightId: b.streamerId,
        leftName: a.name,
        rightName: b.name,
        score,
        gap: latestGap,
        gapTrend,
        lastReversalAt: latestReversalAt,
        tag: pickCandidateTag({
          latestGap,
          latestReversalAt,
          gapTrend,
          combinedRise
        }),
        currentGapLabel: formatGap(latestGap)
      })
    }
  }

  const rankedCandidates = [...candidateByKey.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.gap !== b.gap) return a.gap - b.gap
    return a.key.localeCompare(b.key)
  })

  const fastest = [...lines].sort((a, b) => b.risePerMin - a.risePerMin)[0]
  const latestReversal = pairReversals[0]
  const reversalStrip: BattleReversalStripItem[] = pairReversals.slice(0, 6).map((item) => ({
    timestamp: item.timestamp,
    label: `${item.passerName} passed ${item.passedName}`,
    passer: item.passerName,
    passed: item.passedName,
    gapBefore: item.gapBefore,
    gapAfter: item.gapAfter,
    heatOverlap: item.heatOverlap
  }))

  const recommendation: BattleLinesRecommendation = {
    primaryBattle: rankedCandidates[0] ?? null,
    secondaryBattles: rankedCandidates.slice(1, 4),
    latestReversal: latestReversal
      ? `${latestReversal.passerName} passed ${latestReversal.passedName} @ ${isoMinuteLabel(latestReversal.timestamp)}`
      : "No reversal yet",
    fastestChallenger: fastest
      ? `${fastest.name} (+${numberFmt.format(Math.round(fastest.risePerMin))}/min)`
      : "N/A",
    reversalStrip
  }

  const events: BattleLinesEvent[] = []

  for (const line of lines) {
    if (!line.viewerPoints.length) continue

    const peakIdx = line.viewerPoints.reduce((best, value, idx, arr) => (value > arr[best] ? idx : best), 0)
    events.push({
      type: "peak",
      bucket: buckets[peakIdx] ?? buckets[0] ?? new Date().toISOString(),
      label: `${line.name} peak`,
      streamerId: line.streamerId
    })

    let riseIdx = 1
    let riseDelta = -Infinity
    for (let idx = 1; idx < line.viewerPoints.length; idx += 1) {
      const delta = (line.viewerPoints[idx] ?? 0) - (line.viewerPoints[idx - 1] ?? 0)
      if (delta > riseDelta) {
        riseDelta = delta
        riseIdx = idx
      }
    }
    events.push({
      type: "rise",
      bucket: buckets[riseIdx] ?? buckets[0] ?? new Date().toISOString(),
      label: `${line.name} rise`,
      streamerId: line.streamerId
    })
  }

  for (const record of pairReversals) {
    events.push({
      type: "reversal",
      bucket: record.timestamp,
      label: `${record.passerName} passed ${record.passedName}`,
      streamerId: record.passerId,
      rivalId: record.passedId
    })
  }

  events.sort((a, b) => parseIsoMinute(b.bucket) - parseIsoMinute(a.bucket))

  return { lines, events, recommendation }
}

function createSummary(
  lines: BattleLine[],
  buckets: string[],
  events: BattleLinesEvent[],
  recommendation: BattleLinesRecommendation
): BattleLinesPayload["summary"] {
  const peakEvent = events.find((event) => event.type === "peak")
  const biggestRise = [...lines].sort((a, b) => b.risePerMin - a.risePerMin)[0]
  const primary = recommendation.primaryBattle
  const heated = [...[primary, ...recommendation.secondaryBattles]]
    .filter((item): item is BattleCandidate => item !== null)
    .sort((a, b) => {
      if ((a.tag === "heated") !== (b.tag === "heated")) return a.tag === "heated" ? -1 : 1
      return a.gap - b.gap
    })[0] ?? null

  return {
    leader: lines[0]?.name ?? "No live streams",
    biggestRise: biggestRise?.name ?? "N/A",
    peakMoment: peakEvent?.bucket ? isoMinuteLabel(peakEvent.bucket) : (buckets[0] ? isoMinuteLabel(buckets[0]) : "N/A"),
    reversals: events.filter((event) => event.type === "reversal").length,
    liveBattleNow: primary
      ? `${primary.leftName} vs ${primary.rightName} · ${primary.currentGapLabel} · ${primary.gapTrend}`
      : "No live battle now",
    latestReversal: recommendation.latestReversal,
    fastestChallenger: recommendation.fastestChallenger,
    mostHeatedBattle: heated
      ? `${heated.leftName} vs ${heated.rightName} · ${heated.tag}`
      : "No heated battle"
  }
}

function buildPayloadFromDraftLines(args: {
  source: BattleLinesPayload["source"]
  state: BattleLinesState
  updatedAt: string
  filters: BattleLinesFilters
  buckets: string[]
  draftLines: DraftLine[]
  reversalRecords?: PairReversalRecord[]
}): BattleLinesPayload {
  const { lines, events, recommendation } = enrichLinesAndBuildRecommendation(args.draftLines, args.buckets, args.reversalRecords)
  const focusId = lines.find((line) => line.streamerId === args.filters.focus)?.streamerId ?? lines[0]?.streamerId ?? ""
  const focusLine = lines.find((line) => line.streamerId === focusId) ?? lines[0]
  const focusRiseEvent = events.find((event) => event.type === "rise" && event.streamerId === (focusLine?.streamerId ?? ""))

  return {
    ok: true,
    tool: "battle-lines",
    source: args.source,
    state: args.state,
    updatedAt: args.updatedAt,
    filters: { ...args.filters, focus: focusId },
    summary: createSummary(lines, args.buckets, events, recommendation),
    buckets: args.buckets,
    lines,
    focusStrip: lines.map((line) => ({ streamerId: line.streamerId, name: line.name })),
    focusDetail: {
      streamerId: focusLine?.streamerId ?? "",
      name: focusLine?.name ?? "N/A",
      peakViewers: focusLine?.peakViewers ?? 0,
      latestViewers: focusLine?.latestViewers ?? 0,
      biggestRiseTime: focusRiseEvent?.bucket ? isoMinuteLabel(focusRiseEvent.bucket) : "N/A",
      reversalCount: focusLine?.reversalCount ?? 0
    },
    events,
    recommendation
  }
}

async function fetchRollupBattleRows(
  db: NonNullable<Env["DB"]>,
  day: string,
  requestedBucketMinutes: 5 | 10
): Promise<{ rows: RollupSeriesRow[]; bucketMinutes: 5 | 10 | null }> {
  const candidateBuckets: Array<5 | 10> =
    requestedBucketMinutes === 10 ? [10, 5] : [5, 10]

  for (const bucketMinutes of candidateBuckets) {
    const table = bucketMinutes === 10 ? "battlelines_series_10m" : "battlelines_series_5m"
    const rows = (await db
      .prepare(
        `SELECT bucket_time, streamer_id, display_name, viewers, indexed_base_peak
         FROM ${table}
         WHERE day = ?
         ORDER BY bucket_time ASC`
      )
      .bind(day)
      .all()) as unknown as { results: RollupSeriesRow[] }

    if (rows.results.length) return { rows: rows.results, bucketMinutes }
  }

  return { rows: [], bucketMinutes: null }
}

async function fetchHistoricalReversalEvents(
  db: NonNullable<Env["DB"]>,
  day: string
): Promise<{ results: BattleReversalEventRow[] }> {
  return (await db
    .prepare(
      `SELECT bucket_time, left_streamer_id, right_streamer_id, passer_streamer_id, passed_streamer_id, gap_before, gap_after, heat_overlap
       FROM battle_reversal_events
       WHERE day = ?
       ORDER BY bucket_time DESC
       LIMIT 250`
    )
    .bind(day)
    .all()) as unknown as { results: BattleReversalEventRow[] }
}

function toPairReversalRecordsFromRows(
  rows: BattleReversalEventRow[],
  nameById: Map<string, string>
): PairReversalRecord[] {
  return rows
    .map((row) => {
      const leftName = nameById.get(row.left_streamer_id) ?? row.left_streamer_id
      const rightName = nameById.get(row.right_streamer_id) ?? row.right_streamer_id
      const passerName = nameById.get(row.passer_streamer_id) ?? row.passer_streamer_id
      const passedName = nameById.get(row.passed_streamer_id) ?? row.passed_streamer_id
      const sortedPair = [row.left_streamer_id, row.right_streamer_id].sort()
      return {
        key: buildCandidateKey(sortedPair[0] ?? row.left_streamer_id, sortedPair[1] ?? row.right_streamer_id),
        leftId: row.left_streamer_id,
        rightId: row.right_streamer_id,
        leftName,
        rightName,
        timestamp: row.bucket_time,
        passerId: row.passer_streamer_id,
        passerName,
        passedId: row.passed_streamer_id,
        passedName,
        gapBefore: Math.max(0, row.gap_before),
        gapAfter: Math.max(0, row.gap_after),
        heatOverlap: row.heat_overlap === 1
      }
    })
    .sort((a, b) => parseIsoMinute(b.timestamp) - parseIsoMinute(a.timestamp))
}

async function buildRollupPayload(
  db: NonNullable<Env["DB"]>,
  filters: BattleLinesFilters,
  state: BattleLinesState
): Promise<BattleLinesPayload | null> {
  if (filters.bucketMinutes === 1) return null

  const historical = await fetchRollupBattleRows(db, filters.date, filters.bucketMinutes)
  if (!historical.rows.length || historical.bucketMinutes === null) return null

  const effectiveBucketMinutes = historical.bucketMinutes
  const effectiveFilters: BattleLinesFilters = {
    ...filters,
    bucketMinutes: effectiveBucketMinutes
  }
  const now = new Date()
  const buckets = buildBuckets(new Date(`${filters.date}T00:00:00.000Z`), effectiveBucketMinutes, now)
  const bucketIndex = new Map(buckets.map((bucket, idx) => [bucket, idx]))
  const nameById = new Map<string, string>()
  const totalById = new Map<string, number>()
  const pointsById = new Map<string, number[]>()
  const indexedById = new Map<string, number[]>()

  for (const row of historical.rows) {
    const idx = bucketIndex.get(toIsoMinute(new Date(row.bucket_time)))
    if (idx === undefined) continue
    nameById.set(row.streamer_id, row.display_name)
    totalById.set(row.streamer_id, (totalById.get(row.streamer_id) ?? 0) + row.viewers)
    const viewers = pointsById.get(row.streamer_id) ?? new Array(buckets.length).fill(0)
    viewers[idx] = row.viewers
    pointsById.set(row.streamer_id, viewers)
    const indexed = indexedById.get(row.streamer_id) ?? new Array(buckets.length).fill(0)
    indexed[idx] = row.indexed_base_peak ?? 0
    indexedById.set(row.streamer_id, indexed)
  }

  const rankedIds = [...totalById.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  const topIds = rankedIds.slice(0, effectiveFilters.top)

  const draftLines: DraftLine[] = topIds.map((streamerId, index) => {
    const viewerPoints = pointsById.get(streamerId) ?? new Array(buckets.length).fill(0)
    const peakViewers = viewerPoints.reduce((best, value) => Math.max(best, value), 0)
    const points =
      effectiveFilters.metric === "indexed"
        ? indexedById.get(streamerId)?.map((value) => Math.round(value * 10) / 10) ?? new Array(buckets.length).fill(0)
        : [...viewerPoints]
    let risePerMin = 0
    for (let idx = 1; idx < viewerPoints.length; idx += 1) {
      risePerMin = Math.max(risePerMin, (viewerPoints[idx] - viewerPoints[idx - 1]) / effectiveBucketMinutes)
    }
    return {
      streamerId,
      name: nameById.get(streamerId) ?? streamerId,
      color: COLORS[index % COLORS.length],
      points,
      viewerPoints,
      peakViewers,
      latestViewers: viewerPoints[viewerPoints.length - 1] ?? 0,
      risePerMin
    }
  })

  if (!draftLines.length) {
    return buildEmptyPayload(effectiveFilters, historical.rows[historical.rows.length - 1]?.bucket_time ?? new Date().toISOString())
  }

  const reversalRows = await fetchHistoricalReversalEvents(db, filters.date)
  const reversalRecords = toPairReversalRecordsFromRows(reversalRows.results, nameById)
  const updatedAt = historical.rows[historical.rows.length - 1]?.bucket_time ?? new Date().toISOString()

  return buildPayloadFromDraftLines({
    source: "api",
    state,
    updatedAt,
    filters: effectiveFilters,
    buckets,
    draftLines,
    reversalRecords
  })
}

function buildDemoPayload(filters: BattleLinesFilters): BattleLinesPayload {
  const buckets = ["00:00", "06:00", "12:00", "18:00", "23:55"].map((hhmm) => `${filters.date}T${hhmm}:00.000Z`)
  const viewerSeries = [
    { streamerId: "demo-a", name: "Stream A", points: [1200, 1600, 3100, 4200, 3600] },
    { streamerId: "demo-b", name: "Stream B", points: [1800, 2100, 2600, 2800, 3000] },
    { streamerId: "demo-c", name: "Stream C", points: [900, 1000, 1400, 2500, 2100] },
    { streamerId: "demo-d", name: "Stream D", points: [700, 900, 1200, 1600, 1500] },
    { streamerId: "demo-e", name: "Stream E", points: [600, 750, 880, 1200, 1050] }
  ].slice(0, filters.top)

  const draftLines: DraftLine[] = viewerSeries.map((stream, index) => {
    const peakViewers = Math.max(...stream.points)
    const points =
      filters.metric === "indexed"
        ? stream.points.map((value) => (peakViewers > 0 ? Math.round((value / peakViewers) * 1000) / 10 : 0))
        : [...stream.points]

    let risePerMin = 0
    for (let idx = 1; idx < stream.points.length; idx += 1) {
      risePerMin = Math.max(risePerMin, stream.points[idx] - stream.points[idx - 1])
    }

    return {
      streamerId: stream.streamerId,
      name: stream.name,
      color: COLORS[index % COLORS.length],
      points,
      viewerPoints: [...stream.points],
      peakViewers,
      latestViewers: stream.points[stream.points.length - 1] ?? 0,
      risePerMin
    }
  })

  return buildPayloadFromDraftLines({
    source: "demo",
    state: "demo",
    updatedAt: new Date().toISOString(),
    filters,
    buckets,
    draftLines
  })
}

function buildEmptyPayload(filters: BattleLinesFilters, updatedAt: string): BattleLinesPayload {
  const now = new Date()
  const buckets = buildBuckets(new Date(`${filters.date}T00:00:00.000Z`), filters.bucketMinutes, now)

  return {
    ok: true,
    tool: "battle-lines",
    source: "api",
    state: "empty",
    updatedAt,
    filters,
    summary: {
      leader: "No live streams",
      biggestRise: "N/A",
      peakMoment: buckets[0] ? isoMinuteLabel(buckets[0]) : "N/A",
      reversals: 0,
      liveBattleNow: "No live battle now",
      latestReversal: "No reversal yet",
      fastestChallenger: "N/A",
      mostHeatedBattle: "No heated battle"
    },
    buckets,
    lines: [],
    focusStrip: [],
    focusDetail: {
      streamerId: "",
      name: "N/A",
      peakViewers: 0,
      latestViewers: 0,
      biggestRiseTime: "N/A",
      reversalCount: 0
    },
    events: [],
    recommendation: {
      primaryBattle: null,
      secondaryBattles: [],
      latestReversal: "No reversal yet",
      fastestChallenger: "N/A",
      reversalStrip: []
    }
  }
}

function json(body: BattleLinesPayload): Response {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  })
}

export const onRequest = async (context: { env: Env; request: Request }) => {
  const url = new URL(context.request.url)
  const parsedDay = parseDay(url.searchParams.get("date"), url.searchParams.get("day"))
  const filters: BattleLinesFilters = {
    day: parsedDay.day,
    date: startOfUtcDay(parsedDay.date).toISOString().slice(0, 10),
    top: normalizeTop(url.searchParams.get("top")),
    metric: normalizeMetric(url.searchParams.get("metric")),
    bucketMinutes: normalizeBucket(url.searchParams.get("bucket")),
    focus: url.searchParams.get("focus") ?? ""
  }

  const db = context.env.DB
  if (!db) return json(buildDemoPayload(filters))
  const isHistorical = filters.day === "yesterday" || filters.day === "date"

  try {
    const rollupPayload = await buildRollupPayload(
      db,
      filters,
      filters.day === "today" ? "partial" : "complete"
    )
    if (rollupPayload) return json(rollupPayload)
  } catch {
    if (isHistorical) {
      return json(buildEmptyPayload(filters, new Date().toISOString()))
    }
  }

  if (isHistorical) {
    return json(buildEmptyPayload(filters, new Date().toISOString()))
  }

  const dayStart = `${filters.date}T00:00:00.000Z`
  const dayEnd = `${filters.date}T23:59:59.999Z`

  const rows = await db
    .prepare(
      `SELECT bucket_minute, collected_at, covered_pages, has_more, payload_json
       FROM minute_snapshots
       WHERE provider = 'twitch' AND bucket_minute >= ? AND bucket_minute <= ?
       ORDER BY bucket_minute ASC`
    )
    .bind(dayStart, dayEnd)
    .all()

  if (!rows.results.length) return json(buildEmptyPayload(filters, new Date().toISOString()))

  try {
    const now = new Date()
    const buckets = buildBuckets(new Date(`${filters.date}T00:00:00.000Z`), filters.bucketMinutes, now)
    const bucketIndex = new Map(buckets.map((bucket, idx) => [bucket, idx]))

    const nameById = new Map<string, string>()
    const totalById = new Map<string, number>()
    const pointsById = new Map<string, number[]>()

    for (const row of rows.results) {
      const bucketIso = floorToBucket(row.bucket_minute, filters.bucketMinutes)
      const idx = bucketIndex.get(bucketIso)
      if (idx === undefined) continue

      const payload = JSON.parse(row.payload_json) as SnapshotPayload
      for (const stream of payload.streams ?? []) {
        if (!stream.userId || !stream.displayName || typeof stream.viewerCount !== "number") continue

        nameById.set(stream.userId, stream.displayName)
        totalById.set(stream.userId, (totalById.get(stream.userId) ?? 0) + stream.viewerCount)

        const points = pointsById.get(stream.userId) ?? new Array(buckets.length).fill(0)
        points[idx] += stream.viewerCount
        pointsById.set(stream.userId, points)
      }
    }

    const rankedIds = [...totalById.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
    const topIds = rankedIds.slice(0, filters.top)

    const draftLines: DraftLine[] = topIds.map((streamerId, index) => {
      const viewerPoints = pointsById.get(streamerId) ?? new Array(buckets.length).fill(0)
      const peakViewers = viewerPoints.reduce((best, value) => Math.max(best, value), 0)
      const points =
        filters.metric === "indexed"
          ? viewerPoints.map((value) => (peakViewers > 0 ? Math.round((value / peakViewers) * 1000) / 10 : 0))
          : [...viewerPoints]

      let risePerMin = 0
      for (let idx = 1; idx < viewerPoints.length; idx += 1) {
        risePerMin = Math.max(risePerMin, (viewerPoints[idx] - viewerPoints[idx - 1]) / filters.bucketMinutes)
      }

      return {
        streamerId,
        name: nameById.get(streamerId) ?? streamerId,
        color: COLORS[index % COLORS.length],
        points,
        viewerPoints,
        peakViewers,
        latestViewers: viewerPoints[viewerPoints.length - 1] ?? 0,
        risePerMin
      }
    })

    if (!draftLines.length) {
      return json(buildEmptyPayload(filters, rows.results[rows.results.length - 1]?.collected_at ?? new Date().toISOString()))
    }

    const minutesSinceLatest = Math.floor(
      (Date.now() - new Date(rows.results[rows.results.length - 1]?.collected_at ?? Date.now()).getTime()) / 60_000
    )

    const baseState = resolveApiState({
      source: "api",
      hasSnapshot: true,
      isFresh: filters.day === "today" ? minutesSinceLatest <= 2 : true,
      isPartial: rows.results.some((row) => row.has_more === 1),
      hasError: false
    })

    const state: BattleLinesState =
      filters.day === "today"
        ? baseState
        : baseState === "live"
          ? "complete"
          : baseState

    return json(
      buildPayloadFromDraftLines({
        source: "api",
        state,
        updatedAt: rows.results[rows.results.length - 1]?.collected_at ?? new Date().toISOString(),
        filters,
        buckets,
        draftLines
      })
    )
  } catch {
    return json(buildDemoPayload(filters))
  }
}
