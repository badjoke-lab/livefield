export type ChartViewportMode = "observed" | "full-day"

export type ObservedWindowState = {
  startIndex: number
  endIndex: number
  observedCount: number
  totalCount: number
  hasObservedData: boolean
  isSparseToday: boolean
  defaultMode: ChartViewportMode
  observedSinceLabel: string | null
}

function getTimeLabel(iso: string | undefined): string | null {
  if (!iso || iso.length < 16) return null
  return iso.slice(11, 16)
}

function resolveLatestDenseSegmentStartIndex(
  observedIndices: number[],
  bucketMinutes: number
): number {
  const maxAllowedGapBuckets = bucketMinutes <= 5 ? 1 : 0
  let startIndex = observedIndices[observedIndices.length - 1] ?? 0
  let current = startIndex

  for (let idx = observedIndices.length - 2; idx >= 0; idx -= 1) {
    const candidate = observedIndices[idx]
    const missingBuckets = current - candidate - 1
    if (missingBuckets > maxAllowedGapBuckets) break
    startIndex = candidate
    current = candidate
  }

  return startIndex
}

export function resolveObservedWindowState(args: {
  dayMode: string
  bucketMinutes: number
  buckets: string[]
  observedIndices: number[]
}): ObservedWindowState {
  const totalCount = args.buckets.length
  if (totalCount <= 0 || args.observedIndices.length <= 0) {
    return {
      startIndex: 0,
      endIndex: Math.max(0, totalCount - 1),
      observedCount: 0,
      totalCount,
      hasObservedData: false,
      isSparseToday: false,
      defaultMode: "full-day",
      observedSinceLabel: null
    }
  }

  const deduped = [...new Set(args.observedIndices)].sort((a, b) => a - b)
  const firstObservedIndex = deduped[0] ?? 0
  const endIndex = deduped[deduped.length - 1] ?? Math.max(0, totalCount - 1)
  const observedCount = deduped.length
  const spanCount = Math.max(1, endIndex - firstObservedIndex + 1)
  const spanMinutes = spanCount * Math.max(1, args.bucketMinutes)
  const coverageRatio = spanCount / Math.max(1, totalCount)

  const leadingBlankCount = firstObservedIndex
  const leadingBlankMinutes = leadingBlankCount * Math.max(1, args.bucketMinutes)
  const internalGapCount = Math.max(0, spanCount - observedCount)
  const internalGapRatio = internalGapCount / Math.max(1, spanCount)

  const limitedCoverage = coverageRatio <= 0.45
  const veryShortWindow = spanMinutes <= 180
  const veryFewBuckets = observedCount <= Math.max(6, Math.round(totalCount * 0.22))
  const startsAfterFirstHour = leadingBlankMinutes >= 60
  const hasMeaningfulInternalGaps = internalGapRatio >= 0.08

  const isSparseToday =
    args.dayMode === "today" &&
    (
      veryFewBuckets ||
      limitedCoverage ||
      veryShortWindow ||
      startsAfterFirstHour ||
      hasMeaningfulInternalGaps
    )

  const latestDenseStartIndex = resolveLatestDenseSegmentStartIndex(deduped, args.bucketMinutes)
  const startIndex =
    args.dayMode === "today" || args.dayMode === "rolling24h"
      ? latestDenseStartIndex
      : firstObservedIndex

  const defaultMode: ChartViewportMode = isSparseToday ? "observed" : "full-day"

  return {
    startIndex,
    endIndex,
    observedCount,
    totalCount,
    hasObservedData: true,
    isSparseToday,
    defaultMode,
    observedSinceLabel: getTimeLabel(args.buckets[startIndex])
  }
}

export function resolveViewportRange(
  state: ObservedWindowState,
  mode: ChartViewportMode
): { startIndex: number; endIndex: number } {
  if (mode === "observed" && state.hasObservedData) {
    return { startIndex: state.startIndex, endIndex: state.endIndex }
  }

  return { startIndex: 0, endIndex: Math.max(0, state.totalCount - 1) }
}
