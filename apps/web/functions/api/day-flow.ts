import { resolveApiState } from "./_shared/state"
import type { DayFlowPayload, DayFlowBandSeries, DayFlowFocusItem } from "../../../../packages/shared/src/types/day-flow"

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
  has_more: number
  payload_json: string
  agitation_level?: number | null
}

type StreamSnapshot = {
  userId?: string
  displayName?: string
  title?: string
  viewerCount?: number
  language?: string
}

type SnapshotPayload = {
  streams?: StreamSnapshot[]
}

type DayScope = "today" | "rolling24h" | "yesterday" | "date"

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
const COLORS = ["#7aa2ff", "#4cdfff", "#8cf3c5", "#bd9bff", "#ff9ac6", "#f5cb6b", "#9fb3d8", "#d99fff", "#7df2c8", "#ffc38f"]
const OTHERS_COLOR = "#77829a"

function normalizeTop(raw: string | null): 10 | 20 | 50 {
  if (raw === "10") return 10
  if (raw === "50") return 50
  return 20
}

function normalizeBucket(raw: string | null): 5 | 10 {
  return raw === "10" ? 10 : 5
}

function normalizeMode(raw: string | null): "volume" | "share" {
  return raw === "share" ? "share" : "volume"
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function normalizeRangeMode(raw: string | null): DayScope | null {
  if (!raw) return null
  if (["today", "rolling24h", "yesterday", "date"].includes(raw)) return raw as DayScope
  if (["rolling", "rolling24", "rolling-24h", "rolling_24h", "24h"].includes(raw)) return "rolling24h"
  return null
}

function parseDay(rawDate: string | null, rawDay: string | null, rawRangeMode: string | null): { day: DayScope; date: Date } {
  const now = new Date()
  const normalizedMode = normalizeRangeMode(rawRangeMode) ?? normalizeRangeMode(rawDay)
  if (normalizedMode === "rolling24h") {
    return { day: "rolling24h", date: startOfUtcDay(now) }
  }

  if (normalizedMode === "yesterday") {
    return { day: "yesterday", date: new Date(startOfUtcDay(now).getTime() - DAY_MS) }
  }

  if (normalizedMode === "date" && rawDate) {
    const parsed = new Date(`${rawDate}T00:00:00.000Z`)
    if (!Number.isNaN(parsed.getTime())) {
      return { day: "date", date: parsed }
    }
  }

  if (normalizedMode === "today") {
    return { day: "today", date: startOfUtcDay(now) }
  }

  if (rawDay === "rolling24h") {
    return { day: "rolling24h", date: startOfUtcDay(now) }
  }

  if (rawDay === "yesterday") {
    return { day: "yesterday", date: new Date(startOfUtcDay(now).getTime() - DAY_MS) }
  }

  if (rawDate) {
    const parsed = new Date(`${rawDate}T00:00:00.000Z`)
    if (!Number.isNaN(parsed.getTime())) {
      return { day: "date", date: parsed }
    }
  }

  return { day: "today", date: startOfUtcDay(now) }
}

function toIsoMinute(date: Date): string {
  return `${date.toISOString().slice(0, 16)}:00.000Z`
}

function floorToBucket(iso: string, minutes: 5 | 10): string {
  const d = new Date(iso)
  d.setUTCSeconds(0, 0)
  const m = d.getUTCMinutes()
  d.setUTCMinutes(m - (m % minutes))
  return toIsoMinute(d)
}

function buildBuckets(day: Date, bucketMinutes: 5 | 10): string[] {
  const start = startOfUtcDay(day)
  const end = new Date(start.getTime() + DAY_MS)
  const buckets: string[] = []
  for (let ts = start.getTime(); ts < end.getTime(); ts += bucketMinutes * 60 * 1000) {
    buckets.push(toIsoMinute(new Date(ts)))
  }
  return buckets
}

function buildRollingBuckets(endIso: string, bucketMinutes: 5 | 10): string[] {
  const end = new Date(endIso)
  end.setUTCSeconds(0, 0)
  end.setUTCMinutes(end.getUTCMinutes() - (end.getUTCMinutes() % bucketMinutes))
  const start = new Date(end.getTime() - DAY_MS)
  const buckets: string[] = []
  for (let ts = start.getTime(); ts <= end.getTime(); ts += bucketMinutes * 60 * 1000) {
    buckets.push(toIsoMinute(new Date(ts)))
  }
  return buckets
}

function buildEmptyPayload(input: {
  dateScope: "today" | "rolling24h" | "yesterday" | "date"
  selectedDate: string
  bucketSize: 5 | 10
  topN: 10 | 20 | 50
  mode: "volume" | "share"
  updatedAt: string
  windowStart: string
  windowEnd: string
  rankingWindowStart: string
  rankingWindowEnd: string
  isRolling: boolean
}): DayFlowPayload {
  const buckets = input.isRolling
    ? buildRollingBuckets(input.windowEnd, input.bucketSize)
    : buildBuckets(new Date(`${input.selectedDate}T00:00:00.000Z`), input.bucketSize)

  return {
    ok: true,
    tool: "day-flow",
    source: "api",
    state: "empty",
    status: "empty",
    note: "No stream snapshots were available for the selected date.",
    coverageNote: `Top ${input.topN} + Others by viewer-minutes in selected window`,
    partialNote: "No activity layer in current Twitch snapshot ingest.",
    lastUpdated: input.updatedAt,
    selectedDate: input.selectedDate,
    bucketSize: input.bucketSize,
    topN: input.topN,
    defaultMode: input.mode,
    dateScope: input.dateScope,
    rangeMode: input.dateScope,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    rankingWindowStart: input.rankingWindowStart,
    rankingWindowEnd: input.rankingWindowEnd,
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

function json(body: DayFlowPayload): Response {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  })
}

function toBandSeries(input: {
  ordered: StreamAgg[]
  bucketSize: 5 | 10
  totalByBucket: number[]
  bucketKeys: string[]
}): DayFlowBandSeries[] {
  return input.ordered.map((stream, index) => {
    const peakViewers = stream.points.reduce((best, value) => Math.max(best, value), 0)
    const avgViewers = stream.points.length ? Math.round(stream.points.reduce((sum, value) => sum + value, 0) / stream.points.length) : 0
    const peakShare = stream.points.reduce((best, value, idx) => Math.max(best, input.totalByBucket[idx] > 0 ? value / input.totalByBucket[idx] : 0), 0)
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
      biggestRiseBucket: biggestRiseIndex >= 0 ? input.bucketKeys[biggestRiseIndex] ?? null : null,
      firstSeen: stream.firstSeenBucket,
      lastSeen: stream.lastSeenBucket,
      activityMax: null,
      buckets: stream.points.map((viewers, idx) => {
        const previous = idx > 0 ? stream.points[idx - 1] : viewers
        const share = input.totalByBucket[idx] > 0 ? viewers / input.totalByBucket[idx] : 0
        return {
          viewers,
          share,
          activityAvailable: false,
          peak: viewers === peakViewers && viewers > 0,
          rise: viewers > previous
        }
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
      return {
        streamerId: band.streamerId,
        name: band.name,
        viewers: current.viewers,
        share: current.share,
        momentum: current.viewers - previous.viewers,
        activity: null,
        activityAvailable: false
      }
    })
    .sort((a, b) => b.viewers - a.viewers)
    .slice(0, 5)
}

export const onRequest = async (context: { env: Env; request: Request }) => {
  const url = new URL(context.request.url)
  const parsed = parseDay(url.searchParams.get("date"), url.searchParams.get("day"), url.searchParams.get("rangeMode"))
  const selectedDate = startOfUtcDay(parsed.date).toISOString().slice(0, 10)
  const bucketSize = normalizeBucket(url.searchParams.get("bucket"))
  const topN = normalizeTop(url.searchParams.get("top"))
  const mode = normalizeMode(url.searchParams.get("mode") ?? url.searchParams.get("metric"))

  const dayStart = `${selectedDate}T00:00:00.000Z`
  const dayEnd = `${selectedDate}T24:00:00.000Z`
  const isRolling = parsed.day === "rolling24h"
  const isToday = parsed.day === "today"
  const queryEnd = `${selectedDate}T23:59:59.999Z`

  const fallbackQueryStart = isRolling ? toIsoMinute(new Date(Date.now() - DAY_MS)) : dayStart
  const fallbackQueryEnd = isRolling ? toIsoMinute(new Date()) : queryEnd

  const db = context.env.DB
  if (!db) {
    return json({
      ...buildEmptyPayload({ dateScope: parsed.day, selectedDate, bucketSize, topN, mode, updatedAt: new Date().toISOString(), windowStart: fallbackQueryStart, windowEnd: isRolling ? fallbackQueryEnd : dayEnd, rankingWindowStart: fallbackQueryStart, rankingWindowEnd: isRolling ? fallbackQueryEnd : dayEnd, isRolling }),
      source: "demo",
      state: "demo",
      status: "demo",
      note: "DB unavailable in this environment; returning demo-compatible payload shell."
    })
  }

  let rollingWindowStartIso: string | null = null
  let rollingWindowEndIso: string | null = null
  if (isRolling) {
    try {
      const latest = await db
        .prepare(
          `SELECT bucket_minute
           FROM minute_snapshots
           WHERE provider = 'twitch'
           ORDER BY bucket_minute DESC
           LIMIT 1`
        )
        .all()
      const latestBucket = latest.results[0]?.bucket_minute
      if (latestBucket) {
        rollingWindowEndIso = toIsoMinute(new Date(latestBucket))
        rollingWindowStartIso = toIsoMinute(new Date(new Date(rollingWindowEndIso).getTime() - DAY_MS))
      }
    } catch {
      // fallback to empty response below
    }
  }

  const queryStart = isRolling ? (rollingWindowStartIso ?? toIsoMinute(new Date(Date.now() - DAY_MS))) : dayStart
  const effectiveQueryEnd = isRolling ? (rollingWindowEndIso ?? toIsoMinute(new Date())) : queryEnd
  const rankingWindowStart = queryStart
  const rankingWindowEnd = isRolling ? effectiveQueryEnd : dayEnd

  let rows: { results: SnapshotRow[] }
  try {
    rows = await db
      .prepare(
        `SELECT bucket_minute, collected_at, has_more, payload_json, agitation_level
         FROM minute_snapshots
         WHERE provider = 'twitch' AND bucket_minute >= ? AND bucket_minute <= ?
         ORDER BY bucket_minute ASC`
      )
      .bind(queryStart, effectiveQueryEnd)
      .all()
  } catch {
    return json({
      ...buildEmptyPayload({ dateScope: parsed.day, selectedDate, bucketSize, topN, mode, updatedAt: new Date().toISOString(), windowStart: rankingWindowStart, windowEnd: rankingWindowEnd, rankingWindowStart, rankingWindowEnd, isRolling }),
      source: "api",
      state: "partial",
      status: "partial",
      note: "Snapshot query failed; returning safe fallback payload shell."
    })
  }

  if (!rows.results.length) {
    return json(buildEmptyPayload({
      dateScope: parsed.day,
      selectedDate,
      bucketSize,
      topN,
      mode,
      updatedAt: new Date().toISOString(),
      windowStart: rankingWindowStart,
      windowEnd: rankingWindowEnd,
      rankingWindowStart,
      rankingWindowEnd,
      isRolling
    }))
  }

  const windowEnd = isRolling ? (rows.results.at(-1)?.bucket_minute ?? new Date().toISOString()) : dayEnd
  const windowStart = isRolling ? toIsoMinute(new Date(new Date(windowEnd).getTime() - DAY_MS)) : dayStart
  const buckets = isRolling
    ? buildRollingBuckets(windowEnd, bucketSize)
    : buildBuckets(new Date(`${selectedDate}T00:00:00.000Z`), bucketSize)
  const bucketIndexByIso = new Map(buckets.map((bucket, index) => [bucket, index]))
  const streamAggById = new Map<string, StreamAgg>()
  const totalByBucket = new Array<number>(buckets.length).fill(0)

  for (const row of rows.results) {
    const bucketIso = floorToBucket(row.bucket_minute, bucketSize)
    const bucketIndex = bucketIndexByIso.get(bucketIso)
    if (bucketIndex === undefined) continue

    let payload: SnapshotPayload
    try {
      payload = JSON.parse(row.payload_json) as SnapshotPayload
    } catch {
      continue
    }
    for (const stream of payload.streams ?? []) {
      if (!stream.userId || !stream.displayName || typeof stream.viewerCount !== "number") continue
      if (stream.language && stream.language !== "en") continue

      let agg = streamAggById.get(stream.userId)
      if (!agg) {
        agg = {
          id: stream.userId,
          name: stream.displayName,
          title: stream.title ?? "",
          url: `https://www.twitch.tv/${stream.displayName}`,
          points: new Array<number>(buckets.length).fill(0),
          totalViewerMinutes: 0,
          firstSeenBucket: bucketIso,
          lastSeenBucket: bucketIso
        }
        streamAggById.set(stream.userId, agg)
      }

      agg.name = stream.displayName
      agg.title = stream.title ?? agg.title
      agg.points[bucketIndex] += stream.viewerCount
      agg.totalViewerMinutes += stream.viewerCount * bucketSize
      agg.firstSeenBucket = agg.firstSeenBucket ? (agg.firstSeenBucket < bucketIso ? agg.firstSeenBucket : bucketIso) : bucketIso
      agg.lastSeenBucket = agg.lastSeenBucket ? (agg.lastSeenBucket > bucketIso ? agg.lastSeenBucket : bucketIso) : bucketIso
      totalByBucket[bucketIndex] += stream.viewerCount
    }
  }

  const ordered = [...streamAggById.values()].sort((a, b) => b.totalViewerMinutes - a.totalViewerMinutes)
  if (!ordered.length) {
    return json(buildEmptyPayload({
      dateScope: parsed.day,
      selectedDate,
      bucketSize,
      topN,
      mode,
      updatedAt: rows.results.at(-1)?.collected_at ?? new Date().toISOString(),
      windowStart: rankingWindowStart,
      windowEnd: rankingWindowEnd,
      rankingWindowStart,
      rankingWindowEnd,
      isRolling
    }))
  }

  const topStreams = ordered.slice(0, topN)
  const others = ordered.slice(topN)
  const othersPoints = new Array<number>(buckets.length).fill(0)
  for (const stream of others) {
    for (let i = 0; i < stream.points.length; i += 1) {
      othersPoints[i] += stream.points[i]
    }
  }

  const topTotals = topStreams.reduce((sum, s) => sum + s.totalViewerMinutes, 0)
  const othersTotalViewerMinutes = ordered.reduce((sum, s) => sum + s.totalViewerMinutes, 0) - topTotals
  const withOthers: StreamAgg[] = [
    ...topStreams,
    {
      id: "others",
      name: "Others",
      title: "Grouped remaining streams",
      url: "",
      points: othersPoints,
      totalViewerMinutes: Math.max(0, othersTotalViewerMinutes),
      firstSeenBucket: rows.results[0]?.bucket_minute ?? null,
      lastSeenBucket: rows.results.at(-1)?.bucket_minute ?? null
    }
  ]

  const bands = toBandSeries({ ordered: withOthers, bucketSize, totalByBucket, bucketKeys: buckets })
  const latestCollectedAt = rows.results.at(-1)?.collected_at ?? new Date().toISOString()
  const nowBucketIso = floorToBucket(latestCollectedAt, bucketSize)
  const currentBucketIndex = Math.max(0, bucketIndexByIso.get(nowBucketIso) ?? (buckets.length - 1))
  const focusItems = buildFocusItems(bands, currentBucketIndex)

  const leaderBand = bands.filter((b) => !b.isOthers)[0]
  const biggestRiseBand = [...bands].filter((b) => !b.isOthers).sort((a, b) => {
    const aRise = a.buckets.reduce((best, bucket, idx, arr) => Math.max(best, idx > 0 ? bucket.viewers - arr[idx - 1].viewers : 0), 0)
    const bRise = b.buckets.reduce((best, bucket, idx, arr) => Math.max(best, idx > 0 ? bucket.viewers - arr[idx - 1].viewers : 0), 0)
    return bRise - aRise
  })[0]

  const dominanceCounts = new Map<string, number>()
  for (let i = 0; i < buckets.length; i += 1) {
    const leader = bands
      .filter((b) => !b.isOthers)
      .map((b) => ({ id: b.streamerId, name: b.name, viewers: b.buckets[i]?.viewers ?? 0 }))
      .sort((a, b) => b.viewers - a.viewers)[0]
    if (leader && leader.viewers > 0) {
      dominanceCounts.set(leader.name, (dominanceCounts.get(leader.name) ?? 0) + 1)
    }
  }
  const longestDominance = [...dominanceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A"

  const minutesSinceLatest = Math.floor((Date.now() - new Date(latestCollectedAt).getTime()) / 60_000)
  const baseState = resolveApiState({
    source: "api",
    hasSnapshot: true,
    isFresh: isRolling || isToday ? minutesSinceLatest <= 2 : true,
    isPartial: rows.results.some((r) => r.has_more === 1),
    hasError: false
  })
  const state: DayFlowPayload["state"] = baseState === "stale" ? "partial" : baseState
  const status: DayFlowPayload["status"] = state === "live" ? "live-today" : state

  return json({
    ok: true,
    tool: "day-flow",
    source: "api",
    state,
    status,
    note: state === "partial" ? "Coverage or freshness is partial for selected date." : undefined,
    coverageNote: `Top ${topN} + Others by viewer-minutes in selected window`,
    degradationNote: "Activity overlay is intentionally disabled in MVP until per-stream activity is fully wired.",
    partialNote: rows.results.some((r) => r.has_more === 1) ? "Collector reported partial page coverage in one or more buckets." : undefined,
    lastUpdated: latestCollectedAt,
    selectedDate,
    bucketSize,
    topN,
    defaultMode: mode,
    dateScope: parsed.day,
    rangeMode: parsed.day,
    windowStart,
    windowEnd,
    rankingWindowStart: windowStart,
    rankingWindowEnd: windowEnd,
    isRolling,
    summary: {
      peakLeader: leaderBand?.name ?? "N/A",
      longestDominance,
      highestActivity: "Activity unavailable",
      biggestRise: biggestRiseBand?.name ?? "N/A"
    },
    timeline: {
      dayStart: windowStart,
      dayEnd: windowEnd,
      nowBucket: isRolling || isToday ? nowBucketIso : null,
      bucketCount: buckets.length,
      futureBlankFrom: null
    },
    buckets,
    totalViewersByBucket: totalByBucket,
    bands,
    focusSnapshot: {
      selectedBucket: buckets[currentBucketIndex] ?? null,
      items: focusItems,
      strongestMomentum: focusItems.sort((a, b) => b.momentum - a.momentum)[0]?.name ?? "N/A",
      highestActivity: "Activity unavailable"
    },
    detailPanelSource: {
      defaultStreamerId: bands.find((b) => !b.isOthers)?.streamerId ?? null,
      streamers: bands
        .filter((band) => !band.isOthers)
        .map((band) => ({
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
  })
}
