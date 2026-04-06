import { renderKickShell } from "../kick-shell/render"

export function renderKickHomePage(root: HTMLElement): void {
  root.className = "site-shell kick-site"
  root.innerHTML = renderKickShell("home", `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-label">KICK</div>
        <h1>Kick Livefield</h1>
        <p>
          This is the first shell for the future Kick-focused Livefield site.
          The current step is to establish site structure before Heatmap, Day Flow, and Rivalry Radar are wired.
        </p>
      </div>
    </section>

    <section class="summary-strip page-section">
      <div class="summary-item"><strong>State</strong><span>Shell only</span></div>
      <div class="summary-item"><strong>Next</strong><span>Kick Heatmap</span></div>
      <div class="summary-item"><strong>Status</strong><span>Not live yet</span></div>
      <div class="summary-item"><strong>Current site</strong><span>Twitch remains primary</span></div>
    </section>

    <section class="grid-2 page-section">
      <section class="card">
        <h2>Planned views</h2>
        <ul class="feature-list">
          <li><strong>Heatmap:</strong> Now view for Kick live activity</li>
          <li><strong>Day Flow:</strong> Today view for audience movement</li>
          <li><strong>Rivalry Radar:</strong> Compare view for reversals and pressure</li>
        </ul>
      </section>

      <section class="card">
        <h2>Why this shell exists first</h2>
        <p>
          Livefield is moving toward separate Twitch and Kick sites under one repository.
          The safe first step is a Kick shell before real provider data is wired.
        </p>
      </section>
    </section>

    <section class="card page-section">
      <h2>Current path</h2>
      <p>
        Twitch remains the active public site today. Kick is being added as a separate site layer, not as a mixed platform toggle inside one page.
      </p>
      <div class="actions">
        <a class="action" href="/">Open current Twitch site</a>
        <a class="action" href="/kick/about/">Read Kick about</a>
        <a class="action" href="/kick/status/">Open Kick status</a>
      </div>
    </section>
  `)
}
