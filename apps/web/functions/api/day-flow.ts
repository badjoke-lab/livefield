import { resolveApiState } from "./_shared/state"
import type { DayFlowBandSeries, DayFlowFocusItem, DayFlowPayload } from "../../../../packages/shared/src/types/day-flow"

type Env = {
  DB?: {
    prepare: (sql: string) => {
      bind: (...params: unknown[]) => { all: () => Promise<{ results: any[] }> }
      all: () => Promise<{ results: any[] }>
    }
  }
}

type DayScope = "today" | "rolling24h" | "yesterday" | "date"
type ValueMode = "volume" | "share"
type BucketSize = 5 | 10
type TopN = 10 | 20 | 50

type SnapshotRow = {
  bucket_minute: string
  collected_at: string
  has_more: number
  payload_json: string
}

type RollupRow = {
  bucket_time: string
  streamer_id: string
  display_name: string
  is_others: number
  avg_viewers: number
  viewer_minutes: number
  first_seen_at: string | null
  last_seen_at: string | null
}

type StreamAgg = {
  id: string
  name: string
  title: string
  url: string
  points: number[]
  totalViewerMinutes: number
  firstSeenBucket: string | null
  lastSeenBucket: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000
const SNAPSHOT_CHUNK_MS = 6 * 60 * 60 * 1000
const COLORS = ["#7aa2ff", "#4cdfff", "#8cf3c5", "#bd9bff", "#ff9ac6", "#f5cb6b", "#9fb3d8", "#d99fff", "#7df2c8", "#ffc38f"]
const OTHERS_COLOR = "#77829a"

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function toIsoMinute(date: Date): string {
  return `${date.toISOString().slice(0, 16)}:00.000Z`
}

function floorToBucket(iso: string, minutes: BucketSize): string {
  const d = new Date(iso)
  d.setUTCSeconds(0, 0)
  d.setUTCMinutes(d.getUTCMinutes() - (d.getUTCMinutes() % minutes))
  return toIsoMinute(d)
}

function buildBuckets(day: Date, bucketSize: BucketSize): string[] {
  const start = startOfUtcDay(day)
  const end = new Date(start.getTime() + DAY_MS)
  const out: string[] = []
  for (let ts = start.getTime(); ts < end.getTime(); ts += bucketSize * 60_000) out.push(toIsoMinute(new Date(ts)))
  return out
}

function buildRollingBuckets(endIso: string, bucketSize: BucketSize): string[] {
  const end = new Date(endIso)
  end.setUTCSeconds(0, 0)
  end.setUTCMinutes(end.getUTCMinutes() - (end.getUTCMinutes() % bucketSize))
  const start = new Date(end.getTime() - DAY_MS)
  const out: string[] = []
  for (let ts = start.getTime(); ts <= end.getTime(); ts += bucketSize * 60_000) out.push(toIsoMinute(new Date(ts)))
  return out
}

function parseScope(url: URL): { day: DayScope; selectedDate: string } {
  const rawDate = url.searchParams.get("date")
  const rawDay = url.searchParams.get("day")
  const rawRangeMode = url.searchParams.get("rangeMode")
  const mode = rawRangeMode ?? rawDay
  const now = new Date()
  if (mode === "rolling24h" || mode === "rolling" || mode === "rolling24" || mode === "24h") {
    return { day: "rolling24h", selectedDate: startOfUtcDay(now).toISOString().slice(0, 10) }
  }
  if (mode === "yesterday") {
    return { day: "yesterday", selectedDate: new Date(startOfUtcDay(now).getTime() - DAY_MS).toISOString().slice(0, 10) }
  }
  if ((mode === "date" || rawDate) && rawDate) {
    return { day: "date", selectedDate: startOfUtcDay(new Date(`${rawDate}T00:00:00.000Z`)).toISOString().slice(0, 10) }
  }
  return { day: "today", selectedDate: startOfUtcDay(now).toISOString().slice(0, 10) }
}

function normalizeTop(raw: string | null): TopN {
  if (raw === "10") return 10
  if (raw === "50") return 50
  return 20
}

function normalizeBucket(raw: string | null): BucketSize {
  return raw === "10" ? 10 : 5
}

function normalizeMode(raw: string | null): ValueMode {
  return raw === "share" ? "share" : "volume"
}

function emptyPayload(input: {
  day: DayScope
  selectedDate: string
  bucketSize: BucketSize
  topN: TopN
  mode: ValueMode
  updatedAt: string
  windowStart: string
  windowEnd: string
  isRolling: boolean
  source?: "api" | "demo"
  state?: DayFlowPayload["state"]
  status?: DayFlowPayload["status"]
  note?: string
}): DayFlowPayload {
  const buckets = input.isRolling
    ? buildRollingBuckets(input.windowEnd, input.bucketSize)
    : buildBuckets(new Date(`${input.selectedDate}T00:00:00.000Z`), input.bucketSize)
  return {
    ok: true,
    tool: "day-flow",
    source: input.source ?? "api",
    state: input.state ?? "empty",
    status: input.status ?? "empty",
    note: input.note ?? "No stream snapshots were available for the selected date.",
    coverageNote: `Top ${input.topN} + Others by viewer-minutes in selected window`,
    partialNote: "No activity layer in current Twitch snapshot ingest.",
    lastUpdated: input.updatedAt,
    selectedDate: input.selectedDate,
    bucketSize: input.bucketSize,
    topN: input.topN,
    valueMode: input.mode,
    defaultMode: input.mode,
    dateScope: input.day,
    rangeMode: input.day,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    rankingWindowStart: input.windowStart,
    rankingWindowEnd: input.windowEnd,
    isRolling: input.isRolling,
    summary: {
      peakLeader: "N/A",
      longestDominance: "N/A",
      highestActivity: "Activity unavailable",
      biggestRise: "N/A"
    },
    timeline: {
      dayStart: input.windowStart,
      dayEnd: input.windowEnd,
      nowBucket: null,
      bucketCount: buckets.length,
      futureBlankFrom: null
    },
    buckets,
    totalViewersByBucket: new Array(buckets.length).fill(0),
    bands: [{
      streamerId: "others",
      name: "Others",
      title: "Grouped remaining streams",
      url: "",
      color: OTHERS_COLOR,
      isOthers: true,
      order: 0,
      totalViewerMinutes: 0,
      peakViewers: 0,
      avgViewers: 0,
      peakShare: 0,
      biggestRiseBucket: null,
      firstSeen: null,
      lastSeen: null,
      activityMax: null,
      buckets: buckets.map(() => ({ viewers: 0, share: 0, activityAvailable: false, peak: false, rise: false }))
    }],
    focusSnapshot: {
      selectedBucket: null,
      items: [],
      strongestMomentum: "N/A",
      highestActivity: "Activity unavailable"
    },
    detailPanelSource: {
      defaultStreamerId: null,
      streamers: []
    },
    activity: {
      available: false,
      note: "Activity unavailable for day-flow MVP: snapshots currently do not provide per-stream activity."
    }
  }
}

async function fetchMinuteSnapshots(db: NonNullable<Env["DB"]>, startIso: string, endIso: string): Promise<SnapshotRow[]> {
  const startMs = new Date(startIso).getTime()
  const endMs = new Date(endIso).getTime()
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs > endMs) return []
  const out: SnapshotRow[] = []
  for (let chunkStartMs = startMs; chunkStartMs <= endMs; chunkStartMs += SNAPSHOT_CHUNK_MS) {
    const chunkEndMs = Math.min(endMs, chunkStartMs + SNAPSHOT_CHUNK_MS - 60_000)
    const chunkStartIso = toIsoMinute(new Date(chunkStartMs))
    const chunkEndIso = toIsoMinute(new Date(chunkEndMs))
    const rows = await db.prepare(
      `SELECT bucket_minute, collected_at, has_more, payload_json
       FROM minute_snapshots
       WHERE provider = 'twitch' AND bucket_minute >= ? AND bucket_minute <= ?
       ORDER BY bucket_minute ASC`
    ).bind(chunkStartIso, chunkEndIso).all()
    out.push(...(rows.results as SnapshotRow[]))
  }
  out.sort((a, b) => a.bucket_minute.localeCompare(b.bucket_minute))
  return out
}

