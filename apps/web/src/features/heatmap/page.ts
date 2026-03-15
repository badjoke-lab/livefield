import type { HeatmapPayload } from "../../../../../packages/shared/src/types/heatmap"
import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"
import { readAnimationEnabled, writeAnimationEnabled } from "../../shared/runtime/animation-mode"
import { readLowLoadEnabled, writeLowLoadEnabled } from "../../shared/runtime/low-load-mode"
import { formatActivityState, getActivityState } from "./activity-state"
import { mountHeatmapRenderer } from "./renderer"
import { mountTileMockRenderer } from "./renderer/tile-mock"
import { loadHeatmapPageState, type HeatmapMode } from "./state"

let rendererCleanup: (() => void) | null = null
let pollTimer: number | null = null

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;")
}

function formatMomentum(momentum: number): string {
  if (momentum >= 0.15) return "Strong rise"
  if (momentum >= 0.08) return "Rising"
  if (momentum >= 0.03) return "Slight up"
  if (momentum >= 0) return "Flat"
  return "Slowing"
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
          ? "Sampled activity is partial; unavailable channels and sampled-zero channels are shown separately while viewers and momentum still update."
          : "The current payload is in a live-like state."

  return `${modeText} ${payload.note ?? ""} Low Load: ${lowLoad ? "ON" : "OFF"} / Animation: ${animationEnabled ? "ON" : "OFF"}`
}

