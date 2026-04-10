import { renderKickShell } from "../kick-shell/render"
import {
  getKickHeatmapScaffoldPayload,
  type KickHeatmapScaffoldPayload
} from "../../shared/api/kick-heatmap-api"

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function fmtText(value: string | null | undefined, fallback = "—"): string {
  return value && value.trim() ? esc(value) : fallback
}

function fmtNum(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US") : "—"
}

function renderBody(args: {
  state: string
  coverage: string
  note: string
  activeStreams: number
  totalViewersObserved: number
  strongestMomentumStream: string | null
  highestActivityStream: string | null
}): string {
  return `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-label">NOW</div>
        <h1>Kick Heatmap</h1>
        <p>
          Live snapshot summary for the current Kick field.
          The tile renderer is not wired yet.
        </p>
      </div>
    </section>

    <section class="summary-strip page-section">
      <div class="summary-item"><strong>State</strong><span>${esc(args.state)}</span></div>
      <div class="summary-item"><strong>Coverage</strong><span>${esc(args.coverage)}</span></div>
      <div class="summary-item"><strong>Observed</strong><span>${fmtNum(args.activeStreams)}</span></div>
      <div class="summary-item"><strong>Viewers</strong><span>${fmtNum(args.totalViewersObserved)}</span></div>
    </section>

    <section class="card page-section">
      <h2>Current note</h2>
      <p>${esc(args.note)}</p>
    </section>

    <section class="card page-section">
      <h2>Strongest signals in current snapshot</h2>
      <div class="kv-row"><strong>Strongest momentum stream</strong><span>${fmtText(args.strongestMomentumStream)}</span></div>
      <div class="kv-row"><strong>Highest activity stream</strong><span>${fmtText(args.highestActivityStream, "Not available")}</span></div>
    </section>

    <section class="card page-section">
      <h2>What is live now</h2>
      <ul class="feature-list">
        <li><strong>Observed streams</strong> in the current Kick snapshot</li>
        <li><strong>Total viewers observed</strong> across the current top set</li>
        <li><strong>Momentum/activity leaders</strong> from the current payload</li>
      </ul>
    </section>
  `
}

export async function renderKickHeatmapPage(root: HTMLElement): Promise<void> {
  root.className = "site-shell kick-site"
  root.innerHTML = renderKickShell("heatmap", renderBody({
    state: "loading",
    coverage: "Loading...",
    note: "Loading Kick Heatmap live snapshot state...",
    activeStreams: 0,
    totalViewersObserved: 0,
    strongestMomentumStream: null,
    highestActivityStream: null
  }))

  try {
    const payload = await getKickHeatmapScaffoldPayload()
    root.innerHTML = renderKickShell("heatmap", renderBody({
      state: payload.state,
      coverage: payload.coverage,
      note: payload.note,
      activeStreams: payload.summary.activeStreams,
      totalViewersObserved: payload.summary.totalViewersObserved,
      strongestMomentumStream: payload.summary.strongestMomentumStream,
      highestActivityStream: payload.summary.highestActivityStream
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    root.innerHTML = renderKickShell("heatmap", renderBody({
      state: "error",
      coverage: "Kick Heatmap request failed.",
      note: message,
      activeStreams: 0,
      totalViewersObserved: 0,
      strongestMomentumStream: null,
      highestActivityStream: null
    }))
  }
}
