import type { HeatmapPayload } from "../../../../../packages/shared/src/types/heatmap"
import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"
import { readAnimationEnabled, writeAnimationEnabled } from "../../shared/runtime/animation-mode"
import { readLowLoadEnabled, writeLowLoadEnabled } from "../../shared/runtime/low-load-mode"
import { formatActivityState, getActivityState } from "./activity-state"
import { mountSvgTreemapRenderer } from "./renderer/svg-treemap"
import { loadHeatmapPageState, type HeatmapMode } from "./state"

let pollTimer: number | null = null
let cleanupRenderer: (() => void) | null = null

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

function getModeLabel(mode: HeatmapMode): string {
  if (mode === "demo") return "Demo data"
  if (mode === "stale") return "Stale data"
  if (mode === "partial") return "Partial data"
  return "Live-like"
}

function getModeNote(mode: HeatmapMode, payload: HeatmapPayload, lowLoad: boolean, animationEnabled: boolean): string {
  const modeText =
    mode === "demo"
      ? "This is demo data, not a live collection feed."
      : mode === "stale"
        ? "Data updates are delayed."
        : mode === "partial"
          ? "Sampled activity is partial; sampled-zero and unavailable channels are shown separately while viewers and momentum continue to update."
          : "The current payload is in a live-like state."

  return `${modeText} ${payload.note ?? ""} Low Load: ${lowLoad ? "ON" : "OFF"} / Animation: ${animationEnabled ? "ON" : "OFF"}`
}