function renderReady(root: HTMLElement, payload: HeatmapPayload, mode: HeatmapMode, selectedStreamerId?: string): void {
  const visibleCount = readLowLoadEnabled() ? 5 : 9
  const visibleNodes = payload.nodes.slice(0, visibleCount)
  const selected = visibleNodes.find((node) => node.streamerId === selectedStreamerId) ?? visibleNodes[0]
  const lowLoad = readLowLoadEnabled()
  const animationEnabled = readAnimationEnabled()

  if (!selected) {
    root.className = "site-shell"
    root.innerHTML = `${renderHeader("heatmap")}${renderHero({ eyebrow: "NOW", title: "Heatmap", subtitle: "A live bubble field for reading the Twitch stream landscape right now.", note: `Viewers = size / Activity = marker / Momentum = edge. Current state: ${getModeLabel(mode)}`, actions: [{ href: "/status/", label: "Open Status" }, { href: "/day-flow/", label: "Open Day Flow" }] })}<div class="controls"><span class="pill">Top 50</span><span class="pill">1m activity</span><span class="pill">Visible nodes: 0</span><span class="pill">${getModeLabel(mode)}</span><span class="pill">Updated: ${escapeHtml(payload.updatedAt)}</span></div><section class="card page-section"><h2>No live streams in current snapshot</h2><p>${escapeHtml(payload.note ?? "The API returned no English Twitch streams for this moment.")}</p></section>${renderStatusNote(getModeNote(mode, payload, lowLoad, animationEnabled))}${renderFooter()}`
    rendererCleanup?.()
    rendererCleanup = null
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
  root.innerHTML = `${renderHeader("heatmap")}${renderHero({ eyebrow: "NOW", title: "Heatmap", subtitle: "Compare renderer readability with the same live payload while keeping Now-view priorities.", note: `Viewers = primary / Momentum = secondary / Activity = helper. Current state: ${getModeLabel(mode)}`, actions: [{ href: "/status/", label: "Open Status" }, { href: "/day-flow/", label: "Open Day Flow" }] })}
    <div class="controls"><span class="pill">Top 50</span><span class="pill">1m activity</span><button type="button" class="pill" data-low-load-toggle>Low Load: ${lowLoad ? "ON" : "OFF"}</button><button type="button" class="pill" data-animation-toggle>Animation: ${animationEnabled ? "ON" : "OFF"}</button><span class="pill">Visible nodes: ${visibleCount}</span><span class="pill">${getModeLabel(mode)}</span><span class="pill">Updated: ${escapeHtml(payload.updatedAt)}</span></div>
    ${payload.note ? `<section class="card page-section"><p>${escapeHtml(payload.note)}</p></section>` : ""}
    <section class="summary-strip page-section"><div class="summary-item"><strong>Active streams</strong><span>${payload.summary.activeStreams}</span></div><div class="summary-item"><strong>Total viewers observed</strong><span>${payload.summary.totalViewers.toLocaleString()}</span></div><div class="summary-item"><strong>Highest activity</strong><span>${escapeHtml(payload.summary.highestAgitationName)}</span></div><div class="summary-item"><strong>Strongest momentum</strong><span>${escapeHtml(payload.summary.strongestMomentumName)}</span></div></section>
    <section class="grid-2 page-section heatmap-compare-grid"><section class="heatmap-mock-card"><div class="heatmap-mock-card__head"><div><strong>Bubble renderer mock</strong><p>Current bubble style with live payload. Viewers lead through radius, momentum via glow, activity as outer ring signal.</p></div><div class="heatmap-mock-modes"><span class="pill">Bubble</span><span class="pill heatmap-mock-pill--off">Tile</span></div></div><div class="heatmap-mock-stage"><canvas id="heatmapCanvas" class="heatmap-canvas"></canvas></div></section><section class="heatmap-mock-card"><div class="heatmap-mock-card__head"><div><strong>Tile / treemap renderer mock</strong><p>Same payload, area by viewers. Momentum uses edge emphasis, activity state uses corner badge so unavailable is never shown as zero.</p></div><div class="heatmap-mock-modes"><span class="pill heatmap-mock-pill--off">Bubble</span><span class="pill">Tile/Treemap</span></div></div><div class="heatmap-tile-stage" id="heatmapTileStage"></div></section></section>
    <section class="card page-section"><h2>Shared activity semantics (same for both renderers)</h2><div class="heatmap-state-legend"><span class="heatmap-state-chip heatmap-state-chip--active">observed and active (${activityBreakdown.active})</span><span class="heatmap-state-chip heatmap-state-chip--sampled-zero">sampled only, no activity (${activityBreakdown.sampledZero})</span><span class="heatmap-state-chip heatmap-state-chip--sampled-unavailable">sampled but unavailable (${activityBreakdown.sampledUnavailable})</span><span class="heatmap-state-chip heatmap-state-chip--not-sampled">not sampled in this window (${activityBreakdown.notSampled})</span></div></section>
    <section class="grid-2 page-section"><section class="heatmap-side"><section class="card"><h2>Quick select</h2><div class="focus-chip-row">${visibleNodes.slice(0, 6).map((node) => `<button type="button" class="focus-chip ${node.streamerId === selected.streamerId ? "focus-chip--active" : ""}" data-focus-streamer-id="${node.streamerId}">${escapeHtml(node.name)}</button>`).join("")}</div></section></section><section class="card"><h2>Selected details (shared)</h2><div class="kv"><div class="kv-row"><span>Streamer</span><strong>${escapeHtml(selected.name)}</strong></div><div class="kv-row"><span>Current viewers</span><strong>${selected.viewers.toLocaleString()}</strong></div><div class="kv-row"><span>Activity state</span><strong>${escapeHtml(formatActivityState(selected))}</strong></div><div class="kv-row"><span>Comment count</span><strong>${selected.activityAvailable ? selected.commentCount.toLocaleString() : "-"}</strong></div><div class="kv-row"><span>Delta comments</span><strong>${selected.activityAvailable ? selected.deltaComments.toLocaleString() : "-"}</strong></div><div class="kv-row"><span>Comments / min</span><strong>${selected.activityAvailable ? selected.commentsPerMin.toLocaleString() : "-"}</strong></div><div class="kv-row"><span>Activity level</span><strong>${selected.activityAvailable ? `Lv${selected.agitationLevel}` : "-"}</strong></div><div class="kv-row"><span>Momentum</span><strong>${formatMomentum(selected.momentum)}</strong></div><div class="kv-row"><span>Viewer rank</span><strong>#${selected.rankViewers}</strong></div></div></section></section>
    ${renderStatusNote(getModeNote(mode, payload, lowLoad, animationEnabled))}${renderFooter()}`

  const canvas = root.querySelector<HTMLCanvasElement>("#heatmapCanvas")
  if (!canvas) throw new Error("heatmap canvas not found")
  rendererCleanup?.()
  const renderer = mountHeatmapRenderer(canvas, payload, selected.streamerId, (nextId) => renderReady(root, payload, mode, nextId))
  rendererCleanup = () => renderer.destroy()

  const tileStage = root.querySelector<HTMLElement>("#heatmapTileStage")
  if (!tileStage) throw new Error("tile mock stage not found")
  mountTileMockRenderer(tileStage, visibleNodes, selected.streamerId, (nextId) => renderReady(root, payload, mode, nextId))

  root.querySelectorAll<HTMLButtonElement>("[data-focus-streamer-id]").forEach((button) =>
    button.addEventListener("click", () => {
      const nextId = button.dataset.focusStreamerId
      if (nextId) renderReady(root, payload, mode, nextId)
    })
  )
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
  root.innerHTML = `${renderHeader("heatmap")}${renderHero({ eyebrow: "NOW", title: "Heatmap", subtitle: "A live bubble field for reading the Twitch stream landscape right now.", note: "Loading Heatmap data" })}<section class="card page-section"><h2>Loading</h2><p>Loading Heatmap data...</p></section>${renderFooter()}`
}

function renderError(root: HTMLElement, message: string): void {
  root.className = "site-shell"
  root.innerHTML = `${renderHeader("heatmap")}${renderHero({ eyebrow: "NOW", title: "Heatmap", subtitle: "A live bubble field for reading the Twitch stream landscape right now.", note: "Heatmap data load failed" })}<section class="card page-section"><h2>Load failed</h2><p>${escapeHtml(message)}</p></section>${renderFooter()}`
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
