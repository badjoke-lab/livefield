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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function getSelectedNode(payload: HeatmapPayload, selectedStreamerId?: string): HeatmapNode {
  return payload.nodes.find((node) => node.streamerId === selectedStreamerId) ?? payload.nodes[0]
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
  return "Live-like"
}

function getModeNote(mode: HeatmapMode, lowLoad: boolean, animationEnabled: boolean): string {
  const modeText =
    mode === "demo"
      ? "This is demo data, not a live collection feed."
      : mode === "stale"
        ? "Data updates are delayed. What you see may not be current."
        : "The current payload is in a live-like state."

  return `${modeText} Low Load: ${lowLoad ? "ON" : "OFF"} / Animation: ${animationEnabled ? "ON" : "OFF"}`
}

function getVisibleNodeCount(): number {
  return readLowLoadEnabled() ? 5 : 9
}

function attachSelectorHandlers(
  root: HTMLElement,
  payload: HeatmapPayload,
  mode: HeatmapMode,
  selectedStreamerId: string
): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>("[data-streamer-id]")
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextId = button.dataset.streamerId
      if (!nextId || nextId === selectedStreamerId) return
      renderReady(root, payload, mode, nextId)
    })
  })

  const lowLoadButton = root.querySelector<HTMLButtonElement>("[data-low-load-toggle]")
  lowLoadButton?.addEventListener("click", () => {
    writeLowLoadEnabled(!readLowLoadEnabled())
    renderReady(root, payload, mode, selectedStreamerId)
  })

  const animationButton = root.querySelector<HTMLButtonElement>("[data-animation-toggle]")
  animationButton?.addEventListener("click", () => {
    writeAnimationEnabled(!readAnimationEnabled())
    renderReady(root, payload, mode, selectedStreamerId)
  })
}