async function fetchHistoricalRollup(db: NonNullable<Env["DB"]>, day: string, topN: TopN): Promise<{ rows: RollupRow[]; bucketSize: BucketSize | null }> {
  const topScope = `top${topN}`
  const five = await db.prepare(
    `SELECT bucket_time, streamer_id, display_name, is_others, avg_viewers, viewer_minutes, first_seen_at, last_seen_at
     FROM dayflow_bands_5m WHERE day = ? AND top_scope = ? ORDER BY bucket_time ASC`
  ).bind(day, topScope).all()
  if (five.results.length) return { rows: five.results as RollupRow[], bucketSize: 5 }
  const ten = await db.prepare(
    `SELECT bucket_time, streamer_id, display_name, is_others, avg_viewers, viewer_minutes, first_seen_at, last_seen_at
     FROM dayflow_bands_10m WHERE day = ? AND top_scope = ? ORDER BY bucket_time ASC`
  ).bind(day, topScope).all()
  if (ten.results.length) return { rows: ten.results as RollupRow[], bucketSize: 10 }
  return { rows: [], bucketSize: null }
}

function buildFromRollup(rows: RollupRow[], selectedDate: string, bucketSize: BucketSize): { bucketKeys: string[]; streamAggById: Map<string, StreamAgg>; totalByBucket: number[] } {
  const bucketKeys = buildBuckets(new Date(`${selectedDate}T00:00:00.000Z`), bucketSize)
  const bucketIndexByIso = new Map(bucketKeys.map((bucket, index) => [bucket, index]))
  const streamAggById = new Map<string, StreamAgg>()
  const totalByBucket = new Array<number>(bucketKeys.length).fill(0)
  for (const row of rows) {
    const bucketIso = toIsoMinute(new Date(row.bucket_time))
    const bucketIndex = bucketIndexByIso.get(bucketIso)
    if (bucketIndex === undefined) continue
    let agg = streamAggById.get(row.streamer_id)
    if (!agg) {
      agg = {
        id: row.streamer_id,
        name: row.is_others === 1 ? "Others" : row.display_name,
        title: row.is_others === 1 ? "Grouped remaining streams" : "",
        url: row.is_others === 1 ? "" : `https://www.twitch.tv/${row.display_name}`,
        points: new Array<number>(bucketKeys.length).fill(0),
        totalViewerMinutes: 0,
        firstSeenBucket: row.first_seen_at,
        lastSeenBucket: row.last_seen_at
      }
      streamAggById.set(row.streamer_id, agg)
    }
    agg.points[bucketIndex] = Math.max(0, Math.round(row.avg_viewers))
    agg.totalViewerMinutes += Math.max(0, row.viewer_minutes)
    agg.firstSeenBucket = agg.firstSeenBucket ?? row.first_seen_at
    agg.lastSeenBucket = agg.lastSeenBucket ?? row.last_seen_at
    totalByBucket[bucketIndex] += Math.max(0, Math.round(row.avg_viewers))
  }
  return { bucketKeys, streamAggById, totalByBucket }
}

