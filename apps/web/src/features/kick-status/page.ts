import { renderKickShell } from "../kick-shell/render"

export function renderKickStatusPage(root: HTMLElement): void {
  root.className = "site-shell kick-site"
  root.innerHTML = renderKickShell("status", `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-label">STATUS</div>
        <h1>Kick Livefield Status</h1>
        <p>
          This is the initial status shell for the future Kick site.
          Real collector-backed Kick status is not wired yet.
        </p>
      </div>
    </section>

    <section class="summary-strip page-section">
      <div class="summary-item"><strong>Collector</strong><span>Not wired</span></div>
      <div class="summary-item"><strong>API</strong><span>Not wired</span></div>
      <div class="summary-item"><strong>Coverage</strong><span>Not available yet</span></div>
      <div class="summary-item"><strong>Mode</strong><span>Shell only</span></div>
    </section>

    <section class="card page-section">
      <h2>What this means</h2>
      <p>
        Twitch currently has the real data backbone. Kick status will become meaningful only after the separate Kick collector and site payloads are connected.
      </p>
    </section>

    <section class="card page-section">
      <h2>Current reference</h2>
      <p>
        Today, the real end-to-end backbone exists on the Twitch side. Kick status is intentionally honest as a shell and does not pretend to be live yet.
      </p>
      <div class="actions">
        <a class="action" href="/status/">Open current Twitch status</a>
      </div>
    </section>
  `)
}
