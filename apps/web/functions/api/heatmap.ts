import demoPayload from "../../../../fixtures/demo/heatmap.json"
import { resolveApiState, type ApiState } from "./_shared/state"
import type { HeatmapNode, HeatmapPayload } from "../../../../packages/shared/src/types/heatmap"

type Env = { DB?: { prepare: (sql: string) => { all: () => Promise<{ results: SnapshotRow[] }> } } }

type SnapshotRow = {
  collected_at: string
  covered_pages: number
  has_more: number
  payload_json: string
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
  }>
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
): { nodes: HeatmapNode[]; unavailableCount: number } {
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
      } => Boolean(stream.userId && stream.displayName && stream.title && typeof stream.viewerCount === "number" && stream.startedAt)
    )
    .sort((a, b) => b.viewerCount - a.viewerCount)
    .slice(0, top)

  let unavailableCount = 0
  const withMomentum = baseNodes.map((stream, index) => {
    const previous = previousViewerByStreamer.get(stream.userId) ?? stream.viewerCount
    const momentum = (stream.viewerCount - previous) / Math.max(previous, 20)
    const commentsPerMin = typeof stream.commentsPerMin === "number" ? stream.commentsPerMin : null
    if (commentsPerMin === null) unavailableCount += 1

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
    unavailableCount
  }
}

function buildPayload(nodes: HeatmapNode[], updatedAt: string, state: ApiState, note: string): HeatmapPayload {
  const topByMomentum = [...nodes].sort((a, b) => b.momentum - a.momentum)[0]
  const topByAgitation = [...nodes].sort((a, b) => b.agitationRaw - a.agitationRaw)[0]

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
      highestAgitationName: topByAgitation?.name ?? "No activity data",
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

export const onRequest = async (context: { env: Env; request: Request }) => {
  const db = context.env.DB
  if (!db) {
    return json({ ...(structuredClone(demoPayload as HeatmapPayload)), state: "demo", note: "DB unavailable" })
  }

  const top = normalizeTop(new URL(context.request.url).searchParams.get("top"))
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

    const { nodes, unavailableCount } = toHeatmapNodes(
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

    const note = allUnavailable
      ? "Activity unavailable for all channels; viewers and momentum only."
      : unavailableCount > 0
        ? `Activity unavailable for ${unavailableCount}/${nodes.length} channels.`
        : "Activity signal is available from Twitch chat ingest."

    return json(buildPayload(nodes, latest.collected_at, state, note))
  } catch {
    return json({ ...(structuredClone(demoPayload as HeatmapPayload)), state: "demo", note: "failed to parse snapshot payload" })
  }
}
