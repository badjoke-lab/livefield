export type DayFlowState = "loading" | "live" | "partial" | "complete" | "empty" | "error" | "demo"

export type DayFlowMode = "volume" | "share"
export type DayFlowDayScope = "today" | "rolling24h" | "yesterday" | "date"

export type DayFlowBandBucket = {
  viewers: number
  share: number
  activity?: number
  activityAvailable: boolean
  peak: boolean
  rise: boolean
}

export type DayFlowBandSeries = {
  streamerId: string
  name: string
  title: string
  url: string
  color: string
  isOthers: boolean
  order: number
  totalViewerMinutes: number
  peakViewers: number
  avgViewers: number
  peakShare: number
  biggestRiseBucket: string | null
  firstSeen: string | null
  lastSeen: string | null
  activityMax: number | null
  buckets: DayFlowBandBucket[]
}

export type DayFlowFocusItem = {
  streamerId: string
  name: string
  viewers: number
  share: number
  momentum: number
  activity: number | null
  activityAvailable: boolean
}

export type DayFlowPayload = {
  ok: true
  tool: "day-flow"
  source: "api" | "demo"
  state: DayFlowState
  status: "live-today" | "partial" | "complete" | "empty" | "error" | "demo"
  note?: string
  coverageNote: string
  degradationNote?: string
  partialNote?: string
  lastUpdated: string
  selectedDate: string
  bucketSize: 5 | 10
  topN: 10 | 20 | 50
  defaultMode: DayFlowMode
  dateScope: DayFlowDayScope
  rangeMode: DayFlowDayScope
  windowStart: string
  windowEnd: string
  rankingWindowStart: string
  rankingWindowEnd: string
  isRolling: boolean
  summary: {
    peakLeader: string
    longestDominance: string
    highestActivity: string
    biggestRise: string
  }
  timeline: {
    dayStart: string
    dayEnd: string
    nowBucket: string | null
    bucketCount: number
    futureBlankFrom: string | null
  }
  buckets: string[]
  totalViewersByBucket: number[]
  bands: DayFlowBandSeries[]
  focusSnapshot: {
    selectedBucket: string | null
    items: DayFlowFocusItem[]
    strongestMomentum: string
    highestActivity: string
  }
  detailPanelSource: {
    defaultStreamerId: string | null
    streamers: Array<{
      streamerId: string
      name: string
      title: string
      url: string
      peakViewers: number
      avgViewers: number
      viewerMinutes: number
      peakShare: number
      highestActivity: number | null
      biggestRiseTime: string | null
      firstSeen: string | null
      lastSeen: string | null
    }>
  }
  activity: {
    available: boolean
    note: string
  }
}