function buildFromRaw(rows: SnapshotRow[], bucketKeys: string[], bucketSize: BucketSize): { streamAggById: Map<string, StreamAgg>; totalByBucket: number[] } {
  const bucketIndexByIso = new Map(bucketKeys.map((bucket, index) => [bucket, index]))
  const streamAggById = new Map<string, StreamAgg>()
  const totalViewerMinutesByBucket = new Array<number>(bucketKeys.length).fill(0)
  for (const row of rows) {
    const bucketIso = floorToBucket(row.bucket_minute, bucketSize)
    const bucketIndex = bucketIndexByIso.get(bucketIso)
    if (bucketIndex === undefined) continue
    let payload: { streams?: Array<{ userId?: string; displayName?: string; title?: string; viewerCount?: number }> }
    try {
      payload = JSON.parse(row.payload_json)
    } catch {
      continue
    }
    for (const stream of payload.streams ?? []) {
      if (!stream.userId || !stream.displayName || typeof stream.viewerCount !== "number") continue
      let agg = streamAggById.get(stream.userId)
      if (!agg) {
        agg = {
          id: stream.userId,
          name: stream.displayName,
          title: stream.title ?? "",
          url: `https://www.twitch.tv/${stream.displayName}`,
          points: new Array<number>(bucketKeys.length).fill(0),
          totalViewerMinutes: 0,
          firstSeenBucket: bucketIso,
          lastSeenBucket: bucketIso
        }
        streamAggById.set(stream.userId, agg)
      }
      agg.name = stream.displayName
      agg.title = stream.title ?? agg.title
      agg.points[bucketIndex] += stream.viewerCount
      agg.totalViewerMinutes += stream.viewerCount
      agg.firstSeenBucket = agg.firstSeenBucket ? (agg.firstSeenBucket < bucketIso ? agg.firstSeenBucket : bucketIso) : bucketIso
      agg.lastSeenBucket = agg.lastSeenBucket ? (agg.lastSeenBucket > bucketIso ? agg.lastSeenBucket : bucketIso) : bucketIso
      totalViewerMinutesByBucket[bucketIndex] += stream.viewerCount
    }
  }
  for (const agg of streamAggById.values()) {
    agg.points = agg.points.map((viewerMinutes) => Math.round(viewerMinutes / bucketSize))
  }
  return {
    streamAggById,
    totalByBucket: totalViewerMinutesByBucket.map((viewerMinutes) => Math.round(viewerMinutes / bucketSize))
  }
}

