import { renderKickShell } from "../kick-shell/render"

export function renderKickAboutPage(root: HTMLElement): void {
  root.className = "site-shell kick-site"
  root.innerHTML = renderKickShell("about", `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-label">ABOUT</div>
        <h1>About Kick Livefield</h1>
        <p>
          Kick Livefield is planned as a separate observation site under the broader Livefield structure.
          It will keep the same Now / Today / Rivalries split while using Kick-specific collection and limits.
        </p>
      </div>
    </section>

    <section class="grid-2 page-section">
      <section class="card">
        <h2>What stays shared</h2>
        <ul class="feature-list">
          <li>Site shell and reading model</li>
          <li>Now / Today / Rivalries role split</li>
          <li>Status honesty around stale / partial / empty</li>
        </ul>
      </section>

      <section class="card">
        <h2>What becomes Kick-specific</h2>
        <ul class="feature-list">
          <li>Collector and source limits</li>
          <li>Payload normalization</li>
          <li>Coverage notes and stream URLs</li>
        </ul>
      </section>
    </section>

    <section class="card page-section">
      <h2>Current stage</h2>
      <p>
        This page is a structural placeholder. Real Kick data pages are not wired yet.
      </p>
    </section>
  `)
}
