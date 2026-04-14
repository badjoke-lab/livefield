import type { HeatmapNode, HeatmapPayload } from "../../../../../packages/shared/src/types/heatmap"
import type { KickHeatmapScaffoldPayload } from "../../shared/api/kick-heatmap-api"

type KickHeatmapNodeRaw = {
  rank?: number
  slug?: string
  title?: string
  viewers?: number
  startedAt?: string
  language?: string | null
  category?: string | null
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value ?? fallback) || fallback
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function mapState(raw: KickHeatmapScaffoldPayload["state"], hasNodes: boolean): HeatmapPayload["state"] {
  if (raw === "error") return "error"
  if (!hasNodes && (raw === "live" || raw === "partial")) return "empty"
  if (raw === "empty") return "empty"
  if (raw === "partial") return "partial"
  if (raw === "live") return "live"
  if (raw === "loading") return "partial"
  if (raw === "unconfigured") return hasNodes ? "partial" : "empty"
  return hasNodes ? "live" : "empty"
}

function normalizeNode(
  raw: KickHeatmapNodeRaw,
  index: number,
  strongestMomentumStream: string | null,
  highestActivityStream: string | null
): HeatmapNode | null {
  const slug = text(raw.slug).trim()
  if (!slug) return null

  const viewers = toNumber(raw.viewers, 0)
  const startedAt = text(raw.startedAt)
  const category = text(raw.category)
  const language = text(raw.language)
  const title = text(raw.title) || slug

  const isStrongestMomentum = strongestMomentumStream === slug
  const isHighestActivity = highestActivityStream === slug

  return {
    streamerId: slug,
    name: slug,
    title: category || language ? `${title} · ${category || "Unknown"} · ${language || "?"}` : title,
    url: `https://kick.com/${slug}`,
    viewers,
    commentCount: 0,
    deltaComments: 0,
    commentsPerMin: 0,
    agitationRaw: 0,
    agitationLevel: isHighestActivity ? 1 : 0,
    activityAvailable: false,
    activitySampled: false,
    activityUnavailableReason: "Kick activity signal is not wired yet.",
    momentum: isStrongestMomentum ? 1 : 0,
    rankViewers: toNumber(raw.rank, index + 1),
    rankAgitation: index + 1,
    rankMomentum: isStrongestMomentum ? 1 : index + 2,
    startedAt,
    updatedAt: new Date().toISOString()
  }
}

export function normalizeKickHeatmapPayload(raw: KickHeatmapScaffoldPayload): HeatmapPayload {
  const strongestMomentumStream = raw.summary.strongestMomentumStream?.trim() || null
  const highestActivityStream = raw.summary.highestActivityStream?.trim() || null

  const nodes = (raw.nodes as KickHeatmapNodeRaw[])
    .map((node, index) => normalizeNode(node, index, strongestMomentumStream, highestActivityStream))
    .filter((node): node is HeatmapNode => node !== null)

  const state = mapState(raw.state, nodes.length > 0)

  return {
    ok: true,
    source: "api",
    tool: "heatmap",
    state,
    note: raw.note,
    updatedAt: raw.lastUpdated ?? new Date().toISOString(),
    summary: {
      activeStreams: toNumber(raw.summary.activeStreams, nodes.length),
      totalViewers: toNumber(raw.summary.totalViewersObserved, 0),
      highestAgitationName: highestActivityStream ?? "Activity unavailable",
      strongestMomentumName: strongestMomentumStream ?? "Momentum signal limited"
    },
    nodes
  }
}
