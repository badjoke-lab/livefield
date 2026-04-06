import { renderKickShell } from "../kick-shell/render"

export function renderKickDayFlowPage(root: HTMLElement): void {
  root.className = "site-shell kick-site"
  root.innerHTML = renderKickShell("day-flow", `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-label">TODAY</div>
        <h1>Kick Day Flow</h1>
        <p>
          This page is reserved for the future Kick today-view.
          The shell is ready, but daily bucket payloads are not wired yet.
        </p>
      </div>
    </section>

    <section class="summary-strip page-section">
      <div class="summary-item"><strong>Rollups</strong><span>Not wired</span></div>
      <div class="summary-item"><strong>Past day</strong><span>Not wired</span></div>
      <div class="summary-item"><strong>Goal</strong><span>Kick daily flow</span></div>
      <div class="summary-item"><strong>Mode</strong><span>Placeholder</span></div>
    </section>

    <section class="card page-section">
      <h2>What will live here</h2>
      <ul class="feature-list">
        <li><strong>Who owned each part of the day</strong></li>
        <li><strong>How total volume changed</strong></li>
        <li><strong>Where the important windows happened</strong></li>
      </ul>
    </section>
  `)
}
