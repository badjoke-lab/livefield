import { renderKickShell } from "../kick-shell/render"
import { getKickBattleLinesScaffoldPayload } from "../../shared/api/kick-battle-lines-api"

function renderBody(args: {
  state: string
  coverage: string
  note: string
  observedPairs: number
}): string {
  return `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-label">RIVALRIES</div>
        <h1>Kick Rivalry Radar</h1>
        <p>
          This is the first data-aware scaffold for the future Kick compare-view.
          Real Kick pair payloads, reversal windows, and pressure metrics are not wired yet.
        </p>
      </div>
    </section>

    <section class="summary-strip page-section">
      <div class="summary-item"><strong>State</strong><span>${args.state}</span></div>
      <div class="summary-item"><strong>Coverage</strong><span>${args.coverage}</span></div>
      <div class="summary-item"><strong>Observed pairs</strong><span>${args.observedPairs}</span></div>
      <div class="summary-item"><strong>Mode</strong><span>Worker scaffold</span></div>
    </section>

    <section class="card page-section">
      <h2>Current note</h2>
      <p>${args.note}</p>
    </section>

    <section class="card page-section">
      <h2>What will live here</h2>
      <ul class="feature-list">
        <li><strong>Who is fighting for attention</strong></li>
        <li><strong>Where reversals happened</strong></li>
        <li><strong>Which rivalries deserve focus</strong></li>
      </ul>
    </section>
  `
}

export async function renderKickBattleLinesPage(root: HTMLElement): Promise<void> {
  root.className = "site-shell kick-site"
  root.innerHTML = renderKickShell("battle-lines", renderBody({
    state: "loading",
    coverage: "Loading...",
    note: "Loading Kick Rivalry Radar scaffold state...",
    observedPairs: 0
  }))

  try {
    const payload = await getKickBattleLinesScaffoldPayload()
    root.innerHTML = renderKickShell("battle-lines", renderBody({
      state: payload.state,
      coverage: payload.coverage,
      note: payload.note,
      observedPairs: payload.summary.observedPairs
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    root.innerHTML = renderKickShell("battle-lines", renderBody({
      state: "error",
      coverage: "Kick Rivalry Radar scaffold request failed.",
      note: message,
      observedPairs: 0
    }))
  }
}
