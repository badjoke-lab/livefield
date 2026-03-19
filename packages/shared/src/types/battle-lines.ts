export type BattleLinesSource = "api" | "demo"

export type BattleLinesState =
  | "live"
  | "stale"
  | "partial"
  | "complete"
  | "empty"
  | "error"
  | "demo"

export type BattleLinesDayMode = "today" | "yesterday" | "date"
export type BattleLinesMetricMode = "viewers" | "indexed"
export type BattleLinesEventType = "peak" | "rise" | "reversal" | "heat" | "start" | "end"
export type BattleGapTrend = "closing" | "widening" | "flat"
export type BattleCandidateTag = "closing" | "recent-reversal" | "rising-challenger" | "heated"

export type BattleLinesFilters = {
  day: BattleLinesDayMode
  date: string
  top: 3 | 5 | 10
  metric: BattleLinesMetricMode
  bucketMinutes: 1 | 5 | 10
  focus: string
}

export type BattleLine = {
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

export type BattleLinesEvent = {
  type: BattleLinesEventType
  bucket: string
  label: string
  streamerId: string
  rivalId?: string
}

export type FocusStripItem = {
  streamerId: string
  name: string
}

export type FocusDetail = {
  streamerId: string
  name: string
  peakViewers: number
  latestViewers: number
  biggestRiseTime: string
  reversalCount: number
}

export type BattleCandidate = {
  key: string
  leftId: string
  rightId: string
  leftName: string
  rightName: string
  score: number
  gap: number
  gapTrend: BattleGapTrend
  lastReversalAt: string | null
  tag: BattleCandidateTag
  currentGapLabel: string
}

export type BattleReversalStripItem = {
  timestamp: string
  label: string
  passer: string
  passed: string
  gapBefore: number
  gapAfter: number
  heatOverlap: boolean
}

export type BattleLinesRecommendation = {
  primaryBattle: BattleCandidate | null
  secondaryBattles: BattleCandidate[]
  latestReversal: string
  fastestChallenger: string
  reversalStrip: BattleReversalStripItem[]
}

export type BattleLinesSummary = {
  leader: string
  biggestRise: string
  peakMoment: string
  reversals: number
  liveBattleNow: string
  latestReversal: string
  fastestChallenger: string
  mostHeatedBattle: string
}

export type BattleLinesPayload = {
  ok: true
  tool: "battle-lines"
  source: BattleLinesSource
  state: BattleLinesState
  updatedAt: string
  filters: BattleLinesFilters
  summary: BattleLinesSummary
  buckets: string[]
  lines: BattleLine[]
  focusStrip: FocusStripItem[]
  focusDetail: FocusDetail
  events: BattleLinesEvent[]
  recommendation: BattleLinesRecommendation
}
