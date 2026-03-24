import type { HeatmapPayload } from "../../../../../packages/shared/src/types/heatmap"
import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"
import { readAnimationEnabled, writeAnimationEnabled } from "../../shared/runtime/animation-mode"
import { readLowLoadEnabled, writeLowLoadEnabled } from "../../shared/runtime/low-load-mode"
import { getActivityState } from "./activity-state"
import { renderHeatmapDetailPanel } from "./detail-panel"
import { mountSvgTreemapRenderer } from "./renderer/svg-treemap"
import { renderHeatmapSummary } from "./summary"
import { loadHeatmapPageState, type HeatmapMode } from "./state"

let pollTimer: number | null = null
let cleanupRenderer: (() => void) | null = null

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;")
}

function getModeLabel(mode: HeatmapMode): string {
  if (mode === "demo") return "Demo data"
  if (mode === "error") return "Error state"
  if (mode === "empty") return "Empty state"
  if (mode === "stale") return "Stale data"
  if (mode === "partial") return "Partial data"
  return "Live data"
}

function getModeNote(mode: HeatmapMode, payload: HeatmapPayload, lowLoad: boolean, animationEnabled: boolean, isHistorical: boolean): string {
  const modeText =
    mode === "demo"
      ? "This is demo data, not a live collection feed."
      : mode === "error"
        ? "Heatmap payload is in an error fallback state."
        : mode === "empty"
          ? isHistorical
            ? "No historical frame exists for this selection."
            : "No streams were available in the latest observed window."
      : mode === "stale"
        ? isHistorical
          ? "Playback is from historical storage and is not a live feed."
          : "Data updates are delayed beyond the freshness target."
        : mode === "partial"
          ? "Coverage is partial for this frame; viewer and momentum values are shown for observed channels while activity chips reflect unavailable states."
          : isHistorical
            ? "Frame playback loaded from history."
            : "The current payload is live for the observed window."

  return `${modeText} ${payload.note ?? ""} Low Load: ${lowLoad ? "ON" : "OFF"} / Animation: ${animationEnabled ? "ON" : "OFF"}`
}

