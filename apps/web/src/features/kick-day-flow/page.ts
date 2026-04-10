import { renderKickShell } from "../kick-shell/render"
import {
  getKickDayFlowScaffoldPayload,
  type KickDayFlowScaffoldPayload
} from "../../shared/api/kick-day-flow-api"

type KickDayFlowPoint = {
  ts: string
  totalViewersObserved: number
  observedCount: number
  strongestStreamer: string | null
}

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

function normalizePoints(payload: KickDayFlowScaffoldPayload): KickDayFlowPoint[] {
  return (payload.points as KickDayFlowPoint[]).filter((point) =>
    point &&
    typeof point.ts === "string"
  )
}

function renderPoints(points: KickDayFlowPoint[]): string {
  if (!points.length) {
    return `
      <section class="card page-section">
        <h2>Observed windows</h2>
        <p>No Kick day-flow windows are available yet.</p>
      </section>
    `
  }

  return `
    <section class="card page-section">
      <h2>Observed windows</h2>
      <div class="battle-detail-sections">
        ${points.slice(0, 12).map((point, index) => `
          <article class="battle-detail-card">
            <h3>#${index + 1} ${esc(point.ts)}</h3>
            <div class="kv-row"><strong>Total viewers observed</strong><span>${fmtNum(point.totalViewersObserved)}</span></div>
            <div class="kv-row"><strong>Observed streams</strong><span>${fmtNum(point.observedCount)}</span></div>
            <div class="kv-row"><strong>Strongest streamer</strong><span>${fmtText(point.strongestStreamer)}</span></div>
          </article>
        `).join("")}
      </div>
    </section>
  `
}

function renderBody(args: {
  state: string
  coverage: string
  note: string
  observedBuckets: number
  totalViewersObserved: number
  strongestWindow: string | null
  strongestStreamer: string | null
  points: KickDayFlowPoint[]
}): string {
  return `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-label">TODAY</div>
        <h1>Kick Day Flow</h1>
        <p>
          Snapshot-based Kick day view using repeated top-viewer windows.
          Ownership bands are not wired yet.
        </p>
      </div>
    </section>

    <section class="summary-strip page-section">
      <div class="summary-item"><strong>State</strong><span>${esc(args.state)}</span></div>
      <div class="summary-item"><strong>Coverage</strong><span>${esc(args.coverage)}</span></div>
      <div class="summary-item"><strong>Observed buckets</strong><span>${fmtNum(args.observedBuckets)}</span></div>
      <div class="summary-item"><strong>Total viewers</strong><span>${fmtNum(args.totalViewersObserved)}</span></div>
    </section>

    <section class="card page-section">
      <h2>Current note</h2>
      <p>${esc(args.note)}</p>
    </section>

    <section class="card page-section">
      <h2>Strongest window in current history</h2>
      <div class="kv-row"><strong>Window</strong><span>${fmtText(args.strongestWindow)}</span></div>
      <div class="kv-row"><strong>Strongest streamer</strong><span>${fmtText(args.strongestStreamer)}</span></div>
    </section>

    ${renderPoints(args.points)}
  `
}

export async function renderKickDayFlowPage(root: HTMLElement): Promise<void> {
  root.className = "site-shell kick-site"
  root.innerHTML = renderKickShell("day-flow", renderBody({
    state: "loading",
    coverage: "Loading...",
    note: "Loading Kick Day Flow live snapshot state...",
    observedBuckets: 0,
    totalViewersObserved: 0,
    strongestWindow: null,
    strongestStreamer: null,
    points: []
  }))

  try {
    const payload = await getKickDayFlowScaffoldPayload()
    const points = normalizePoints(payload)

    root.innerHTML = renderKickShell("day-flow", renderBody({
      state: payload.state,
      coverage: payload.coverage,
      note: payload.note,
      observedBuckets: payload.summary.observedBuckets,
      totalViewersObserved: payload.summary.totalViewersObserved,
      strongestWindow: payload.summary.strongestWindow,
      strongestStreamer: payload.summary.strongestStreamer,
      points
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    root.innerHTML = renderKickShell("day-flow", renderBody({
      state: "error",
      coverage: "Kick Day Flow request failed.",
      note: message,
      observedBuckets: 0,
      totalViewersObserved: 0,
      strongestWindow: null,
      strongestStreamer: null,
      points: []
    }))
  }
}
