import { renderKickShell } from "../kick-shell/render"

export function renderKickBattleLinesPage(root: HTMLElement): void {
  root.className = "site-shell kick-site"
  root.innerHTML = renderKickShell("battle-lines", `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-label">RIVALRIES</div>
        <h1>Kick Rivalry Radar</h1>
        <p>
          This page is reserved for the future Kick compare-view.
          The shell is ready, but recommendation logic and pair data are not wired yet.
        </p>
      </div>
    </section>

    <section class="summary-strip page-section">
      <div class="summary-item"><strong>Pairs</strong><span>Not wired</span></div>
      <div class="summary-item"><strong>Reversals</strong><span>Not wired</span></div>
      <div class="summary-item"><strong>Goal</strong><span>Kick compare view</span></div>
      <div class="summary-item"><strong>Mode</strong><span>Placeholder</span></div>
    </section>

    <section class="card page-section">
      <h2>What will live here</h2>
      <ul class="feature-list">
        <li><strong>Who is fighting for attention</strong></li>
        <li><strong>Where reversals happened</strong></li>
        <li><strong>Which rivalries deserve focus</strong></li>
      </ul>
    </section>
  `)
}
