import { renderKickShell } from "../kick-shell/render"
import { getKickDayFlowScaffoldPayload } from "../../shared/api/kick-day-flow-api"

function renderBody(args: {
  state: string
  coverage: string
  note: string
  observedBuckets: number
  totalViewersObserved: number
}): string {
  return `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-label">TODAY</div>
        <h1>Kick Day Flow</h1>
        <p>
          This is the first data-aware scaffold for the future Kick today-view.
          Real Kick bucket payloads and ownership windows are not wired yet.
        </p>
      </div>
    </section>

    <section class="summary-strip page-section">
      <div class="summary-item"><strong>State</strong><span>${args.state}</span></div>
      <div class="summary-item"><strong>Coverage</strong><span>${args.coverage}</span></div>
      <div class="summary-item"><strong>Observed buckets</strong><span>${args.observedBuckets}</span></div>
      <div class="summary-item"><strong>Viewers</strong><span>${args.totalViewersObserved}</span></div>
    </section>

    <section class="card page-section">
      <h2>Current note</h2>
      <p>${args.note}</p>
    </section>

    <section class="card page-section">
      <h2>What will live here</h2>
      <ul class="feature-list">
        <li><strong>Who owned each part of the day</strong></li>
        <li><strong>How total volume changed</strong></li>
        <li><strong>Where the important windows happened</strong></li>
      </ul>
    </section>
  `
}

export async function renderKickDayFlowPage(root: HTMLElement): Promise<void> {
  root.className = "site-shell kick-site"
  root.innerHTML = renderKickShell("day-flow", renderBody({
    state: "loading",
    coverage: "Loading...",
    note: "Loading Kick Day Flow scaffold state...",
    observedBuckets: 0,
    totalViewersObserved: 0
  }))

  try {
    const payload = await getKickDayFlowScaffoldPayload()
    root.innerHTML = renderKickShell("day-flow", renderBody({
      state: payload.state,
      coverage: payload.coverage,
      note: payload.note,
      observedBuckets: payload.summary.observedBuckets,
      totalViewersObserved: payload.summary.totalViewersObserved
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    root.innerHTML = renderKickShell("day-flow", renderBody({
      state: "error",
      coverage: "Kick Day Flow scaffold request failed.",
      note: message,
      observedBuckets: 0,
      totalViewersObserved: 0
    }))
  }
}