function toBands(ordered: StreamAgg[], totalByBucket: number[], bucketKeys: string[]): DayFlowBandSeries[] {
  return ordered.map((stream, index) => {
    const peakViewers = stream.points.reduce((best, value) => Math.max(best, value), 0)
    const avgViewers = stream.points.length ? Math.round(stream.points.reduce((sum, value) => sum + value, 0) / stream.points.length) : 0
    const peakShare = stream.points.reduce((best, value, idx) => Math.max(best, totalByBucket[idx] > 0 ? value / totalByBucket[idx] : 0), 0)
    let biggestRiseIndex = -1
    let biggestRise = Number.NEGATIVE_INFINITY
    for (let i = 1; i < stream.points.length; i += 1) {
      const rise = stream.points[i] - stream.points[i - 1]
      if (rise > biggestRise) {
        biggestRise = rise
        biggestRiseIndex = i
      }
    }
    return {
      streamerId: stream.id,
      name: stream.name,
      title: stream.title,
      url: stream.url,
      color: stream.id === "others" ? OTHERS_COLOR : COLORS[index % COLORS.length],
      isOthers: stream.id === "others",
      order: index,
      totalViewerMinutes: stream.totalViewerMinutes,
      peakViewers,
      avgViewers,
      peakShare,
      biggestRiseBucket: biggestRiseIndex >= 0 ? bucketKeys[biggestRiseIndex] ?? null : null,
      firstSeen: stream.firstSeenBucket,
      lastSeen: stream.lastSeenBucket,
      activityMax: null,
      buckets: stream.points.map((viewers, idx) => {
        const previous = idx > 0 ? stream.points[idx - 1] : viewers
        const share = totalByBucket[idx] > 0 ? viewers / totalByBucket[idx] : 0
        return { viewers, share, activityAvailable: false, peak: viewers === peakViewers && viewers > 0, rise: viewers > previous }
      })
    }
  })
}

function buildFocusItems(bands: DayFlowBandSeries[], bucketIndex: number): DayFlowFocusItem[] {
  return bands
    .filter((band) => !band.isOthers)
    .map((band) => {
      const current = band.buckets[bucketIndex] ?? { viewers: 0, share: 0 }
      const previous = band.buckets[Math.max(0, bucketIndex - 1)] ?? { viewers: 0 }
      return { streamerId: band.streamerId, name: band.name, viewers: current.viewers, share: current.share, momentum: current.viewers - previous.viewers, activity: null, activityAvailable: false }
    })
    .sort((a, b) => b.viewers - a.viewers)
    .slice(0, 5)
}

