import {
  resolveObservedWindowState as resolveTwitchObservedWindowState,
  resolveViewportRange as resolveTwitchViewportRange,
} from "../../features/day-flow/runtime/observed-window"
import {
  resolveObservedWindowState as resolveKickObservedWindowState,
  resolveViewportRange as resolveKickViewportRange,
} from "../../features/kick-day-flow/runtime/observed-window"

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

function isKickDayFlowPath(): boolean {
  if (typeof window === "undefined") return false
  return window.location.pathname.startsWith("/kick/")
}

export function resolveObservedWindowState(args: {
  dayMode: string
  bucketMinutes: number
  buckets: string[]
  observedIndices: number[]
}): ObservedWindowState {
  return isKickDayFlowPath()
    ? resolveKickObservedWindowState(args)
    : resolveTwitchObservedWindowState(args)
}

export function resolveViewportRange(
  state: ObservedWindowState,
  mode: ChartViewportMode
): { startIndex: number; endIndex: number } {
  return isKickDayFlowPath()
    ? resolveKickViewportRange(state, mode)
    : resolveTwitchViewportRange(state, mode)
}