function renderReady(root: HTMLElement, payload: HeatmapPayload, mode: HeatmapMode, selectedStreamerId?: string): void {
  cleanupRenderer?.()
  cleanupRenderer = null

  const lowLoad = readLowLoadEnabled()
  const animationEnabled = readAnimationEnabled()
  const visibleCount = lowLoad ? 24 : 50
  const visibleNodes = payload.nodes.slice(0, visibleCount)
  const selected = visibleNodes.find((node) => node.streamerId === selectedStreamerId) ?? visibleNodes[0]

  if (!selected) {
    root.className = "site-shell"
    root.innerHTML = `${renderHeader("heatmap")}${renderHero({ eyebrow: "NOW", title: "Heatmap", subtitle: "Production treemap of live Twitch streams right now.", note: `Treemap area = viewers / color = momentum / badges = sampled activity state. Current state: ${getModeLabel(mode)}`, actions: [{ href: "/status/", label: "Open Status" }, { href: "/day-flow/", label: "Open Day Flow" }] })}<div class="controls"><span class="pill">Top ${visibleCount}</span><span class="pill">1m sampled activity</span><span class="pill">Visible tiles: 0</span><span class="pill">${getModeLabel(mode)}</span><span class="pill">Updated: ${escapeHtml(payload.updatedAt)}</span></div><section class="card page-section"><h2>No live streams in current snapshot</h2><p>${escapeHtml(payload.note ?? "The API returned no English Twitch streams for this moment.")}</p></section>${renderStatusNote(getModeNote(mode, payload, lowLoad, animationEnabled))}${renderFooter()}`
    return
  }

  const activityBreakdown = visibleNodes.reduce(
    (acc, node) => {
      const state = getActivityState(node)
      if (state === "active") acc.active += 1
      else if (state === "sampled_zero") acc.sampledZero += 1
      else if (state === "unavailable_sampled") acc.sampledUnavailable += 1
      else acc.notSampled += 1
      return acc
    },
    { active: 0, sampledZero: 0, sampledUnavailable: 0, notSampled: 0 }
  )

  root.className = "site-shell"
  root.innerHTML = `${renderHeader("heatmap")}${renderHero({ eyebrow: "NOW", title: "Heatmap", subtitle: "Production treemap for reading Twitch momentum at a glance.", note: `Area = viewers / green-red-blue-gray = momentum / activity is secondary. Current state: ${getModeLabel(mode)}`, actions: [{ href: "/status/", label: "Open Status" }, { href: "/day-flow/", label: "Open Day Flow" }] })}
    <div class="controls"><span class="pill">Top ${visibleCount}</span><span class="pill">1m sampled activity</span><button type="button" class="pill" data-low-load-toggle>Low Load: ${lowLoad ? "ON" : "OFF"}</button><button type="button" class="pill" data-animation-toggle>Animation: ${animationEnabled ? "ON" : "OFF"}</button><button type="button" class="pill" data-zoom-in>Zoom in</button><button type="button" class="pill" data-zoom-out>Zoom out</button><button type="button" class="pill" data-zoom-reset>Reset zoom</button><span class="pill">Visible tiles: ${visibleNodes.length}</span><span class="pill">${getModeLabel(mode)}</span><span class="pill">Updated: ${escapeHtml(payload.updatedAt)}</span></div>
    ${payload.note ? `<section class="card page-section"><p>${escapeHtml(payload.note)}</p></section>` : ""}
    <section class="summary-strip page-section"><div class="summary-item"><strong>Active streams</strong><span>${payload.summary.activeStreams}</span></div><div class="summary-item"><strong>Total viewers observed</strong><span>${payload.summary.totalViewers.toLocaleString()}</span></div><div class="summary-item"><strong>Highest activity</strong><span>${escapeHtml(payload.summary.highestAgitationName)}</span></div><div class="summary-item"><strong>Strongest momentum</strong><span>${escapeHtml(payload.summary.strongestMomentumName)}</span></div></section>
    <section class="card page-section"><h2>Now view treemap</h2><p class="muted">Tile area follows viewers. Momentum uses green (rising), red (falling), and blue-gray (flat). Activity markers only annotate sampled state and never override momentum color.</p><div class="heatmap-tile-stage" id="heatmapTileStage"></div><p class="muted">Wheel or pinch-like trackpad gesture to zoom. Drag while zoomed to pan.</p></section>
    <section class="card page-section"><h2>Activity sampling legend</h2><p class="muted">Sampled coverage in current window: ${activityBreakdown.active + activityBreakdown.sampledZero + activityBreakdown.sampledUnavailable} / ${visibleNodes.length} tiles. Sampled-zero and unavailable are intentionally distinct.</p><div class="heatmap-state-legend"><span class="heatmap-state-chip heatmap-state-chip--active">observed and active (${activityBreakdown.active})</span><span class="heatmap-state-chip heatmap-state-chip--sampled-zero">sampled · no activity (${activityBreakdown.sampledZero})</span><span class="heatmap-state-chip heatmap-state-chip--sampled-unavailable">sampled · unavailable (${activityBreakdown.sampledUnavailable})</span><span class="heatmap-state-chip heatmap-state-chip--not-sampled">not sampled in this window (${activityBreakdown.notSampled})</span></div></section>
    <section class="grid-2 page-section"><section class="card"><h2>Selected details</h2><div class="kv"><div class="kv-row"><span>Streamer</span><strong>${escapeHtml(selected.name)}</strong></div><div class="kv-row"><span>Current viewers</span><strong>${selected.viewers.toLocaleString()}</strong></div><div class="kv-row"><span>Momentum</span><strong>${formatMomentum(selected.momentum)}</strong></div><div class="kv-row"><span>Activity state</span><strong>${escapeHtml(formatActivityState(selected))}</strong></div><div class="kv-row"><span>Comments / min</span><strong>${selected.activityAvailable ? selected.commentsPerMin.toLocaleString() : "-"}</strong></div><div class="kv-row"><span>Activity level</span><strong>${selected.activityAvailable ? `Lv${selected.agitationLevel}` : "-"}</strong></div><div class="kv-row"><span>Viewer rank</span><strong>#${selected.rankViewers}</strong></div><div class="kv-row"><span>Open stream</span><strong><a href="${escapeHtml(selected.url)}" target="_blank" rel="noopener noreferrer">Open stream ↗</a></strong></div></div></section></section>
    ${renderStatusNote(getModeNote(mode, payload, lowLoad, animationEnabled))}${renderFooter()}`

  const tileStage = root.querySelector<HTMLElement>("#heatmapTileStage")
  if (!tileStage) throw new Error("tile stage not found")

  cleanupRenderer = mountSvgTreemapRenderer(tileStage, visibleNodes, selected.streamerId, (nextId) => renderReady(root, payload, mode, nextId), {
    zoomInButton: root.querySelector<HTMLButtonElement>("[data-zoom-in]"),
    zoomOutButton: root.querySelector<HTMLButtonElement>("[data-zoom-out]"),
    zoomResetButton: root.querySelector<HTMLButtonElement>("[data-zoom-reset]")
  })

  root.querySelector<HTMLButtonElement>("[data-low-load-toggle]")?.addEventListener("click", () => {
    writeLowLoadEnabled(!readLowLoadEnabled())
    renderReady(root, payload, mode, selected.streamerId)
  })
  root.querySelector<HTMLButtonElement>("[data-animation-toggle]")?.addEventListener("click", () => {
    writeAnimationEnabled(!readAnimationEnabled())
    renderReady(root, payload, mode, selected.streamerId)
  })
}

function renderLoading(root: HTMLElement): void {
  root.className = "site-shell"
  root.innerHTML = `${renderHeader("heatmap")}${renderHero({ eyebrow: "NOW", title: "Heatmap", subtitle: "Production treemap of live Twitch streams right now.", note: "Loading Heatmap data" })}<section class="card page-section"><h2>Loading</h2><p>Loading Heatmap data...</p></section>${renderFooter()}`
}

function renderError(root: HTMLElement, message: string): void {
  cleanupRenderer?.()
  cleanupRenderer = null
  root.className = "site-shell"
  root.innerHTML = `${renderHeader("heatmap")}${renderHero({ eyebrow: "NOW", title: "Heatmap", subtitle: "Production treemap of live Twitch streams right now.", note: "Heatmap data load failed" })}<section class="card page-section"><h2>Load failed</h2><p>${escapeHtml(message)}</p></section>${renderFooter()}`
}

export function renderHeatmapPage(root: HTMLElement): void {
  renderLoading(root)
  const refresh = () => {
    void loadHeatmapPageState().then((state) => {
      if (state.status === "ready") renderReady(root, state.payload, state.mode)
      else if (state.status === "error") renderError(root, state.message)
    })
  }
  refresh()
  if (pollTimer !== null) clearInterval(pollTimer)
  pollTimer = setInterval(refresh, 60_000) as unknown as number
}