function buildPayload(input: {
  day: DayScope
  selectedDate: string
  bucketSize: BucketSize
  topN: TopN
  mode: ValueMode
  windowStart: string
  windowEnd: string
  isRolling: boolean
  updatedAt: string
  streamAggById: Map<string, StreamAgg>
  totalByBucket: number[]
  bucketKeys: string[]
  partial: boolean
  note?: string
}): DayFlowPayload {
  const orderedAll = [...input.streamAggById.values()].sort((a, b) => b.totalViewerMinutes - a.totalViewerMinutes)
  const topStreams = orderedAll.slice(0, input.topN)
  const tail = orderedAll.slice(input.topN)
  const othersPoints = new Array(input.bucketKeys.length).fill(0)
  for (const stream of tail) for (let i = 0; i < stream.points.length; i += 1) othersPoints[i] += stream.points[i]
  const ordered: StreamAgg[] = [
    ...topStreams,
    {
      id: "others",
      name: "Others",
      title: "Grouped remaining streams",
      url: "",
      points: othersPoints,
      totalViewerMinutes: tail.reduce((sum, s) => sum + s.totalViewerMinutes, 0),
      firstSeenBucket: input.bucketKeys[0] ?? null,
      lastSeenBucket: input.bucketKeys.at(-1) ?? null
    }
  ]
  const bands = toBands(ordered, input.totalByBucket, input.bucketKeys)
  const currentBucketIndex = Math.max(0, input.bucketKeys.length - 1)
  const focusItems = buildFocusItems(bands, currentBucketIndex)
  const leaderBand = bands.filter((b) => !b.isOthers)[0]
  const biggestRiseBand = [...bands].filter((b) => !b.isOthers).sort((a, b) => {
    const aRise = a.buckets.reduce((best, bucket, idx, arr) => Math.max(best, idx > 0 ? bucket.viewers - arr[idx - 1].viewers : 0), 0)
    const bRise = b.buckets.reduce((best, bucket, idx, arr) => Math.max(best, idx > 0 ? bucket.viewers - arr[idx - 1].viewers : 0), 0)
    return bRise - aRise
  })[0]
  const dominanceCounts = new Map<string, number>()
  for (let i = 0; i < input.bucketKeys.length; i += 1) {
    const leader = bands.filter((b) => !b.isOthers).map((b) => ({ name: b.name, viewers: b.buckets[i]?.viewers ?? 0 })).sort((a, b) => b.viewers - a.viewers)[0]
    if (leader && leader.viewers > 0) dominanceCounts.set(leader.name, (dominanceCounts.get(leader.name) ?? 0) + 1)
  }
  const longestDominance = [...dominanceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A"
  const state: DayFlowPayload["state"] = input.partial ? "partial" : (input.day === "today" || input.day === "rolling24h" ? "live" : "complete")
  const status: DayFlowPayload["status"] = state === "live" ? "live-today" : state
  return {
    ok: true,
    tool: "day-flow",
    source: "api",
    state,
    status,
    note: input.note,
    coverageNote: `Top ${input.topN} + Others by viewer-minutes in selected window`,
    degradationNote: "Activity overlay is intentionally disabled in MVP until per-stream activity is fully wired.",
    partialNote: input.partial ? "Collector reported partial page coverage in one or more buckets." : undefined,
    lastUpdated: input.updatedAt,
    selectedDate: input.selectedDate,
    bucketSize: input.bucketSize,
    topN: input.topN,
    valueMode: input.mode,
    defaultMode: input.mode,
    dateScope: input.day,
    rangeMode: input.day,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    rankingWindowStart: input.windowStart,
    rankingWindowEnd: input.windowEnd,
    isRolling: input.isRolling,
    summary: {
      peakLeader: leaderBand?.name ?? "N/A",
      longestDominance,
      highestActivity: "Activity unavailable",
      biggestRise: biggestRiseBand?.name ?? "N/A"
    },
    timeline: {
      dayStart: input.windowStart,
      dayEnd: input.windowEnd,
      nowBucket: input.day === "today" || input.day === "rolling24h" ? (input.bucketKeys[currentBucketIndex] ?? null) : null,
      bucketCount: input.bucketKeys.length,
      futureBlankFrom: null
    },
    buckets: input.bucketKeys,
    totalViewersByBucket: input.totalByBucket,
    bands,
    focusSnapshot: {
      selectedBucket: input.bucketKeys[currentBucketIndex] ?? null,
      items: focusItems,
      strongestMomentum: [...focusItems].sort((a, b) => b.momentum - a.momentum)[0]?.name ?? "N/A",
      highestActivity: "Activity unavailable"
    },
    detailPanelSource: {
      defaultStreamerId: bands.find((b) => !b.isOthers)?.streamerId ?? null,
      streamers: bands.filter((band) => !band.isOthers).map((band) => ({
        streamerId: band.streamerId,
        name: band.name,
        title: band.title,
        url: band.url,
        peakViewers: band.peakViewers,
        avgViewers: band.avgViewers,
        viewerMinutes: band.totalViewerMinutes,
        peakShare: band.peakShare,
        highestActivity: null,
        biggestRiseTime: band.biggestRiseBucket,
        firstSeen: band.firstSeen,
        lastSeen: band.lastSeen
      }))
    },
    activity: {
      available: false,
      note: "Activity unavailable for day-flow MVP: snapshots currently do not provide per-stream activity."
    }
  }
}

export const onRequest = async (context: { env: Env; request: Request }) => {
  const url = new URL(context.request.url)
  const { day, selectedDate } = parseScope(url)
  const bucketSize = normalizeBucket(url.searchParams.get("bucket"))
  const topN = normalizeTop(url.searchParams.get("top"))
  const mode = normalizeMode(url.searchParams.get("mode") ?? url.searchParams.get("metric"))
  const isRolling = day === "rolling24h"
  const dayStart = `${selectedDate}T00:00:00.000Z`
  const dayEnd = `${selectedDate}T24:00:00.000Z`

  const db = context.env.DB
  if (!db) {
    return new Response(JSON.stringify(emptyPayload({
      day,
      selectedDate,
      bucketSize,
      topN,
      mode,
      updatedAt: new Date().toISOString(),
      windowStart: isRolling ? toIsoMinute(new Date(Date.now() - DAY_MS)) : dayStart,
      windowEnd: isRolling ? toIsoMinute(new Date()) : dayEnd,
      isRolling,
      source: "demo",
      state: "demo",
      status: "demo",
      note: "DB unavailable in this environment; returning demo-compatible payload shell."
    }), null, 2), { headers: { "content-type": "application/json; charset=utf-8" } })
  }

  let historicalRollupPayload: DayFlowPayload | null = null

  if (day === "yesterday" || day === "date") {
    try {
      const historical = await fetchHistoricalRollup(db, selectedDate, topN)
      if (historical.rows.length && historical.bucketSize) {
        const built = buildFromRollup(historical.rows, selectedDate, historical.bucketSize)
        if (built.streamAggById.size > 0) {
          historicalRollupPayload = buildPayload({
            day,
            selectedDate,
            bucketSize: historical.bucketSize,
            topN,
            mode,
            windowStart: dayStart,
            windowEnd: dayEnd,
            isRolling: false,
            updatedAt: historical.rows.at(-1)?.bucket_time ?? dayEnd,
            streamAggById: built.streamAggById,
            totalByBucket: built.totalByBucket,
            bucketKeys: built.bucketKeys,
            partial: false,
            note: historical.bucketSize === 10 ? "Historical 5m rollup unavailable; served from 10m dayflow rollup." : undefined
          })
        }
      }
    } catch {
      historicalRollupPayload = null
    }
  }

  let queryStart = dayStart
  let queryEnd = `${selectedDate}T23:59:59.999Z`
  if (isRolling) {
    const latest = await db.prepare(`SELECT bucket_minute FROM minute_snapshots WHERE provider = 'twitch' ORDER BY bucket_minute DESC LIMIT 1`).all()
    const latestBucket = latest.results[0]?.bucket_minute
    const rollingEnd = latestBucket ? toIsoMinute(new Date(latestBucket)) : toIsoMinute(new Date())
    queryEnd = rollingEnd
    queryStart = toIsoMinute(new Date(new Date(rollingEnd).getTime() - DAY_MS))
  } else if (day === "today") {
    const latestToday = await db.prepare(`SELECT bucket_minute FROM minute_snapshots WHERE provider = 'twitch' AND bucket_minute >= ? AND bucket_minute <= ? ORDER BY bucket_minute DESC LIMIT 1`).bind(dayStart, queryEnd).all()
    const latestBucket = latestToday.results[0]?.bucket_minute
    if (latestBucket) queryEnd = toIsoMinute(new Date(latestBucket))
  }

  let rawRows: SnapshotRow[] = []
  try {
    rawRows = await fetchMinuteSnapshots(db, queryStart, queryEnd)
  } catch {
    rawRows = []
  }

  if (!rawRows.length) {
    if (historicalRollupPayload) {
      return new Response(JSON.stringify(historicalRollupPayload, null, 2), {
        headers: { "content-type": "application/json; charset=utf-8" }
      })
    }

    return new Response(JSON.stringify(emptyPayload({
      day,
      selectedDate,
      bucketSize,
      topN,
      mode,
      updatedAt: new Date().toISOString(),
      windowStart: queryStart,
      windowEnd: day === "today" || isRolling ? queryEnd : dayEnd,
      isRolling
    }), null, 2), { headers: { "content-type": "application/json; charset=utf-8" } })
  }

  const effectiveWindowEnd = day === "today" || isRolling ? floorToBucket(rawRows.at(-1)?.bucket_minute ?? queryEnd, bucketSize) : dayEnd
  const bucketKeys = isRolling ? buildRollingBuckets(effectiveWindowEnd, bucketSize) : buildBuckets(new Date(`${selectedDate}T00:00:00.000Z`), bucketSize)
  const built = buildFromRaw(rawRows, bucketKeys, bucketSize)
  if (!built.streamAggById.size) {
    if (historicalRollupPayload) {
      return new Response(JSON.stringify(historicalRollupPayload, null, 2), {
        headers: { "content-type": "application/json; charset=utf-8" }
      })
    }

    return new Response(JSON.stringify(emptyPayload({
      day,
      selectedDate,
      bucketSize,
      topN,
      mode,
      updatedAt: rawRows.at(-1)?.collected_at ?? new Date().toISOString(),
      windowStart: queryStart,
      windowEnd: effectiveWindowEnd,
      isRolling
    }), null, 2), { headers: { "content-type": "application/json; charset=utf-8" } })
  }

  const minutesSinceLatest = Math.floor((Date.now() - new Date(rawRows.at(-1)?.collected_at ?? new Date().toISOString()).getTime()) / 60_000)
  const baseState = resolveApiState({ source: "api", hasSnapshot: true, isFresh: day === "today" || isRolling ? minutesSinceLatest <= 2 : true, isPartial: rawRows.some((r) => r.has_more === 1), hasError: false })
  const partial = (baseState === "stale" ? "partial" : baseState) === "partial"

  return new Response(JSON.stringify(buildPayload({
    day,
    selectedDate,
    bucketSize,
    topN,
    mode,
    windowStart: isRolling ? toIsoMinute(new Date(new Date(effectiveWindowEnd).getTime() - DAY_MS)) : dayStart,
    windowEnd: effectiveWindowEnd,
    isRolling,
    updatedAt: rawRows.at(-1)?.collected_at ?? new Date().toISOString(),
    streamAggById: built.streamAggById,
    totalByBucket: built.totalByBucket,
    bucketKeys,
    partial,
    note: partial ? "Coverage or freshness is partial for selected date." : undefined
  }), null, 2), { headers: { "content-type": "application/json; charset=utf-8" } })
}
