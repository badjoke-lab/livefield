import type {
  BattleCandidate,
  BattleCandidateTag,
  BattleGapTrend,
  BattleLinesEvent,
  BattleLinesPayload,
  BattleLinesState,
  BattleReversalStripItem
} from "../types/battle-lines"

const stateValues: BattleLinesState[] = ["live", "stale", "partial", "complete", "empty", "error", "demo"]
const eventTypes: BattleLinesEvent["type"][] = ["peak", "rise", "reversal", "heat", "start", "end"]
const candidateTags: BattleCandidateTag[] = ["closing", "recent-reversal", "rising-challenger", "heated"]
const gapTrends: BattleGapTrend[] = ["closing", "widening", "flat"]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isNumber)
}

function isBattleEvent(value: unknown): value is BattleLinesEvent {
  if (!isRecord(value)) return false
  if (!eventTypes.includes(value.type as BattleLinesEvent["type"])) return false
  if (!isString(value.bucket) || !isString(value.label) || !isString(value.streamerId)) return false
  if (value.rivalId !== undefined && !isString(value.rivalId)) return false
  return value.rivalId === undefined || isString(value.rivalId)
}

function isBattleCandidate(value: unknown): value is BattleCandidate {
  if (!isRecord(value)) return false
  return (
    isString(value.key)
    && isString(value.leftId)
    && isString(value.rightId)
    && isString(value.leftName)
    && isString(value.rightName)
    && isNumber(value.score)
    && isNumber(value.gap)
    && gapTrends.includes(value.gapTrend as BattleGapTrend)
    && (value.lastReversalAt === null || isString(value.lastReversalAt))
    && candidateTags.includes(value.tag as BattleCandidateTag)
    && isString(value.currentGapLabel)
  )
}

function isReversalStripItem(value: unknown): value is BattleReversalStripItem {
  if (!isRecord(value)) return false
  return (
    isString(value.timestamp)
    && isString(value.label)
    && isString(value.passer)
    && isString(value.passed)
    && isNumber(value.gapBefore)
    && isNumber(value.gapAfter)
    && typeof value.heatOverlap === "boolean"
  )
}

export function isBattleLinesPayload(value: unknown): value is BattleLinesPayload {
  if (!isRecord(value)) return false
  if (value.ok !== true || value.tool !== "battle-lines") return false
  if (!isString(value.source) || (value.source !== "api" && value.source !== "demo")) return false
  if (!stateValues.includes(value.state as BattleLinesState)) return false
  if (!isString(value.updatedAt)) return false
  if (!isStringArray(value.buckets)) return false
  if (!Array.isArray(value.lines) || !value.lines.every((line) => {
    if (!isRecord(line)) return false
    return (
      isString(line.streamerId)
      && isString(line.name)
      && isString(line.color)
      && isNumberArray(line.points)
      && isNumberArray(line.viewerPoints)
      && isNumber(line.peakViewers)
      && isNumber(line.latestViewers)
      && isNumber(line.risePerMin)
      && isNumber(line.reversalCount)
    )
  })) return false

  if (!Array.isArray(value.focusStrip) || !value.focusStrip.every((item) => isRecord(item) && isString(item.streamerId) && isString(item.name))) {
    return false
  }

  if (!isRecord(value.focusDetail)) return false
  if (
    !isString(value.focusDetail.streamerId)
    || !isString(value.focusDetail.name)
    || !isNumber(value.focusDetail.peakViewers)
    || !isNumber(value.focusDetail.latestViewers)
    || !isString(value.focusDetail.biggestRiseTime)
    || !isNumber(value.focusDetail.reversalCount)
  ) {
    return false
  }

  if (!Array.isArray(value.events) || !value.events.every(isBattleEvent)) return false

  if (!isRecord(value.filters)) return false
  if (
    !isString(value.filters.day)
    || !isString(value.filters.date)
    || !isNumber(value.filters.top)
    || !isString(value.filters.metric)
    || !isNumber(value.filters.bucketMinutes)
    || !isString(value.filters.focus)
  ) {
    return false
  }

  if (!isRecord(value.summary)) return false
  if (
    !isString(value.summary.leader)
    || !isString(value.summary.biggestRise)
    || !isString(value.summary.peakMoment)
    || !isNumber(value.summary.reversals)
    || !isString(value.summary.liveBattleNow)
    || !isString(value.summary.latestReversal)
    || !isString(value.summary.fastestChallenger)
    || !isString(value.summary.mostHeatedBattle)
  ) {
    return false
  }

  if (!isRecord(value.recommendation)) return false
  if (
    !(value.recommendation.primaryBattle === null || isBattleCandidate(value.recommendation.primaryBattle))
    || !Array.isArray(value.recommendation.secondaryBattles)
    || !value.recommendation.secondaryBattles.every(isBattleCandidate)
    || !isString(value.recommendation.latestReversal)
    || !isString(value.recommendation.fastestChallenger)
    || !Array.isArray(value.recommendation.reversalStrip)
    || !value.recommendation.reversalStrip.every(isReversalStripItem)
  ) {
    return false
  }

  return true
}

export function assertBattleLinesPayload(value: unknown): asserts value is BattleLinesPayload {
  if (!isBattleLinesPayload(value)) {
    throw new Error("Invalid battle-lines payload")
  }
}
