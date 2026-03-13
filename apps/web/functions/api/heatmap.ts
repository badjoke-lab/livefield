import demoPayload from "../../../../fixtures/demo/heatmap.json"
import type { HeatmapNode, HeatmapPayload } from "../../../../packages/shared/src/types/heatmap"

type Env = { DB?: { prepare: (sql: string) => { all: () => Promise<{ results: SnapshotRow[] }> } } }

type SnapshotRow = {
  collected_at: string
  covered_pages: number
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
): HeatmapNode[] {
  const twitchBaseUrl = "https://www.twitch.tv"

  const baseNodes = (streams ?? [])
    .filter((stream) => stream?.language === "en")
    .filter(
      (stream): stream is Required<Pick<NonNullable<typeof stream>, "userId" | "displayName" | "title" | "viewerCount" | "startedAt">> & {
        language?: string
      } =>
        Boolean(
          stream.userId &&
            stream.displayName &&
            stream.title &&
            typeof stream.viewerCount === "number" &&
            stream.startedAt
        )
    )
    .sort((a, b) => b.viewerCount - a.viewerCount)
    .slice(0, top)

  const withMomentum = baseNodes.map((stream, index) => {
    const previous = previousViewerByStreamer.get(stream.userId) ?? stream.viewerCount
    const momentum = (stream.viewerCount - previous) / Math.max(previous, 20)

    return {
      streamerId: stream.userId,
      name: stream.displayName,
      title: stream.title,
      url: `${twitchBaseUrl}/${encodeURIComponent(stream.displayName)}`,
      viewers: stream.viewerCount,
      commentCount: 0,
      deltaComments: 0,
      commentsPerMin: 0,
      agitationRaw: 0,
      agitationLevel: 0 as const,
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

  return withMomentum.map((node) => ({
    ...node,
    rankAgitation: agitationRankById.get(node.streamerId) ?? withMomentum.length,
    rankMomentum: momentumRankById.get(node.streamerId) ?? withMomentum.length
  }))
}

function buildApiPayload(nodes: HeatmapNode[], updatedAt: string): HeatmapPayload {
  const topByMomentum = [...nodes].sort((a, b) => b.momentum - a.momentum)[0]

  return {
    ok: true,
    source: "api",
    tool: "heatmap",
    updatedAt,
    summary: {
      activeStreams: nodes.length,
      totalViewers: nodes.reduce((sum, node) => sum + node.viewers, 0),
      highestAgitationName:
        nodes.length > 0 ? "Activity signal unavailable (Twitch snapshot-only)" : "No live streams",
      strongestMomentumName: topByMomentum?.name ?? "No live streams"
    },
    nodes
  }
}

function json(body: HeatmapPayload): Response {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  })
}

export const onRequestGet = async (context: { env: Env; request: Request }) => {
  const db = context.env.DB
  if (!db) {
    return json(structuredClone(demoPayload as HeatmapPayload))
  }

  const top = normalizeTop(new URL(context.request.url).searchParams.get("top"))
  const rows = await db
    .prepare(
      `SELECT collected_at, covered_pages, payload_json
       FROM minute_snapshots
       WHERE provider = 'twitch'
       ORDER BY bucket_minute DESC
       LIMIT 2`
    )
    .all() as Promise<{ results: SnapshotRow[] }>

  if (!rows.results.length) {
    return json(structuredClone(demoPayload as HeatmapPayload))
  }

  try {
    const latest = rows.results[0]
    const previous = rows.results[1]

    const latestPayload = JSON.parse(latest.payload_json) as SnapshotPayload
    const previousPayload = previous ? (JSON.parse(previous.payload_json) as SnapshotPayload) : undefined

    const nodes = toHeatmapNodes(
      latestPayload.streams,
      getViewerCountByStreamer(previousPayload?.streams),
      latest.collected_at,
      top
    )

    if (!nodes.length) {
      return json(structuredClone(demoPayload as HeatmapPayload))
    }

    return json(buildApiPayload(nodes, latest.collected_at))
  } catch {
    return json(structuredClone(demoPayload as HeatmapPayload))
  }
}
