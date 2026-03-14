import type { PagesFunction } from "@cloudflare/workers-types"

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
    title?: string
    viewerCount?: number
    startedAt?: string
    language?: string
  }>
}

type DayFlowSeries = {
  streamerId: string
  name: string
  isOthers: boolean
  color: string
  totalViewerMinutes: number
  points: number[]
}

type DayFlowPayload = {
  ok: true
  source: "api" | "demo"
  tool: "day-flow"
  updatedAt: string
  state: "live" | "partial" | "complete" | "empty" | "demo"
  filters: {
    day: "today" | "yesterday" | "date"
    date: string
    bucketMinutes: 5 | 10
    top: 10 | 20 | 50
    metric: "volume" | "share"
  }
  summary: {
    peakLeader: string
    longestDominance: string
    hottestWindow: string
    biggestRise: string
    activity: string
  }
  timeFocus: {
    selectedTime: string
    rank1: string
    rank2: string
    peakShare: string
    hottestStream: string
  }
  buckets: string[]
  streams: DayFlowSeries[]
}

const COLORS = ["#ff8f8f", "#6dd3ff", "#9bff8d", "#f5cb6b", "#be9bff", "#70f5d0", "#ff9bd7"]
const OTHERS_COLOR = "#8b94a8"
const DAY_MS = 24 * 60 * 60 * 1000

function normalizeTop(raw: string | null): 10 | 20 | 50 {
  if (raw === "10") return 10
  if (raw === "50") return 50
  return 20
}

function normalizeBucket(raw: string | null): 5 | 10 {
  return raw === "10" ? 10 : 5
}

