import demoPayload from "../../../../fixtures/demo/heatmap.json"
import { resolveApiState, type ApiState } from "./_shared/state"
import type { HeatmapNode, HeatmapPayload } from "../../../../packages/shared/src/types/heatmap"

type Env = {
  DB?: {
    prepare: (sql: string) => {
      bind: (...params: unknown[]) => { all: () => Promise<{ results: SnapshotRow[] }> }
      all: () => Promise<{ results: SnapshotRow[] }>
    }
  }
}

type SnapshotRow = {
  collected_at: string
  covered_pages: number
  has_more: number
  payload_json: string
}

type HeatmapFrameRow = {
  bucket_time: string
  streamer_id: string
  display_name: string
  viewers: number
  momentum_delta: number | null
  activity_level: number | null
  title: string | null
  language: string | null
}

type SnapshotPayload = {
  streams?: Array<{
    userId?: string
    login?: string
    displayName?: string
    title?: string
    viewerCount?: number
    startedAt?: string
    language?: string
    commentCount?: number | null
    deltaComments?: number | null
    commentsPerMin?: number | null
    agitationRaw?: number | null
    agitationLevel?: 0 | 1 | 2 | 3 | 4 | 5 | null
    activityAvailable?: boolean
    activitySampled?: boolean
    activityUnavailableReason?: string | null
  }>
}

const DAY_MS = 24 * 60 * 60 * 1000

type HeatmapDayScope = "today" | "yesterday" | "date"

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function parseDay(rawDate: string | null, rawDay: string | null): { day: HeatmapDayScope; date: Date } {
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

function normalizeTop(rawTop: string | null): 20 | 50 | 100 {
  if (rawTop === "20") return 20
  if (rawTop === "100") return 100
  return 50
}

function getViewerCountByStreamer(rows: SnapshotPayload["streams"]): Map<string, number> {
  const map = new Map<string, number>()
  if (!rows) return map
  for (const stream of rows) {
    if (!stream?.userId || typeof stream.viewerCount !== "number") continue
    map.set(stream.userId, stream.viewerCount)
  }
  return map
}

function toHeatmapNodes(
  streams: SnapshotPayload["streams"],
  previousViewerByStreamer: Map<string, number>,
  collectedAt: string,
  top: number
): { nodes: HeatmapNode[]; unavailableCount: number; observedZeroCount: number; sampledCount: number } {
  const twitchBaseUrl = "https://www.twitch.tv"

  const baseNodes = (streams ?? [])
    .filter((stream) => stream?.language === "en")
    .filter(
      (stream): stream is Required<Pick<NonNullable<typeof stream>, "userId" | "displayName" | "title" | "viewerCount" | "startedAt">> & {
        login?: string
        commentCount?: number | null
        deltaComments?: number | null
        commentsPerMin?: number | null
        agitationRaw?: number | null
        agitationLevel?: 0 | 1 | 2 | 3 | 4 | 5 | null
        activityAvailable?: boolean
        activitySampled?: boolean
        activityUnavailableReason?: string | null
      } => Boolean(stream.userId && stream.displayName && stream.title && typeof stream.viewerCount === "number" && stream.startedAt)
    )
    .sort((a, b) => b.viewerCount - a.viewerCount)
    .slice(0, top)

  let unavailableCount = 0
  let observedZeroCount = 0
  let sampledCount = 0
  const withMomentum = baseNodes.map((stream, index) => {
    const previous = previousViewerByStreamer.get(stream.userId) ?? stream.viewerCount
    const momentum = (stream.viewerCount - previous) / Math.max(previous, 20)
    const activityAvailable = stream.activityAvailable === true
    const activitySampled = stream.activitySampled !== false
    const commentsPerMin = typeof stream.commentsPerMin === "number" ? stream.commentsPerMin : null

    if (!activityAvailable) unavailableCount += 1
    if (activitySampled) sampledCount += 1
    if (activityAvailable && (commentsPerMin ?? 0) === 0) observedZeroCount += 1

    return {
      streamerId: stream.userId,
      name: stream.displayName,
      title: stream.title,
      url: `${twitchBaseUrl}/${encodeURIComponent(stream.login ?? stream.displayName)}`,
      viewers: stream.viewerCount,
      commentCount: typeof stream.commentCount === "number" ? stream.commentCount : 0,
      deltaComments: typeof stream.deltaComments === "number" ? stream.deltaComments : 0,
      commentsPerMin: commentsPerMin ?? 0,
      agitationRaw: typeof stream.agitationRaw === "number" ? stream.agitationRaw : 0,
      agitationLevel: typeof stream.agitationLevel === "number" ? stream.agitationLevel : 0,
      activityAvailable,
      activitySampled,
      activityUnavailableReason: stream.activityUnavailableReason ?? (activityAvailable ? undefined : "activity unavailable"),
      momentum,
      rankViewers: index + 1,
      rankAgitation: 0,
      rankMomentum: 0,
      startedAt: stream.startedAt,
      updatedAt: collectedAt
    }
  })

  const agitationOrder = [...withMomentum].sort((a, b) => b.agitationRaw - a.agitationRaw)
  const momentumOrder = [...withMomentum].sort((a, b) => b.momentum - a.momentum)
  const agitationRankById = new Map(agitationOrder.map((node, i) => [node.streamerId, i + 1]))
  const momentumRankById = new Map(momentumOrder.map((node, i) => [node.streamerId, i + 1]))

  return {
    nodes: withMomentum.map((node) => ({
      ...node,
      rankAgitation: agitationRankById.get(node.streamerId) ?? withMomentum.length,
      rankMomentum: momentumRankById.get(node.streamerId) ?? withMomentum.length
    })),
    unavailableCount,
    observedZeroCount,
    sampledCount
  }
}

function buildPayload(nodes: HeatmapNode[], updatedAt: string, state: ApiState, note: string): HeatmapPayload {
  const topByMomentum = [...nodes].sort((a, b) => b.momentum - a.momentum)[0]
  const availableActivityNodes = nodes.filter((node) => node.activityAvailable)
  const topByAgitation = [...availableActivityNodes].sort((a, b) => b.agitationRaw - a.agitationRaw)[0]

  return {
    ok: true,
    source: "api",
    tool: "heatmap",
    state,
    note,
    updatedAt,
    summary: {
      activeStreams: nodes.length,
      totalViewers: nodes.reduce((sum, node) => sum + node.viewers, 0),
      highestAgitationName: topByAgitation
        ? `${topByAgitation.name} (Lv${topByAgitation.agitationLevel})`
        : "No sampled activity",
      strongestMomentumName: topByMomentum?.name ?? "No live streams"
    },
    nodes
  }
}

function buildEmptyPayload(updatedAt: string): HeatmapPayload {
  return {
    ok: true,
    source: "api",
    tool: "heatmap",
    state: "empty",
    note: "No live streams in latest snapshot.",
    updatedAt,
    summary: {
      activeStreams: 0,
      totalViewers: 0,
      highestAgitationName: "No live streams",
      strongestMomentumName: "No live streams"
    },
    nodes: []
  }
}

function json(body: HeatmapPayload): Response {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  })
}

