import type { HeatmapNode } from "../../../../../packages/shared/src/types/heatmap"

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;")
}

function formatMomentum(momentum: number): string {
  if (momentum >= 0.15) return "Strong rise"
  if (momentum >= 0.08) return "Rising"
  if (momentum >= 0.03) return "Slight up"
  if (momentum <= -0.15) return "Strong drop"
  if (momentum <= -0.08) return "Falling"
  if (momentum <= -0.03) return "Slight down"
  return "Flat"
}

export function renderHeatmapDetailPanel(selected: HeatmapNode, isHistorical: boolean): string {
  return `<section class="grid-2 page-section"><section class="card"><h2>Selected details</h2><div class="kv"><div class="kv-row"><span>Streamer</span><strong>${escapeHtml(selected.name)}</strong></div><div class="kv-row"><span>${isHistorical ? "Frame viewers" : "Current viewers"}</span><strong>${selected.viewers.toLocaleString()}</strong></div><div class="kv-row"><span>Momentum</span><strong>${formatMomentum(selected.momentum)}</strong></div><div class="kv-row"><span>Activity state</span><strong>${selected.activityAvailable ? "Sampled in frame" : "Unavailable in frame"}</strong></div><div class="kv-row"><span>Comments / min</span><strong>${selected.activityAvailable && !isHistorical ? selected.commentsPerMin.toLocaleString() : "-"}</strong></div><div class="kv-row"><span>Activity level</span><strong>${selected.activityAvailable ? `Lv${selected.agitationLevel}` : "-"}</strong></div><div class="kv-row"><span>Viewer rank</span><strong>#${selected.rankViewers}</strong></div><div class="kv-row"><span>Open stream</span><strong><a href="${escapeHtml(selected.url)}" target="_blank" rel="noopener noreferrer">Open stream ↗</a></strong></div></div></section></section>`
}
