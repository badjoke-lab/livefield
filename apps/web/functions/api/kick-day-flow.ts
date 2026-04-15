import type {
  DayFlowPayload,
  DayFlowBandSeries,
  DayFlowFocusItem,
} from "../../../../packages/shared/src/types/day-flow"

type Env = {
  DB?: D1Database
}

type DayScope = "today" | "rolling24h" | "yesterday" | "date"

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

function normalizeScope(raw: string | null): DayScope {
  if (raw === "rolling24h" || raw === "yesterday" || raw === "date") return raw
  return "today"
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

function floorBucket(iso: string, minutes: 5 | 10): string {
  const d = new Date(iso)
  d.setUTCSeconds(0, 0)
  d.setUTCMinutes(d.getUTCMinutes() - (d.getUTCMinutes() % minutes))
  return toIsoMinute(d)
}

function buildDayBuckets(day: string, size: 5 | 10): string[] {
  const start = new Date(`${day}T00:00:00.000Z`)
  const out: string[] = []
  for (let ts = start.getTime(); ts < start.getTime() + DAY_MS; ts += size * 60_000) {
    out.push(toIsoMinute(new Date(ts)))
  }
  return out
}

function buildRollingBuckets(endIso: string, size: 5 | 10): string[] {
  const end = new Date(endIso)
  end.setUTCSeconds(0, 0)
  end.setUTCMinutes(end.getUTCMinutes() - (end.getUTCMinutes() % size))
  const out: string[] = []
  for (let ts = end.getTime() - DAY_MS; ts <= end.getTime(); ts += size * 60_000) {
    out.push(toIsoMinute(new Date(ts)))
  }
  return out
}

function buildEmptyPayload(input: {
  scope: DayScope
  selectedDate: string
  bucketSize: 5 | 10
  topN: 10 | 20 | 50
  mode: "volume" | "share"
  updatedAt: string
  coverageNote: string
  note: string
  windowStart: string
  windowEnd: string
  isRolling: boolean
  state?: DayFlowPayload["state"]
  status?: DayFlowPayload["status"]
}): DayFlowPayload {
  const buckets = input.isRolling
    ? buildRollingBuckets(input.windowEnd, input.bucketSize)
    : buildDayBuckets(input.selectedDate, input.bucketSize)

  return {
    ok: true,
    tool: "day-flow",
    source: "api",
    state: input.state ?? "empty",
    status: input.status ?? "empty",
    note: input.note,
    coverageNote: input.coverageNote,
    partialNote: "Kick Day Flow uses snapshot polling, so sparse periods can appear.",
    lastUpdated: input.updatedAt,
    selectedDate: input.selectedDate,
    bucketSize: input.bucketSize,
    topN: input.topN,
    valueMode: input.mode,
    defaultMode: input.mode,
    dateScope: input.scope,
    rangeMode: input.scope,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    rankingWindowStart: input.windowStart,
    rankingWindowEnd: input.windowEnd,
    isRolling: input.isRolling,
    summary: {
      peakLeader: "N/A",
      longestDominance: "N/A",
      highestActivity: "Activity unavailable",
      biggestRise: "N/A",
    },
    timeline: {
      dayStart: input.windowStart,
      dayEnd: input.windowEnd,
      nowBucket: null,
      bucketCount: buckets.length,
      futureBlankFrom: null,
    },
    buckets,
    totalViewersByBucket: new Array(buckets.length).fill(0),
    bands: [],
    focusSnapshot: {
      selectedBucket: null,
      items: [],
      strongestMomentum: "N/A",
      highestActivity: "Activity unavailable",
    },
    detailPanelSource: {
      defaultStreamerId: null,
      streamers: [],
    },
    activity: {
      available: false,
      note: "Activity unavailable for Kick Day Flow.",
    },
  }
}

function toBandSeries(input: {
  ordered: StreamAgg[]
  totalByBucket: number[]
  bucketKeys: string[]
}): DayFlowBandSeries[] {
  return input.ordered.map((stream, index) => {
    const peakViewers = stream.points.reduce((best, value) => Math.max(best, value), 0)
    const avgViewers = stream.points.length
      ? Math.round(stream.points.reduce((sum, value) => sum + value, 0) / stream.points.length)
      : 0
    const peakShare = stream.points.reduce((best, value, idx) => {
      const total = input.totalByBucket[idx] ?? 0
      return Math.max(best, total > 0 ? value / total : 0)
    }, 0)

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
        const total = input.totalByBucket[idx] ?? 0
        return {
          viewers,
          share: total > 0 ? viewers / total : 0,
          activityAvailable: false,
          peak: viewers === peakViewers && viewers > 0,
          rise: viewers > previous,
        }
      }),
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
        activityAvailable: false,
      }
    })
    .sort((a, b) => b.viewers - a.viewers)
    .slice(0, 5)
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