function renderReady(
  root: HTMLElement,
  payload: HeatmapPayload,
  mode: HeatmapMode,
  frameLabel: string,
  isHistorical: boolean,
  selectedStreamerId?: string
): void {
  cleanupRenderer?.()
  cleanupRenderer = null

  const lowLoad = readLowLoadEnabled()
  const animationEnabled = readAnimationEnabled()
  const visibleCount = lowLoad ? 24 : 50
  const visibleNodes = payload.nodes.slice(0, visibleCount)
  const selected = visibleNodes.find((node) => node.streamerId === selectedStreamerId) ?? visibleNodes[0]

  if (!selected) {
    root.className = "site-shell"
    root.innerHTML = `${renderHeader("heatmap")}${renderHero({ eyebrow: isHistorical ? "PLAYBACK" : "NOW", title: "Heatmap", subtitle: isHistorical ? "Historical heatmap frame playback." : "Production treemap of live Twitch streams right now.", note: `Treemap area = viewers / color = momentum / badges = sampled activity state. ${escapeHtml(frameLabel)} · ${getModeLabel(mode)}.`, actions: [{ href: "/status/", label: "Open Status" }, { href: "/day-flow/", label: "Open Day Flow" }] })}<div class="controls controls--heatmap controls--heatmap-pre"><span class="pill">Top ${visibleCount}</span><span class="pill">${isHistorical ? "Historical frame" : "1m sampled activity"}</span><span class="pill">Visible tiles: 0</span><span class="pill">${escapeHtml(frameLabel)}</span><span class="pill">${getModeLabel(mode)}</span><span class="pill">Updated: ${escapeHtml(payload.updatedAt)}</span></div><section class="card page-section"><h2>${isHistorical ? "No historical frame found" : "No streams in current observed window"}</h2><p>${escapeHtml(payload.note ?? (isHistorical ? "No historical frame is available for this selection." : "The API returned no English Twitch streams for this observed window."))}</p></section>${renderStatusNote(getModeNote(mode, payload, lowLoad, animationEnabled, isHistorical))}${renderFooter()}`
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
  root.innerHTML = `${renderHeader("heatmap")}${renderHero({ eyebrow: isHistorical ? "PLAYBACK" : "NOW", title: "Heatmap", subtitle: isHistorical ? "Historical treemap playback for reading Twitch momentum frame-by-frame." : "Production treemap for reading Twitch momentum at a glance.", note: `Area = viewers / color = momentum / activity = sampled overlay. ${escapeHtml(frameLabel)} · ${getModeLabel(mode)}.`, actions: [{ href: "/status/", label: "Open Status" }, { href: "/day-flow/", label: "Open Day Flow" }] })}
    <section class="card page-section heatmap-state-note">${payload.note ? `<p>${escapeHtml(payload.note)}</p>` : `<p class="muted">Snapshot status: ${getModeLabel(mode)}.</p>`}</section>
    <section class="card page-section heatmap-map-section"><h2>${isHistorical ? "Historical frame treemap" : "Now view treemap"}</h2><p class="muted">Tile area follows viewers. Click empty map space to enter map focus, then use wheel to zoom and drag to pan. Press Esc or click outside map to exit focus.</p><div class="heatmap-tile-stage" id="heatmapTileStage"></div><div class="heatmap-map-helper"><span class="pill heatmap-map-helper__hint" data-focus-status>Map focus: OFF (wheel scrolls page)</span><button type="button" class="pill" data-map-focus-toggle>Focus map</button><button type="button" class="pill" data-zoom-in>Zoom in</button><button type="button" class="pill" data-zoom-out>Zoom out</button><button type="button" class="pill" data-zoom-reset>Reset zoom</button></div></section>
    <div class="controls controls--heatmap controls--heatmap-post"><span class="pill">Top ${visibleCount}</span><span class="pill">${isHistorical ? "Historical frame" : "1m sampled activity"}</span><button type="button" class="pill" data-low-load-toggle>Low Load: ${lowLoad ? "ON" : "OFF"}</button><button type="button" class="pill" data-animation-toggle>Animation: ${animationEnabled ? "ON" : "OFF"}</button><span class="pill">Visible tiles: ${visibleNodes.length}</span><span class="pill">${escapeHtml(frameLabel)}</span><span class="pill">${getModeLabel(mode)}</span><span class="pill">Updated: ${escapeHtml(payload.updatedAt)}</span></div>
    ${renderHeatmapDetailPanel(selected, isHistorical)}
    <section class="card page-section heatmap-legend-section"><h2>Activity sampling legend</h2><p class="muted">Sampled coverage: ${activityBreakdown.active + activityBreakdown.sampledZero + activityBreakdown.sampledUnavailable} / ${visibleNodes.length} tiles.</p><div class="heatmap-state-legend"><span class="heatmap-state-chip heatmap-state-chip--active">active (${activityBreakdown.active})</span><span class="heatmap-state-chip heatmap-state-chip--sampled-zero">sampled · zero (${activityBreakdown.sampledZero})</span><span class="heatmap-state-chip heatmap-state-chip--sampled-unavailable">sampled · unavailable (${activityBreakdown.sampledUnavailable})</span><span class="heatmap-state-chip heatmap-state-chip--not-sampled">not sampled (${activityBreakdown.notSampled})</span></div></section>
    ${renderHeatmapSummary(payload, isHistorical)}
    ${renderStatusNote({
      eyebrow: isHistorical ? "PLAYBACK COVERAGE" : "LIVE COVERAGE",
      title: "How to read Heatmap status",
      body: getModeNote(mode, payload, lowLoad, animationEnabled, isHistorical),
      items: isHistorical
        ? [
            "historical playback reads saved frames, not a live collector window",
            "partial means the saved frame came from limited observed coverage",
            "activity chips still reflect sampled availability, not universal chat coverage"
          ]
        : [
            "partial = the frame reflects observed channels/pages, not the full live directory",
            "sampled activity applies only where the collector has chat coverage",
            "hasMore/partial states are expected while live collection is still paging"
          ],
      tone: mode === "partial" || mode === "stale" ? "warning" : "info"
    })}${renderFooter()}`

  const tileStage = root.querySelector<HTMLElement>("#heatmapTileStage")
  if (!tileStage) throw new Error("tile stage not found")

  cleanupRenderer = mountSvgTreemapRenderer(tileStage, visibleNodes, selected.streamerId, (nextId) => renderReady(root, payload, mode, frameLabel, isHistorical, nextId), {
    zoomInButton: root.querySelector<HTMLButtonElement>("[data-zoom-in]"),
    zoomOutButton: root.querySelector<HTMLButtonElement>("[data-zoom-out]"),
    zoomResetButton: root.querySelector<HTMLButtonElement>("[data-zoom-reset]"),
    focusButton: root.querySelector<HTMLButtonElement>("[data-map-focus-toggle]"),
    focusStatus: root.querySelector<HTMLElement>("[data-focus-status]")
  })

  root.querySelector<HTMLButtonElement>("[data-low-load-toggle]")?.addEventListener("click", () => {
    writeLowLoadEnabled(!readLowLoadEnabled())
    renderReady(root, payload, mode, frameLabel, isHistorical, selected.streamerId)
  })
  root.querySelector<HTMLButtonElement>("[data-animation-toggle]")?.addEventListener("click", () => {
    writeAnimationEnabled(!readAnimationEnabled())
    renderReady(root, payload, mode, frameLabel, isHistorical, selected.streamerId)
  })
}

function renderLoading(root: HTMLElement): void {
  root.className = "site-shell"
  root.innerHTML = `${renderHeader("heatmap")}${renderHero({ eyebrow: "NOW", title: "Heatmap", subtitle: "Production treemap of live Twitch streams right now.", note: "Loading Heatmap data" })}<section class="card page-section"><h2>Loading</h2><p>Loading Heatmap frame...</p></section>${renderFooter()}`
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
      if (state.status === "ready") renderReady(root, state.payload, state.mode, state.frameLabel, state.isHistorical)
      else if (state.status === "error") renderError(root, state.message)
    })
  }
  refresh()
  if (pollTimer !== null) clearInterval(pollTimer)
  const params = new URLSearchParams(window.location.search)
  const isHistorical = params.get("day") === "yesterday" || (params.get("day") === "date" && Boolean(params.get("date")))
  if (!isHistorical) pollTimer = setInterval(refresh, 60_000) as unknown as number
}
