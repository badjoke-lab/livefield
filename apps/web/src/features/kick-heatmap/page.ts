import { renderKickShell } from "../kick-shell/render"
import { getKickHeatmapScaffoldPayload } from "../../shared/api/kick-heatmap-api"

function renderBody(args: {
  state: string
  coverage: string
  note: string
  activeStreams: number
  totalViewersObserved: number
}): string {
  return `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-label">NOW</div>
        <h1>Kick Heatmap</h1>
        <p>
          This is the first data-aware scaffold for the future Kick now-view.
          Real Kick payloads and the tile renderer are not wired yet.
        </p>
      </div>
    </section>

    <section class="summary-strip page-section">
      <div class="summary-item"><strong>State</strong><span>${args.state}</span></div>
      <div class="summary-item"><strong>Coverage</strong><span>${args.coverage}</span></div>
      <div class="summary-item"><strong>Observed</strong><span>${args.activeStreams}</span></div>
      <div class="summary-item"><strong>Viewers</strong><span>${args.totalViewersObserved}</span></div>
    </section>

    <section class="card page-section">
      <h2>Current note</h2>
      <p>${args.note}</p>
    </section>

    <section class="card page-section">
      <h2>What will live here</h2>
      <ul class="feature-list">
        <li><strong>Who is big now</strong> on Kick</li>
        <li><strong>Who is rising now</strong> in the current window</li>
        <li><strong>Who feels active now</strong> once the Kick path exists</li>
      </ul>
    </section>
  `
}

export async function renderKickHeatmapPage(root: HTMLElement): Promise<void> {
  root.className = "site-shell kick-site"
  root.innerHTML = renderKickShell("heatmap", renderBody({
    state: "loading",
    coverage: "Loading...",
    note: "Loading Kick Heatmap scaffold state...",
    activeStreams: 0,
    totalViewersObserved: 0
  }))

  try {
    const payload = await getKickHeatmapScaffoldPayload()
    root.innerHTML = renderKickShell("heatmap", renderBody({
      state: payload.state,
      coverage: payload.coverage,
      note: payload.note,
      activeStreams: payload.summary.activeStreams,
      totalViewersObserved: payload.summary.totalViewersObserved
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    root.innerHTML = renderKickShell("heatmap", renderBody({
      state: "error",
      coverage: "Kick Heatmap scaffold request failed.",
      note: message,
      activeStreams: 0,
      totalViewersObserved: 0
    }))
  }
}