async function fetchHistoricalHeatmapRows(
  db: NonNullable<Env["DB"]>,
  day: string,
  top: 20 | 50 | 100
): Promise<{ results: HeatmapFrameRow[] }> {
  return (await db
    .prepare(
      `SELECT bucket_time, streamer_id, display_name, viewers, momentum_delta, activity_level, title, language
       FROM heatmap_frames_5m
       WHERE day = ? AND top_scope = ?
       ORDER BY bucket_time DESC`
    )
    .bind(day, `top${top}`)
    .all()) as unknown as { results: HeatmapFrameRow[] }
}

export const onRequest = async (context: { env: Env; request: Request }) => {
  const db = context.env.DB
  if (!db) {
    return json({ ...(structuredClone(demoPayload as HeatmapPayload)), state: "demo", note: "DB unavailable" })
  }

  const url = new URL(context.request.url)
  const top = normalizeTop(url.searchParams.get("top"))
  const parsedDay = parseDay(url.searchParams.get("date"), url.searchParams.get("day"))
  const selectedDate = startOfUtcDay(parsedDay.date).toISOString().slice(0, 10)
  const isHistorical = parsedDay.day === "yesterday" || parsedDay.day === "date"

  if (isHistorical) {
    try {
      const rows = await fetchHistoricalHeatmapRows(db, selectedDate, top)
      if (!rows.results.length) return json(buildEmptyPayload(new Date().toISOString()))

      const latestBucket = rows.results[0]?.bucket_time
      if (!latestBucket) return json(buildEmptyPayload(new Date().toISOString()))
      const frameRows = rows.results.filter((row) => row.bucket_time === latestBucket)
      const nodes = frameRows.map((row, index) => {
        const previous = Math.max(20, row.viewers - (row.momentum_delta ?? 0))
        const momentum = previous > 0 ? (row.momentum_delta ?? 0) / previous : 0
        const activityAvailable = typeof row.activity_level === "number"
        return {
          streamerId: row.streamer_id,
          name: row.display_name,
          title: row.title ?? "",
          url: `https://www.twitch.tv/${encodeURIComponent(row.display_name)}`,
          viewers: row.viewers,
          commentCount: 0,
          deltaComments: 0,
          commentsPerMin: 0,
          agitationRaw: activityAvailable ? row.activity_level ?? 0 : 0,
          agitationLevel: activityAvailable ? Math.max(0, Math.min(5, Math.round(row.activity_level ?? 0))) as 0 | 1 | 2 | 3 | 4 | 5 : 0,
          activityAvailable,
          activitySampled: activityAvailable,
          activityUnavailableReason: activityAvailable ? undefined : "historical activity unavailable",
          momentum,
          rankViewers: index + 1,
          rankAgitation: 0,
          rankMomentum: 0,
          startedAt: latestBucket,
          updatedAt: latestBucket
        }
      })
      const agitationOrder = [...nodes].sort((a, b) => b.agitationRaw - a.agitationRaw)
      const momentumOrder = [...nodes].sort((a, b) => b.momentum - a.momentum)
      const agitationRankById = new Map(agitationOrder.map((node, i) => [node.streamerId, i + 1]))
      const momentumRankById = new Map(momentumOrder.map((node, i) => [node.streamerId, i + 1]))
      const rankedNodes = nodes.map((node) => ({
        ...node,
        rankAgitation: agitationRankById.get(node.streamerId) ?? nodes.length,
        rankMomentum: momentumRankById.get(node.streamerId) ?? nodes.length
      }))

      return json(buildPayload(rankedNodes, latestBucket, "stale", "Historical heatmap frame from 5m read model."))
    } catch {
      return json(buildEmptyPayload(new Date().toISOString()))
    }
  }

  const rows = (await db
    .prepare(
      `SELECT collected_at, covered_pages, has_more, payload_json
       FROM minute_snapshots
       WHERE provider = 'twitch'
       ORDER BY bucket_minute DESC
       LIMIT 2`
    )
    .all()) as { results: SnapshotRow[] }

  if (!rows.results.length) return json(buildEmptyPayload(new Date().toISOString()))

  try {
    const latest = rows.results[0]
    const previous = rows.results[1]
    const latestPayload = JSON.parse(latest.payload_json) as SnapshotPayload
    const previousPayload = previous ? (JSON.parse(previous.payload_json) as SnapshotPayload) : undefined

    const { nodes, unavailableCount, observedZeroCount, sampledCount } = toHeatmapNodes(
      latestPayload.streams,
      getViewerCountByStreamer(previousPayload?.streams),
      latest.collected_at,
      top
    )

    if (!nodes.length) return json(buildEmptyPayload(latest.collected_at))

    const allUnavailable = unavailableCount === nodes.length
    const partial = latest.has_more === 1 || unavailableCount > 0
    const state = resolveApiState({
      source: "api",
      hasSnapshot: true,
      isFresh: true,
      isPartial: partial,
      hasError: false
    })

    const observedCount = nodes.length - unavailableCount
    const sampledModeNote = sampledCount > 0 ? `Sampled chat observed for ${observedCount}/${nodes.length} channels.` : "Sampled chat coverage is unavailable."
    const note = allUnavailable
      ? `${sampledModeNote} Activity unavailable for all channels; viewers and momentum only.`
      : unavailableCount > 0
        ? `${sampledModeNote} Activity unavailable for ${unavailableCount}/${nodes.length} channels. ${observedZeroCount > 0 ? `${observedZeroCount} sampled channels were observed with zero activity.` : ""}`.trim()
        : `${sampledModeNote} ${observedZeroCount > 0 ? `${observedZeroCount} channels were sampled with zero activity.` : "Activity signal is available from Twitch chat ingest."}`.trim()

    return json(buildPayload(nodes, latest.collected_at, state, note))
  } catch {
    return json({ ...(structuredClone(demoPayload as HeatmapPayload)), state: "demo", note: "failed to parse snapshot payload" })
  }
}
