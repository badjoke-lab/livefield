import type { HeatmapNode } from "../../../../../packages/shared/src/types/heatmap"

export type ActivityState = "active" | "sampled_zero" | "unavailable_sampled" | "unavailable_not_sampled"

export function getActivityState(node: HeatmapNode): ActivityState {
  if (node.activityAvailable) return node.commentsPerMin > 0 ? "active" : "sampled_zero"
  if (node.activitySampled) return "unavailable_sampled"
  return "unavailable_not_sampled"
}

export function formatActivityState(node: HeatmapNode): string {
  const state = getActivityState(node)
  if (state === "active") return "Observed and active"
  if (state === "sampled_zero") return "Sampled (0 activity)"
  if (state === "unavailable_sampled") return "Sampled but activity unavailable"
  return `Not sampled in this window${node.activityUnavailableReason ? ` (${node.activityUnavailableReason})` : ""}`
}