async function fetchLatestUsableRun(db: D1Database): Promise<RunRow | null> {
  const row = await db.prepare(`
    SELECT
      kr.id,
      kr.created_at,
      kr.state,
      kr.coverage_note,
      kr.observed_count
    FROM kick_runs kr
    WHERE kr.state != 'error'
      AND COALESCE(kr.observed_count, 0) > 0
      AND EXISTS (
        SELECT 1
        FROM kick_livestream_snapshots kls
        WHERE kls.run_id = kr.id
          AND kls.slug IS NOT NULL
          AND TRIM(kls.slug) != ''
      )
    ORDER BY kr.created_at DESC, kr.id DESC
    LIMIT 1
  `).first<RunRow>()

  return row ?? null
}

async function fetchSnapshotsForRunIds(db: D1Database, runIds: number[]): Promise<Map<number, SnapshotRow[]>> {
  const out = new Map<number, SnapshotRow[]>()
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
      if (!Number.isFinite(runId)) continue
      const list = out.get(runId) ?? []
      list.push(row)
      out.set(runId, list)
    }
  }

  return out
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const db = context.env.DB
  const scope = normalizeScope(url.searchParams.get("day") ?? url.searchParams.get("rangeMode"))
  const bucketSize = normalizeBucket(url.searchParams.get("bucket"))
  const topN = normalizeTop(url.searchParams.get("top"))
  const mode = normalizeMode(url.searchParams.get("mode") ?? url.searchParams.get("metric"))

  const now = new Date()
  const todayStart = startOfUtcDay(now)
  let selectedDate = todayStart.toISOString().slice(0, 10)

  if (scope === "yesterday") {
    selectedDate = new Date(todayStart.getTime() - DAY_MS).toISOString().slice(0, 10)
  } else if (scope === "date" && url.searchParams.get("date")) {
    selectedDate = String(url.searchParams.get("date"))
  }

  if (!db) {
    return new Response(JSON.stringify(buildEmptyPayload({
      scope,
      selectedDate,
      bucketSize,
      topN,
      mode,
      updatedAt: now.toISOString(),
      coverageNote: "Kick D1 binding is not available.",
      note: "Kick Day Flow DB binding is missing.",
      windowStart: `${selectedDate}T00:00:00.000Z`,
      windowEnd: `${selectedDate}T23:59:59.999Z`,
      isRolling: scope === "rolling24h",
      state: "error",
      status: "error",
    })), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    })
  }

  let queryStartIso = `${selectedDate}T00:00:00.000Z`
  let queryEndIso = `${selectedDate}T23:59:59.999Z`
  let runs: RunRow[] = []
  let latestCoverageNote = "Kick Day Flow is built from stored snapshot history."

  try {
    if (scope === "rolling24h") {
      const latestUsable = await fetchLatestUsableRun(db)
      const latestIso = normalizeDbTimestamp(latestUsable?.created_at ?? null)
      if (!latestIso) {
        return new Response(JSON.stringify(buildEmptyPayload({
          scope,
          selectedDate,
          bucketSize,
          topN,
          mode,
          updatedAt: now.toISOString(),
          coverageNote: "No usable Kick runs are stored yet.",
          note: "No Kick day-flow history is available yet.",
          windowStart: toIsoMinute(new Date(now.getTime() - DAY_MS)),
          windowEnd: toIsoMinute(now),
          isRolling: true,
        })), {
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
        })
      }
      queryEndIso = latestIso
      queryStartIso = toIsoMinute(new Date(new Date(queryEndIso).getTime() - DAY_MS))
      runs = await fetchUsableRunsInRange(db, toDbSecond(new Date(queryStartIso)), toDbSecond(new Date(queryEndIso)))
      selectedDate = queryEndIso.slice(0, 10)
    } else {
      const startIso = `${selectedDate}T00:00:00.000Z`
      const endIso = scope === "today" ? now.toISOString() : `${selectedDate}T23:59:59.999Z`
      queryStartIso = startIso
      queryEndIso = endIso
      runs = await fetchUsableRunsInRange(db, toDbSecond(new Date(startIso)), toDbSecond(new Date(endIso)))
    }
  } catch (error) {
    return new Response(JSON.stringify(buildEmptyPayload({
      scope,
      selectedDate,
      bucketSize,
      topN,
      mode,
      updatedAt: now.toISOString(),
      coverageNote: "Kick day-flow query failed.",
      note: error instanceof Error ? error.message : "Unknown Kick day-flow query error",
      windowStart: queryStartIso,
      windowEnd: queryEndIso,
      isRolling: scope === "rolling24h",
      state: "error",
      status: "error",
    })), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    })
  }

  const buckets = scope === "rolling24h"
    ? buildRollingBuckets(queryEndIso, bucketSize)
    : buildDayBuckets(selectedDate, bucketSize)

  if (!runs.length) {
    return new Response(JSON.stringify(buildEmptyPayload({
      scope,
      selectedDate,
      bucketSize,
      topN,
      mode,
      updatedAt: queryEndIso,
      coverageNote: "No usable Kick runs matched the selected window.",
      note: "No Kick day-flow history is available for the selected window.",
      windowStart: scope === "rolling24h" ? queryStartIso : `${selectedDate}T00:00:00.000Z`,
      windowEnd: scope === "rolling24h" ? queryEndIso : `${selectedDate}T23:59:59.999Z`,
      isRolling: scope === "rolling24h",
    })), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    })
  }

  const bucketToRun = new Map<string, RunRow>()
  for (const run of runs) {
    const createdIso = normalizeDbTimestamp(run.created_at)
    if (!createdIso) continue
    bucketToRun.set(floorBucket(createdIso, bucketSize), run)
  }

  const selectedRunIds = Array.from(new Set(
    buckets
      .map((bucket) => bucketToRun.get(bucket))
      .filter((run): run is RunRow => Boolean(run))
      .map((run) => Number(run.id))
      .filter((id) => Number.isFinite(id))
  ))

  const snapshotsByRun = await fetchSnapshotsForRunIds(db, selectedRunIds)
  const streamAggById = new Map<string, StreamAgg>()
  const totalByBucket = new Array<number>(buckets.length).fill(0)
  const bucketHasRun = buckets.map((bucket) => bucketToRun.has(bucket))
  let latestObservedBucket: string | null = null

  for (let bucketIndex = 0; bucketIndex < buckets.length; bucketIndex += 1) {
    const bucket = buckets[bucketIndex]
    const run = bucketToRun.get(bucket)
    if (!run) continue

    latestObservedBucket = bucket
    latestCoverageNote = typeof run.coverage_note === "string" && run.coverage_note.trim()
      ? run.coverage_note
      : latestCoverageNote

    const runId = Number(run.id)
    const snapshots = snapshotsByRun.get(runId) ?? []
    for (const snapshot of snapshots) {
      const slug = typeof snapshot.slug === "string" ? snapshot.slug : null
      if (!slug) continue

      const viewers = typeof snapshot.viewer_count === "number"
        ? snapshot.viewer_count
        : Number(snapshot.viewer_count ?? 0)

      let agg = streamAggById.get(slug)
      if (!agg) {
        agg = {
          id: slug,
          name: slug,
          title: typeof snapshot.stream_title === "string" && snapshot.stream_title.trim() ? snapshot.stream_title : slug,
          url: `https://kick.com/${slug}`,
          points: new Array<number>(buckets.length).fill(0),
          totalViewerMinutes: 0,
          firstSeenBucket: bucket,
          lastSeenBucket: bucket,
        }
        streamAggById.set(slug, agg)
      }

      agg.title = typeof snapshot.stream_title === "string" && snapshot.stream_title.trim() ? snapshot.stream_title : agg.title
      agg.points[bucketIndex] = viewers
      agg.totalViewerMinutes += viewers * bucketSize
      agg.firstSeenBucket = agg.firstSeenBucket ? (agg.firstSeenBucket < bucket ? agg.firstSeenBucket : bucket) : bucket
      agg.lastSeenBucket = agg.lastSeenBucket ? (agg.lastSeenBucket > bucket ? agg.lastSeenBucket : bucket) : bucket
      totalByBucket[bucketIndex] += viewers
    }
  }

  const ordered = [...streamAggById.values()].sort((a, b) => b.totalViewerMinutes - a.totalViewerMinutes)
  if (!ordered.length) {
    return new Response(JSON.stringify(buildEmptyPayload({
      scope,
      selectedDate,
      bucketSize,
      topN,
      mode,
      updatedAt: queryEndIso,
      coverageNote: latestCoverageNote,
      note: "Kick snapshots were found, but no visible stream rows qualified for day-flow.",
      windowStart: scope === "rolling24h" ? queryStartIso : `${selectedDate}T00:00:00.000Z`,
      windowEnd: scope === "rolling24h" ? queryEndIso : `${selectedDate}T23:59:59.999Z`,
      isRolling: scope === "rolling24h",
    })), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    })
  }

  const topStreams = ordered.slice(0, topN)
  const others = ordered.slice(topN)
  const othersPoints = new Array<number>(buckets.length).fill(0)
  for (const stream of others) {
    for (let i = 0; i < stream.points.length; i += 1) {
      othersPoints[i] += stream.points[i]
    }
  }

  const withOthers: StreamAgg[] = [...topStreams]
  const othersTotalViewerMinutes = others.reduce((sum, item) => sum + item.totalViewerMinutes, 0)
  if (othersTotalViewerMinutes > 0) {
    withOthers.push({
      id: "others",
      name: "Others",
      title: "Grouped remaining streams",
      url: "",
      points: othersPoints,
      totalViewerMinutes: othersTotalViewerMinutes,
      firstSeenBucket: latestObservedBucket,
      lastSeenBucket: latestObservedBucket,
    })
  }

  const bands = toBandSeries({
    ordered: withOthers,
    totalByBucket,
    bucketKeys: buckets,
  })

  const currentBucketIndex = latestObservedBucket
    ? Math.max(0, buckets.indexOf(latestObservedBucket))
    : Math.max(0, buckets.length - 1)

  const focusItems = buildFocusItems(bands, currentBucketIndex)
  const leaderBand = [...bands].filter((b) => !b.isOthers).sort((a, b) => b.totalViewerMinutes - a.totalViewerMinutes)[0] ?? null
  const biggestRiseBand = [...bands]
    .filter((b) => !b.isOthers)
    .sort((a, b) => {
      const aRise = a.buckets.reduce((best, bucket, idx, arr) => Math.max(best, idx > 0 ? bucket.viewers - arr[idx - 1].viewers : 0), 0)
      const bRise = b.buckets.reduce((best, bucket, idx, arr) => Math.max(best, idx > 0 ? bucket.viewers - arr[idx - 1].viewers : 0), 0)
      return bRise - aRise
    })[0] ?? null

  const dominanceCounts = new Map<string, number>()
  for (let i = 0; i < buckets.length; i += 1) {
    const leader = bands
      .filter((b) => !b.isOthers)
      .map((b) => ({ name: b.name, viewers: b.buckets[i]?.viewers ?? 0 }))
      .sort((a, b) => b.viewers - a.viewers)[0]
    if (leader && leader.viewers > 0) {
      dominanceCounts.set(leader.name, (dominanceCounts.get(leader.name) ?? 0) + 1)
    }
  }
  const longestDominance = [...dominanceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A"
  const latestRun = runs.at(-1) ?? runs[0]
  const latestUpdated = normalizeDbTimestamp(latestRun?.created_at ?? null) ?? queryEndIso
  const hasGapsInsideObserved = buckets
    .slice(0, currentBucketIndex + 1)
    .some((_, idx) => !bucketHasRun[idx])

  let state: DayFlowPayload["state"]
  let status: DayFlowPayload["status"]

  if (scope === "today" || scope === "rolling24h") {
    state = hasGapsInsideObserved ? "partial" : "live"
    status = state === "live" ? "live-today" : "partial"
  } else {
    state = hasGapsInsideObserved ? "partial" : "complete"
    status = state
  }

  const payload: DayFlowPayload = {
    ok: true,
    tool: "day-flow",
    source: "api",
    state,
    status,
    note: hasGapsInsideObserved
      ? "Some Kick snapshot buckets are missing and were left blank."
      : "Kick Day Flow is built from per-stream snapshot history.",
    coverageNote: latestCoverageNote,
    partialNote: "Kick Day Flow uses snapshot polling, so sparse periods can appear.",
    lastUpdated: latestUpdated,
    selectedDate,
    bucketSize,
    topN,
    valueMode: mode,
    defaultMode: mode,
    dateScope: scope,
    rangeMode: scope,
    windowStart: scope === "rolling24h" ? queryStartIso : `${selectedDate}T00:00:00.000Z`,
    windowEnd: scope === "rolling24h" ? queryEndIso : `${selectedDate}T23:59:59.999Z`,
    rankingWindowStart: scope === "rolling24h" ? queryStartIso : `${selectedDate}T00:00:00.000Z`,
    rankingWindowEnd: scope === "rolling24h" ? queryEndIso : `${selectedDate}T23:59:59.999Z`,
    isRolling: scope === "rolling24h",
    summary: {
      peakLeader: leaderBand?.name ?? "N/A",
      longestDominance,
      highestActivity: "Activity unavailable",
      biggestRise: biggestRiseBand?.name ?? "N/A",
    },
    timeline: {
      dayStart: scope === "rolling24h" ? queryStartIso : `${selectedDate}T00:00:00.000Z`,
      dayEnd: scope === "rolling24h" ? queryEndIso : `${selectedDate}T23:59:59.999Z`,
      nowBucket: latestObservedBucket,
      bucketCount: buckets.length,
      futureBlankFrom: scope === "today" ? latestObservedBucket : null,
    },
    buckets,
    totalViewersByBucket: totalByBucket,
    bands,
    focusSnapshot: {
      selectedBucket: buckets[currentBucketIndex] ?? null,
      items: focusItems,
      strongestMomentum: [...focusItems].sort((a, b) => b.momentum - a.momentum)[0]?.name ?? "N/A",
      highestActivity: "Activity unavailable",
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
          lastSeen: band.lastSeen,
        })),
    },
    activity: {
      available: false,
      note: "Activity unavailable for Kick Day Flow.",
    },
  }

  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  })
}
