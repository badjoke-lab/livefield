import { renderKickShell } from "../kick-shell/render"
import {
  getKickBattleLinesScaffoldPayload,
  type KickBattleLinesScaffoldPayload
} from "../../shared/api/kick-battle-lines-api"

type KickBattlePair = {
  leftSlug: string
  rightSlug: string
  leftViewers: number
  rightViewers: number
  viewerGap: number
  previousGap: number
  swing: number
  label: string
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

function normalizePairs(payload: KickBattleLinesScaffoldPayload): KickBattlePair[] {
  return (payload.pairs as KickBattlePair[]).filter((pair) =>
    pair &&
    typeof pair.leftSlug === "string" &&
    typeof pair.rightSlug === "string"
  )
}

function renderPairs(pairs: KickBattlePair[]): string {
  if (!pairs.length) {
    return `
      <section class="card page-section">
        <h2>Observed pairs</h2>
        <p>No rivalry pairs are available in the current snapshot window.</p>
      </section>
    `
  }

  return `
    <section class="card page-section">
      <h2>Observed pairs</h2>
      <div class="battle-detail-sections">
        ${pairs.slice(0, 9).map((pair, index) => `
          <article class="battle-detail-card">
            <h3>#${index + 1} ${esc(pair.leftSlug)} vs ${esc(pair.rightSlug)}</h3>
            <div class="kv-row"><strong>Label</strong><span>${esc(pair.label)}</span></div>
            <div class="kv-row"><strong>Current gap</strong><span>${fmtNum(pair.viewerGap)}</span></div>
            <div class="kv-row"><strong>Previous gap</strong><span>${fmtNum(pair.previousGap)}</span></div>
            <div class="kv-row"><strong>Swing</strong><span>${fmtNum(pair.swing)}</span></div>
            <div class="kv-row"><strong>Left viewers</strong><span>${fmtNum(pair.leftViewers)}</span></div>
            <div class="kv-row"><strong>Right viewers</strong><span>${fmtNum(pair.rightViewers)}</span></div>
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
  observedPairs: number
  strongestPair: string | null
  strongestReversalWindow: string | null
  strongestPressureSide: string | null
  pairs: KickBattlePair[]
}): string {
  return `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-label">RIVALRIES</div>
        <h1>Kick Rivalry Radar</h1>
        <p>
          Snapshot-based Kick rivalry view using recent viewer pressure between adjacent top streams.
          Webhook activity is not wired yet.
        </p>
      </div>
    </section>

    <section class="summary-strip page-section">
      <div class="summary-item"><strong>State</strong><span>${esc(args.state)}</span></div>
      <div class="summary-item"><strong>Coverage</strong><span>${esc(args.coverage)}</span></div>
      <div class="summary-item"><strong>Observed pairs</strong><span>${fmtNum(args.observedPairs)}</span></div>
      <div class="summary-item"><strong>Mode</strong><span>Live snapshot pressure</span></div>
    </section>

    <section class="card page-section">
      <h2>Current note</h2>
      <p>${esc(args.note)}</p>
    </section>

    <section class="card page-section">
      <h2>Strongest battle in current window</h2>
      <div class="kv-row"><strong>Pair</strong><span>${fmtText(args.strongestPair)}</span></div>
      <div class="kv-row"><strong>Reversal window</strong><span>${fmtText(args.strongestReversalWindow)}</span></div>
      <div class="kv-row"><strong>Pressure side</strong><span>${fmtText(args.strongestPressureSide)}</span></div>
    </section>

    ${renderPairs(args.pairs)}
  `
}

export async function renderKickBattleLinesPage(root: HTMLElement): Promise<void> {
  root.className = "site-shell kick-site"
  root.innerHTML = renderKickShell("battle-lines", renderBody({
    state: "loading",
    coverage: "Loading...",
    note: "Loading Kick Rivalry Radar live snapshot state...",
    observedPairs: 0,
    strongestPair: null,
    strongestReversalWindow: null,
    strongestPressureSide: null,
    pairs: []
  }))

  try {
    const payload = await getKickBattleLinesScaffoldPayload()
    const pairs = normalizePairs(payload)

    root.innerHTML = renderKickShell("battle-lines", renderBody({
      state: payload.state,
      coverage: payload.coverage,
      note: payload.note,
      observedPairs: payload.summary.observedPairs,
      strongestPair: payload.summary.strongestPair,
      strongestReversalWindow: payload.summary.strongestReversalWindow,
      strongestPressureSide: payload.summary.strongestPressureSide,
      pairs
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    root.innerHTML = renderKickShell("battle-lines", renderBody({
      state: "error",
      coverage: "Kick Rivalry Radar request failed.",
      note: message,
      observedPairs: 0,
      strongestPair: null,
      strongestReversalWindow: null,
      strongestPressureSide: null,
      pairs: []
    }))
  }
}
