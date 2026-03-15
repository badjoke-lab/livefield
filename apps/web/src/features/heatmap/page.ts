import type { HeatmapNode, HeatmapPayload } from "../../../../../packages/shared/src/types/heatmap"
import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"
import { readAnimationEnabled, writeAnimationEnabled } from "../../shared/runtime/animation-mode"
import { readLowLoadEnabled, writeLowLoadEnabled } from "../../shared/runtime/low-load-mode"
import { mountHeatmapRenderer } from "./renderer"
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
          ? "Some activity data is unavailable; viewers and momentum still update."
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
    root.innerHTML = `${renderHeader("heatmap")}${renderHero({ eyebrow: "NOW", title: "Heatmap", subtitle: "A live bubble field for reading the Twitch stream landscape right now.", note: `Viewers = size / Activity = outer ring / Momentum = glow. Current state: ${getModeLabel(mode)}`, actions: [{ href: "/status/", label: "Open Status" }, { href: "/day-flow/", label: "Open Day Flow" }] })}<div class="controls"><span class="pill">Top 50</span><span class="pill">1m activity</span><span class="pill">Visible nodes: 0</span><span class="pill">${getModeLabel(mode)}</span><span class="pill">Updated: ${escapeHtml(payload.updatedAt)}</span></div><section class="card page-section"><h2>No live streams in current snapshot</h2><p>${escapeHtml(payload.note ?? "The API returned no English Twitch streams for this moment.")}</p></section>${renderStatusNote(getModeNote(mode, payload, lowLoad, animationEnabled))}${renderFooter()}`
    rendererCleanup?.(); rendererCleanup = null; return
  }

  root.className = "site-shell"
  root.innerHTML = `${renderHeader("heatmap")}${renderHero({ eyebrow: "NOW", title: "Heatmap", subtitle: "A live bubble field for reading the Twitch stream landscape right now.", note: `Viewers = size / Activity = outer ring / Momentum = glow. Current state: ${getModeLabel(mode)}`, actions: [{ href: "/status/", label: "Open Status" }, { href: "/day-flow/", label: "Open Day Flow" }] })}
    <div class="controls"><span class="pill">Top 50</span><span class="pill">1m activity</span><button type="button" class="pill" data-low-load-toggle>Low Load: ${lowLoad ? "ON" : "OFF"}</button><button type="button" class="pill" data-animation-toggle>Animation: ${animationEnabled ? "ON" : "OFF"}</button><span class="pill">Visible nodes: ${visibleCount}</span><span class="pill">${getModeLabel(mode)}</span><span class="pill">Updated: ${escapeHtml(payload.updatedAt)}</span></div>
    ${payload.note ? `<section class="card page-section"><p>${escapeHtml(payload.note)}</p></section>` : ""}
    <section class="summary-strip page-section"><div class="summary-item"><strong>Active streams</strong><span>${payload.summary.activeStreams}</span></div><div class="summary-item"><strong>Total viewers observed</strong><span>${payload.summary.totalViewers.toLocaleString()}</span></div><div class="summary-item"><strong>Highest activity</strong><span>${escapeHtml(payload.summary.highestAgitationName)}</span></div><div class="summary-item"><strong>Strongest momentum</strong><span>${escapeHtml(payload.summary.strongestMomentumName)}</span></div></section>
    <section class="grid-2 page-section"><section class="heatmap-mock-card"><div class="heatmap-mock-card__head"><div><strong>Live field</strong><p>Switch Low Load and Animation while keeping the same Heatmap readable and lightweight.</p></div><div class="heatmap-mock-modes"><span class="pill">Bubble</span><span class="pill heatmap-mock-pill--off">Cluster</span><span class="pill heatmap-mock-pill--off">Force</span></div></div><div class="heatmap-mock-stage"><canvas id="heatmapCanvas" class="heatmap-canvas"></canvas></div></section><section class="heatmap-side"><section class="card"><h2>Quick select</h2><div class="focus-chip-row">${visibleNodes.slice(0,6).map((node)=>`<button type="button" class="focus-chip ${node.streamerId===selected.streamerId?"focus-chip--active":""}" data-streamer-id="${node.streamerId}">${escapeHtml(node.name)}</button>`).join("")}</div></section><section class="card"><h2>Selected details</h2><div class="kv"><div class="kv-row"><span>Streamer</span><strong>${escapeHtml(selected.name)}</strong></div><div class="kv-row"><span>Current viewers</span><strong>${selected.viewers.toLocaleString()}</strong></div><div class="kv-row"><span>Comment count</span><strong>${selected.commentCount.toLocaleString()}</strong></div><div class="kv-row"><span>Delta comments</span><strong>${selected.deltaComments.toLocaleString()}</strong></div><div class="kv-row"><span>Comments / min</span><strong>${selected.commentsPerMin.toLocaleString()}</strong></div><div class="kv-row"><span>Activity level</span><strong>Lv${selected.agitationLevel}</strong></div><div class="kv-row"><span>Momentum</span><strong>${formatMomentum(selected.momentum)}</strong></div><div class="kv-row"><span>Viewer rank</span><strong>#${selected.rankViewers}</strong></div></div></section></section></section>
    ${renderStatusNote(getModeNote(mode, payload, lowLoad, animationEnabled))}${renderFooter()}`

  const canvas = root.querySelector<HTMLCanvasElement>("#heatmapCanvas")
  if (!canvas) throw new Error("heatmap canvas not found")
  rendererCleanup?.()
  const renderer = mountHeatmapRenderer(canvas, payload, selected.streamerId, (nextId) => renderReady(root, payload, mode, nextId))
  rendererCleanup = () => renderer.destroy()

  root.querySelectorAll<HTMLButtonElement>("[data-streamer-id]").forEach((button) => button.addEventListener("click", () => {
    const nextId = button.dataset.streamerId
    if (nextId) renderReady(root, payload, mode, nextId)
  }))
  root.querySelector<HTMLButtonElement>("[data-low-load-toggle]")?.addEventListener("click", () => { writeLowLoadEnabled(!readLowLoadEnabled()); renderReady(root, payload, mode, selected.streamerId) })
  root.querySelector<HTMLButtonElement>("[data-animation-toggle]")?.addEventListener("click", () => { writeAnimationEnabled(!readAnimationEnabled()); renderReady(root, payload, mode, selected.streamerId) })
}

function renderLoading(root: HTMLElement): void { root.className = "site-shell"; root.innerHTML = `${renderHeader("heatmap")}${renderHero({ eyebrow: "NOW", title: "Heatmap", subtitle: "A live bubble field for reading the Twitch stream landscape right now.", note: "Loading Heatmap data" })}<section class="card page-section"><h2>Loading</h2><p>Loading Heatmap data...</p></section>${renderFooter()}` }

function renderError(root: HTMLElement, message: string): void { root.className = "site-shell"; root.innerHTML = `${renderHeader("heatmap")}${renderHero({ eyebrow: "NOW", title: "Heatmap", subtitle: "A live bubble field for reading the Twitch stream landscape right now.", note: "Heatmap data load failed" })}<section class="card page-section"><h2>Load failed</h2><p>${escapeHtml(message)}</p></section>${renderFooter()}` }

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