function normalizeMetric(raw: string | null): "volume" | "share" {
  return raw === "share" ? "share" : "volume"
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function parseDay(rawDate: string | null, rawDay: string | null): { day: DayFlowPayload["filters"]["day"]; date: Date } {
  const now = new Date()
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

function isoMinuteLabel(iso: string): string {
  return iso.slice(11, 16)
}

function toIsoMinute(date: Date): string {
  return date.toISOString().slice(0, 16) + ":00.000Z"
}

function buildBuckets(day: Date, minutes: 5 | 10, now: Date): string[] {
  const start = startOfUtcDay(day)
  const end = new Date(start.getTime() + DAY_MS)
  const isToday = start.getTime() === startOfUtcDay(now).getTime()
  const limit = isToday ? now : end

  const buckets: string[] = []
  for (let ts = start.getTime(); ts < limit.getTime(); ts += minutes * 60 * 1000) {
    buckets.push(toIsoMinute(new Date(ts)))
  }
  return buckets
}

function floorToBucket(iso: string, minutes: 5 | 10): string {
  const d = new Date(iso)
  d.setUTCSeconds(0, 0)
  const m = d.getUTCMinutes()
  d.setUTCMinutes(m - (m % minutes))
  return toIsoMinute(d)
}

function buildDemoPayload(filters: DayFlowPayload["filters"]): DayFlowPayload {
  const buckets = ["00:00", "06:00", "12:00", "18:00", "23:55"].map((hhmm) => `${filters.date}T${hhmm}:00.000Z`)
  const streams: DayFlowSeries[] = [
    { streamerId: "demo-a", name: "Stream A", isOthers: false, color: COLORS[0], totalViewerMinutes: 220000, points: [1800, 2200, 3900, 5100, 4200] },
    { streamerId: "demo-b", name: "Stream B", isOthers: false, color: COLORS[1], totalViewerMinutes: 180000, points: [1200, 1600, 2300, 2600, 2400] },
    { streamerId: "demo-c", name: "Stream C", isOthers: false, color: COLORS[2], totalViewerMinutes: 130000, points: [900, 1000, 1200, 1700, 1500] },
    { streamerId: "others", name: "Others", isOthers: true, color: OTHERS_COLOR, totalViewerMinutes: 90000, points: [800, 1100, 1300, 1800, 1600] }
  ]

  return {
    ok: true,
    source: "demo",
    tool: "day-flow",
    updatedAt: new Date().toISOString(),
    state: "demo",
    filters,
    summary: {
      peakLeader: "Stream A",
      longestDominance: "18:00-23:00",
      hottestWindow: "20:00 around",
      biggestRise: "Stream C",
      activity: "Activity signal unavailable"
    },
    timeFocus: {
      selectedTime: "19:35",
      rank1: "Stream A",
      rank2: "Stream B",
      peakShare: "Stream A",
      hottestStream: "Activity signal unavailable"
    },
    buckets,
    streams
  }
}


function buildEmptyPayload(filters: DayFlowPayload["filters"], updatedAt: string): DayFlowPayload {
  const now = new Date()
  const buckets = buildBuckets(new Date(`${filters.date}T00:00:00.000Z`), filters.bucketMinutes, now)

  return {
    ok: true,
    source: "api",
    tool: "day-flow",
    updatedAt,
    state: "empty",
    filters,
    summary: {
      peakLeader: "No live streams",
      longestDominance: "N/A",
      hottestWindow: buckets[0] ? isoMinuteLabel(buckets[0]) : "N/A",
      biggestRise: "N/A",
      activity: "Activity signal unavailable (Twitch snapshot-only)"
    },
    timeFocus: {
      selectedTime: buckets[buckets.length - 1] ? isoMinuteLabel(buckets[buckets.length - 1]) : "N/A",
      rank1: "N/A",
      rank2: "N/A",
      peakShare: "N/A",
      hottestStream: "Activity signal unavailable"
    },
    buckets,
    streams: [
      {
        streamerId: "others",
        name: "Others",
        isOthers: true,
        color: OTHERS_COLOR,
        totalViewerMinutes: 0,
        points: new Array(buckets.length).fill(0)
      }
    ]
  }
}

function json(body: DayFlowPayload): Response {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const parsedDay = parseDay(url.searchParams.get("date"), url.searchParams.get("day"))
  const filters: DayFlowPayload["filters"] = {
    day: parsedDay.day,
    date: startOfUtcDay(parsedDay.date).toISOString().slice(0, 10),
    bucketMinutes: normalizeBucket(url.searchParams.get("bucket")),
    top: normalizeTop(url.searchParams.get("top")),
    metric: normalizeMetric(url.searchParams.get("metric"))
  }

  const db = context.env.DB
  if (!db) return json(buildDemoPayload(filters))

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
    const bucketIndex = new Map(buckets.map((b, i) => [b, i]))

    const streamNameById = new Map<string, string>()
    const totalsById = new Map<string, number>()
    const pointsById = new Map<string, number[]>()
    const totalByBucket = new Array(buckets.length).fill(0)

    for (const row of rows.results) {
      const bucketIso = floorToBucket(row.bucket_minute, filters.bucketMinutes)
      const idx = bucketIndex.get(bucketIso)
      if (idx === undefined) continue

      const payload = JSON.parse(row.payload_json) as SnapshotPayload
      for (const stream of payload.streams ?? []) {
        if (!stream.userId || !stream.displayName || typeof stream.viewerCount !== "number") continue
        if (stream.language && stream.language !== "en") continue

        streamNameById.set(stream.userId, stream.displayName)
        totalByBucket[idx] += stream.viewerCount
        totalsById.set(stream.userId, (totalsById.get(stream.userId) ?? 0) + stream.viewerCount * filters.bucketMinutes)

        const points = pointsById.get(stream.userId) ?? new Array(buckets.length).fill(0)
        points[idx] += stream.viewerCount
        pointsById.set(stream.userId, points)
      }
    }

    const sortedIds = [...totalsById.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
    if (!sortedIds.length) return json(buildEmptyPayload(filters, rows.results[rows.results.length - 1]?.collected_at ?? new Date().toISOString()))
    const topIds = sortedIds.slice(0, filters.top)

    const streams: DayFlowSeries[] = topIds.map((id, i) => ({
      streamerId: id,
      name: streamNameById.get(id) ?? id,
      isOthers: false,
      color: COLORS[i % COLORS.length],
      totalViewerMinutes: totalsById.get(id) ?? 0,
      points: pointsById.get(id) ?? new Array(buckets.length).fill(0)
    }))

    const othersPoints = totalByBucket.map((bucketTotal, idx) => {
      const topTotal = streams.reduce((sum, stream) => sum + (stream.points[idx] ?? 0), 0)
      return Math.max(0, bucketTotal - topTotal)
    })
    const othersTotal = othersPoints.reduce((sum, value) => sum + value * filters.bucketMinutes, 0)

    streams.push({
      streamerId: "others",
      name: "Others",
      isOthers: true,
      color: OTHERS_COLOR,
      totalViewerMinutes: othersTotal,
      points: othersPoints
    })

    const peakIndex = totalByBucket.reduce((best, value, idx, arr) => (value > arr[best] ? idx : best), 0)
    const finalIndex = Math.max(0, buckets.length - 1)
    const rankedNow = [...streams]
      .filter((stream) => !stream.isOthers)
      .sort((a, b) => (b.points[finalIndex] ?? 0) - (a.points[finalIndex] ?? 0))

    const leader = sortedIds[0] ? streamNameById.get(sortedIds[0]) ?? sortedIds[0] : "No live streams"
    const state: DayFlowPayload["state"] =
      filters.day === "today" ? "live" : rows.results.length >= 100 ? "complete" : "partial"

    return json({
      ok: true,
      source: "api",
      tool: "day-flow",
      updatedAt: rows.results[rows.results.length - 1]?.collected_at ?? new Date().toISOString(),
      state,
      filters,
      summary: {
        peakLeader: leader,
        longestDominance: leader,
        hottestWindow: buckets[peakIndex] ? isoMinuteLabel(buckets[peakIndex]) : "N/A",
        biggestRise: rankedNow[0]?.name ?? "N/A",
        activity: "Activity signal unavailable (Twitch snapshot-only)"
      },
      timeFocus: {
        selectedTime: buckets[finalIndex] ? isoMinuteLabel(buckets[finalIndex]) : "N/A",
        rank1: rankedNow[0]?.name ?? "N/A",
        rank2: rankedNow[1]?.name ?? "N/A",
        peakShare: leader,
        hottestStream: "Activity signal unavailable"
      },
      buckets,
      streams
    })
  } catch {
    return json(buildDemoPayload(filters))
  }
}
