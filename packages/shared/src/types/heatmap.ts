export type HeatmapNode = {
  streamerId: string
  name: string
  title: string
  url: string
  viewers: number
  commentCount: number
  deltaComments: number
  commentsPerMin: number
  agitationRaw: number
  agitationLevel: 0 | 1 | 2 | 3 | 4 | 5
  momentum: number
  rankViewers: number
  rankAgitation: number
  rankMomentum: number
  startedAt: string
  updatedAt: string
}

export type HeatmapSummary = {
  activeStreams: number
  totalViewers: number
  highestAgitationName: string
  strongestMomentumName: string
}

export type HeatmapPayload = {
  ok: boolean
  source: "demo" | "api"
  tool: "heatmap"
  updatedAt: string
  summary: HeatmapSummary
  nodes: HeatmapNode[]
}
