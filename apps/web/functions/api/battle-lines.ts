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
    viewerCount?: number
    language?: string
  }>
}

type MetricMode = "viewers" | "indexed"
type DayMode = "today" | "yesterday" | "date"
type EventType = "peak" | "rise" | "reversal"

type BattleLine = {
  streamerId: string
  name: string
  color: string
  points: number[]
  viewerPoints: number[]
  peakViewers: number
  latestViewers: number
  risePerMin: number
  reversalCount: number
}

type BattleEvent = {
  type: EventType
  bucket: string
  label: string
  streamerId: string
  rivalId?: string
}

type BattleLinesPayload = {
  ok: true
  tool: "battle-lines"
  source: "api" | "demo"
  state: "live" | "partial" | "complete" | "empty" | "error" | "demo"
  updatedAt: string
  filters: {
    day: DayMode
    date: string
    top: 3 | 5 | 10
    metric: MetricMode
    bucketMinutes: 1 | 5 | 10
    focus: string
  }
  summary: {
    leader: string
    biggestRise: string
    peakMoment: string
    reversals: number
  }
  buckets: string[]
  lines: BattleLine[]
  focusStrip: Array<{ streamerId: string; name: string }>
  focusDetail: {
    streamerId: string
    name: string
    peakViewers: number
    latestViewers: number
    biggestRiseTime: string
    reversalCount: number
  }
  events: BattleEvent[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const COLORS = ["#7aa2ff", "#4cdfff", "#8cf3c5", "#bd9bff", "#ff9ac6", "#f5cb6b", "#9fb3d8", "#d99fff", "#7df2c8", "#ffc38f"]

function normalizeTop(raw: string | null): 3 | 5 | 10 {
  if (raw === "3") return 3
  if (raw === "10") return 10
  return 5
}

function normalizeBucket(raw: string | null): 1 | 5 | 10 {
  if (raw === "1") return 1
  if (raw === "10") return 10
  return 5
}

function normalizeMetric(raw: string | null): MetricMode {
  return raw === "indexed" ? "indexed" : "viewers"
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function parseDay(rawDate: string | null, rawDay: string | null): { day: DayMode; date: Date } {
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

function buildDemoPayload(filters: BattleLinesPayload["filters"]): BattleLinesPayload {
  const buckets = ["00:00", "06:00", "12:00", "18:00", "23:55"].map((hhmm) => `${filters.date}T${hhmm}:00.000Z`)
  const viewerSeries = [
    { streamerId: "demo-a", name: "Stream A", points: [1200, 1600, 3100, 4200, 3600] },
    { streamerId: "demo-b", name: "Stream B", points: [1800, 2100, 2600, 2800, 3000] },
    { streamerId: "demo-c", name: "Stream C", points: [900, 1000, 1400, 2500, 2100] },
    { streamerId: "demo-d", name: "Stream D", points: [700, 900, 1200, 1600, 1500] },
    { streamerId: "demo-e", name: "Stream E", points: [600, 750, 880, 1200, 1050] }
  ].slice(0, filters.top)

  const lines = viewerSeries.map((stream, i) => {
    const peak = Math.max(...stream.points)
    const indexed = stream.points.map((v) => (peak > 0 ? Math.round((v / peak) * 1000) / 10 : 0))
    const diffs = stream.points.slice(1).map((point, idx) => point - (stream.points[idx] ?? 0))
    const riseIdx = diffs.reduce((best, value, idx, arr) => (value > arr[best] ? idx : best), 0)
    return {
      streamerId: stream.streamerId,
      name: stream.name,
      color: COLORS[i % COLORS.length],
      points: filters.metric === "indexed" ? indexed : stream.points,
      viewerPoints: stream.points,
      peakViewers: peak,
      latestViewers: stream.points[stream.points.length - 1] ?? 0,
      risePerMin: diffs[riseIdx] ?? 0,
      reversalCount: i === 0 ? 2 : 1
    }
  })

  const focusId = lines.find((line) => line.streamerId === filters.focus)?.streamerId ?? lines[0]?.streamerId ?? ""
  const focusLine = lines.find((line) => line.streamerId === focusId) ?? lines[0]

  return {
    ok: true,
    tool: "battle-lines",
    source: "demo",
    state: "demo",
    updatedAt: new Date().toISOString(),
    filters: { ...filters, focus: focusId },
    summary: {
      leader: lines[0]?.name ?? "No live streams",
      biggestRise: lines.sort((a, b) => b.risePerMin - a.risePerMin)[0]?.name ?? "N/A",
      peakMoment: isoMinuteLabel(buckets[3] ?? buckets[0] ?? new Date().toISOString()),
      reversals: lines.reduce((sum, line) => sum + line.reversalCount, 0)
    },
    buckets,
    lines,
    focusStrip: lines.map((line) => ({ streamerId: line.streamerId, name: line.name })),
    focusDetail: {
      streamerId: focusLine?.streamerId ?? "",
      name: focusLine?.name ?? "N/A",
      peakViewers: focusLine?.peakViewers ?? 0,
      latestViewers: focusLine?.latestViewers ?? 0,
      biggestRiseTime: isoMinuteLabel(buckets[3] ?? buckets[0] ?? new Date().toISOString()),
      reversalCount: focusLine?.reversalCount ?? 0
    },
    events: [
      { type: "peak", bucket: buckets[3] ?? buckets[0] ?? new Date().toISOString(), label: "Peak", streamerId: lines[0]?.streamerId ?? "" },
      { type: "rise", bucket: buckets[2] ?? buckets[0] ?? new Date().toISOString(), label: "Rise", streamerId: lines[2]?.streamerId ?? lines[0]?.streamerId ?? "" },
      {
        type: "reversal",
        bucket: buckets[4] ?? buckets[0] ?? new Date().toISOString(),
        label: "Reversal",
        streamerId: lines[0]?.streamerId ?? "",
        rivalId: lines[1]?.streamerId
      }
    ]
  }
}

function json(body: BattleLinesPayload): Response {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const parsedDay = parseDay(url.searchParams.get("date"), url.searchParams.get("day"))
  const filters: BattleLinesPayload["filters"] = {
    day: parsedDay.day,
    date: startOfUtcDay(parsedDay.date).toISOString().slice(0, 10),
    top: normalizeTop(url.searchParams.get("top")),
    metric: normalizeMetric(url.searchParams.get("metric")),
    bucketMinutes: normalizeBucket(url.searchParams.get("bucket")),
    focus: url.searchParams.get("focus") ?? ""
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

  if (!rows.results.length) return json(buildDemoPayload(filters))

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
        if (stream.language && stream.language !== "en") continue

        nameById.set(stream.userId, stream.displayName)
        totalById.set(stream.userId, (totalById.get(stream.userId) ?? 0) + stream.viewerCount)

        const points = pointsById.get(stream.userId) ?? new Array(buckets.length).fill(0)
        points[idx] += stream.viewerCount
        pointsById.set(stream.userId, points)
      }
    }

    const rankedIds = [...totalById.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
    const topIds = rankedIds.slice(0, filters.top)

    const lines = topIds.map((streamerId, i) => {
      const viewerPoints = pointsById.get(streamerId) ?? new Array(buckets.length).fill(0)
      const peakViewers = viewerPoints.reduce((best, value) => Math.max(best, value), 0)
      const points =
        filters.metric === "indexed"
          ? viewerPoints.map((value) => (peakViewers > 0 ? Math.round((value / peakViewers) * 1000) / 10 : 0))
          : viewerPoints

      let risePerMin = 0
      for (let idx = 1; idx < viewerPoints.length; idx += 1) {
        risePerMin = Math.max(risePerMin, (viewerPoints[idx] - viewerPoints[idx - 1]) / filters.bucketMinutes)
      }

      let reversalCount = 0
      for (const rivalId of topIds) {
        if (rivalId === streamerId) continue
        const rivalPoints = pointsById.get(rivalId) ?? []
        for (let idx = 1; idx < viewerPoints.length; idx += 1) {
          const prevDelta = (viewerPoints[idx - 1] ?? 0) - (rivalPoints[idx - 1] ?? 0)
          const nextDelta = (viewerPoints[idx] ?? 0) - (rivalPoints[idx] ?? 0)
          if (prevDelta === 0 || nextDelta === 0) continue
          if ((prevDelta > 0 && nextDelta < 0) || (prevDelta < 0 && nextDelta > 0)) reversalCount += 1
        }
      }

      return {
        streamerId,
        name: nameById.get(streamerId) ?? streamerId,
        color: COLORS[i % COLORS.length],
        points,
        viewerPoints,
        peakViewers,
        latestViewers: viewerPoints[viewerPoints.length - 1] ?? 0,
        risePerMin,
        reversalCount
      }
    })

    if (!lines.length) {
      return json({
        ...buildDemoPayload(filters),
        source: "api",
        state: "empty",
        lines: [],
        focusStrip: [],
        summary: { leader: "No live streams", biggestRise: "N/A", peakMoment: "N/A", reversals: 0 },
        focusDetail: { streamerId: "", name: "N/A", peakViewers: 0, latestViewers: 0, biggestRiseTime: "N/A", reversalCount: 0 },
        events: []
      })
    }

    const focusId = lines.find((line) => line.streamerId === filters.focus)?.streamerId ?? lines[0]?.streamerId ?? ""
    const focusLine = lines.find((line) => line.streamerId === focusId) ?? lines[0]

    const events: BattleEvent[] = []
    for (const line of lines) {
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

    if (lines.length >= 2) {
      const a = lines[0]
      const b = lines[1]
      for (let idx = 1; idx < buckets.length; idx += 1) {
        const prev = (a.viewerPoints[idx - 1] ?? 0) - (b.viewerPoints[idx - 1] ?? 0)
        const next = (a.viewerPoints[idx] ?? 0) - (b.viewerPoints[idx] ?? 0)
        if ((prev > 0 && next < 0) || (prev < 0 && next > 0)) {
          events.push({
            type: "reversal",
            bucket: buckets[idx] ?? buckets[0] ?? new Date().toISOString(),
            label: `${a.name} ⇄ ${b.name}`,
            streamerId: a.streamerId,
            rivalId: b.streamerId
          })
        }
      }
    }

    const peakEvent = events.find((event) => event.type === "peak")
    const biggestRise = [...lines].sort((a, b) => b.risePerMin - a.risePerMin)[0]
    const state: BattleLinesPayload["state"] =
      filters.day === "today" ? "live" : rows.results.length >= 100 ? "complete" : "partial"

    return json({
      ok: true,
      tool: "battle-lines",
      source: "api",
      state,
      updatedAt: rows.results[rows.results.length - 1]?.collected_at ?? new Date().toISOString(),
      filters: { ...filters, focus: focusId },
      summary: {
        leader: lines[0]?.name ?? "No live streams",
        biggestRise: biggestRise?.name ?? "N/A",
        peakMoment: peakEvent?.bucket ? isoMinuteLabel(peakEvent.bucket) : "N/A",
        reversals: events.filter((event) => event.type === "reversal").length
      },
      buckets,
      lines,
      focusStrip: lines.map((line) => ({ streamerId: line.streamerId, name: line.name })),
      focusDetail: {
        streamerId: focusLine?.streamerId ?? "",
        name: focusLine?.name ?? "N/A",
        peakViewers: focusLine?.peakViewers ?? 0,
        latestViewers: focusLine?.latestViewers ?? 0,
        biggestRiseTime:
          events.find((event) => event.type === "rise" && event.streamerId === (focusLine?.streamerId ?? ""))?.bucket
            ? isoMinuteLabel(
                events.find((event) => event.type === "rise" && event.streamerId === (focusLine?.streamerId ?? ""))?.bucket ??
                  ""
              )
            : "N/A",
        reversalCount: focusLine?.reversalCount ?? 0
      },
      events
    })
  } catch {
    return json(buildDemoPayload(filters))
  }
}
