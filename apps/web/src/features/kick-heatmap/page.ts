import { renderKickShell } from "../kick-shell/render"

export function renderKickHeatmapPage(root: HTMLElement): void {
  root.className = "site-shell kick-site"
  root.innerHTML = renderKickShell("heatmap", `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-label">NOW</div>
        <h1>Kick Heatmap</h1>
        <p>
          This page is reserved for the future Kick now-view.
          The shell is ready, but real Kick payloads and the tile renderer are not wired yet.
        </p>
      </div>
    </section>

    <section class="summary-strip page-section">
      <div class="summary-item"><strong>Renderer</strong><span>Not wired</span></div>
      <div class="summary-item"><strong>Payload</strong><span>Not wired</span></div>
      <div class="summary-item"><strong>Goal</strong><span>Kick now view</span></div>
      <div class="summary-item"><strong>Mode</strong><span>Placeholder</span></div>
    </section>

    <section class="card page-section">
      <h2>What will live here</h2>
      <ul class="feature-list">
        <li><strong>Who is big now</strong> on Kick</li>
        <li><strong>Who is rising now</strong> in the current window</li>
        <li><strong>Who feels active now</strong> once the Kick-specific path exists</li>
      </ul>
    </section>
  `)
}