function renderReady(
  root: HTMLElement,
  payload: HeatmapPayload,
  mode: HeatmapMode,
  selectedStreamerId?: string
): void {
  const visibleCount = getVisibleNodeCount()
  const visibleNodes = payload.nodes.slice(0, visibleCount)
  const selected = visibleNodes.find((node) => node.streamerId === selectedStreamerId) ?? visibleNodes[0]
  const lowLoad = readLowLoadEnabled()
  const animationEnabled = readAnimationEnabled()

  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("heatmap")}
    ${renderHero({
      eyebrow: "NOW",
      title: "Heatmap",
      subtitle: "A live bubble field for reading the Twitch stream landscape right now.",
      note: `Viewers = size / Activity = outer ring / Momentum = glow. Current state: ${getModeLabel(mode)}`,
      actions: [
        { href: "/status/", label: "Open Status" },
        { href: "/day-flow/", label: "Open Day Flow" }
      ]
    })}

    <div class="controls">
      <span class="pill">Top 50</span>
      <span class="pill">1m activity</span>
      <button type="button" class="pill" data-low-load-toggle>Low Load: ${lowLoad ? "ON" : "OFF"}</button>
      <button type="button" class="pill" data-animation-toggle>Animation: ${animationEnabled ? "ON" : "OFF"}</button>
      <span class="pill">Visible nodes: ${visibleCount}</span>
      <span class="pill">${getModeLabel(mode)}</span>
      <span class="pill">Updated: ${escapeHtml(payload.updatedAt)}</span>
    </div>

    <section class="summary-strip page-section">
      <div class="summary-item">
        <strong>Active streams</strong>
        <span>${payload.summary.activeStreams}</span>
      </div>
      <div class="summary-item">
        <strong>Total viewers observed</strong>
        <span>${payload.summary.totalViewers.toLocaleString()}</span>
      </div>
      <div class="summary-item">
        <strong>Highest activity</strong>
        <span>${escapeHtml(payload.summary.highestAgitationName)}</span>
      </div>
      <div class="summary-item">
        <strong>Strongest momentum</strong>
        <span>${escapeHtml(payload.summary.strongestMomentumName)}</span>
      </div>
    </section>

    <section class="grid-2 page-section">
      <section class="heatmap-mock-card">
        <div class="heatmap-mock-card__head">
          <div>
            <strong>Live field</strong>
            <p>Switch Low Load and Animation while keeping the same Heatmap readable and lightweight.</p>
          </div>
          <div class="heatmap-mock-modes">
            <span class="pill">Bubble</span>
            <span class="pill heatmap-mock-pill--off">Cluster</span>
            <span class="pill heatmap-mock-pill--off">Force</span>
          </div>
        </div>

        <div class="heatmap-mock-stage">
          <canvas id="heatmapCanvas" class="heatmap-canvas"></canvas>

          <div class="heatmap-mock-overlay">
            <div class="heatmap-legend-mini">
              <span><i class="legend-dot legend-dot--size"></i> Direct node click enabled</span>
              <span><i class="legend-dot legend-dot--shake"></i> Activity signal applied</span>
              <span><i class="legend-dot legend-dot--glow"></i> Momentum signal applied</span>
            </div>
          </div>
        </div>
      </section>

      <section class="heatmap-side">
        <section class="card">
          <h2>Quick select</h2>
          <div class="focus-chip-row">
            ${visibleNodes.slice(0, 6).map((node) => `
              <button
                type="button"
                class="focus-chip ${node.streamerId === selected.streamerId ? "focus-chip--active" : ""}"
                data-streamer-id="${node.streamerId}"
              >${escapeHtml(node.name)}</button>
            `).join("")}
          </div>
          <p class="code-note" style="margin-top:12px">You can switch to the same stream directly from the canvas.</p>
        </section>

        <section class="card">
          <h2>Selected details</h2>
          <div class="kv">
            <div class="kv-row"><span>Streamer</span><strong>${escapeHtml(selected.name)}</strong></div>
            <div class="kv-row"><span>Current viewers</span><strong>${selected.viewers.toLocaleString()}</strong></div>
            <div class="kv-row"><span>Activity / min</span><strong>${selected.commentsPerMin}</strong></div>
            <div class="kv-row"><span>Activity level</span><strong>Lv${selected.agitationLevel}</strong></div>
            <div class="kv-row"><span>Momentum</span><strong>${formatMomentum(selected.momentum)}</strong></div>
            <div class="kv-row"><span>Viewer rank</span><strong>#${selected.rankViewers}</strong></div>
            <div class="kv-row"><span>Activity rank</span><strong>#${selected.rankAgitation}</strong></div>
          </div>
        </section>
      </section>
    </section>

    ${renderStatusNote(getModeNote(mode, lowLoad, animationEnabled))}
    ${renderFooter()}
  `

  const canvas = root.querySelector<HTMLCanvasElement>("#heatmapCanvas")
  if (!canvas) {
    throw new Error("heatmap canvas not found")
  }

  rendererCleanup?.()
  const renderer = mountHeatmapRenderer(canvas, payload, selected.streamerId, (nextId) => {
    renderReady(root, payload, mode, nextId)
  })
  rendererCleanup = () => renderer.destroy()

  attachSelectorHandlers(root, payload, mode, selected.streamerId)
}

function renderLoading(root: HTMLElement): void {
  rendererCleanup?.()
  rendererCleanup = null

  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("heatmap")}
    ${renderHero({
      eyebrow: "NOW",
      title: "Heatmap",
      subtitle: "A live bubble field for reading the Twitch stream landscape right now.",
      note: "Loading Heatmap data"
    })}
    <section class="card page-section">
      <h2>Loading</h2>
      <p>Loading Heatmap data...</p>
    </section>
    ${renderStatusNote("Status: loading")}
    ${renderFooter()}
  `
}

function renderError(root: HTMLElement, message: string): void {
  rendererCleanup?.()
  rendererCleanup = null

  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("heatmap")}
    ${renderHero({
      eyebrow: "NOW",
      title: "Heatmap",
      subtitle: "A live bubble field for reading the Twitch stream landscape right now.",
      note: "Heatmap data load failed"
    })}
    <section class="card page-section">
      <h2>Load failed</h2>
      <p>${escapeHtml(message)}</p>
    </section>
    ${renderStatusNote("Status: error")}
    ${renderFooter()}
  `
}

export function renderHeatmapPage(root: HTMLElement): void {
  renderLoading(root)

  void loadHeatmapPageState().then((state) => {
    if (state.status === "ready") {
      renderReady(root, state.payload, state.mode)
      return
    }

    if (state.status === "error") {
      renderError(root, state.message)
    }
  })
}
