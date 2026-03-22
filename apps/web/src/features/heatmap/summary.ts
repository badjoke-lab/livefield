import type { HeatmapPayload } from "../../../../../packages/shared/src/types/heatmap"

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;")
}

export function renderHeatmapSummary(payload: HeatmapPayload, isHistorical: boolean): string {
  return `<section class="summary-strip page-section heatmap-summary-strip"><div class="summary-item"><strong>${isHistorical ? "Streams in frame" : "Active streams"}</strong><span>${payload.summary.activeStreams}</span></div><div class="summary-item"><strong>${isHistorical ? "Frame viewers observed" : "Total viewers observed"}</strong><span>${payload.summary.totalViewers.toLocaleString()}</span></div><div class="summary-item"><strong>${isHistorical ? "Highest activity (frame)" : "Highest activity"}</strong><span>${escapeHtml(payload.summary.highestAgitationName)}</span></div><div class="summary-item"><strong>${isHistorical ? "Strongest momentum (frame)" : "Strongest momentum"}</strong><span>${escapeHtml(payload.summary.strongestMomentumName)}</span></div></section>`
}
