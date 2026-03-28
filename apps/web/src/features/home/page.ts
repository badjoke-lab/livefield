import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"

export function renderHomePage(root: HTMLElement): void {
  root.className = "site-shell home-page"
  root.innerHTML = `
    ${renderHeader("home")}
    ${renderHero({
      eyebrow: "LIVE OBSERVATION",
      title: "Livefield",
      subtitle:
        "An unofficial Twitch observation site for reading the live field in three ways: now, today, and rivalries.",
      note:
        "v1 is a Twitch-only MVP. Stability comes first, then product upgrades.",
      actions: [
        { href: "/heatmap/", label: "Open Heatmap" },
        { href: "/day-flow/", label: "Open Day Flow" },
        { href: "/battle-lines/", label: "Open Rivalry Radar" },
        { href: "/donate/", label: "Support Livefield" }
      ]
    })}

    <section class="summary-strip page-section">
      <div class="summary-item">
        <strong>Scope</strong>
        <span>Twitch-only MVP</span>
      </div>
      <div class="summary-item">
        <strong>Structure</strong>
        <span>Heatmap / Day Flow / Rivalry Radar</span>
      </div>
      <div class="summary-item">
        <strong>Priority</strong>
        <span>Stability first</span>
      </div>
      <div class="summary-item">
        <strong>Stack</strong>
        <span>Cloudflare + static shell</span>
      </div>
    </section>

    <section class="home-grid page-section">
      <article class="feature-card">
        <div class="feature-card__eyebrow">NOW</div>
        <h2>Heatmap</h2>
        <p class="feature-card__lead">
          Read which streams are biggest, most active, and rising right now as a live bubble field.
        </p>
        <ul class="feature-card__list">
          <li>Viewers = node size</li>
          <li>Activity signal = outer ring</li>
          <li>Recent momentum = glow</li>
        </ul>
        <a class="feature-card__link" href="/heatmap/">Open Heatmap →</a>
      </article>

      <article class="feature-card">
        <div class="feature-card__eyebrow">TODAY</div>
        <h2>Day Flow</h2>
        <p class="feature-card__lead">
          Read the daily audience landscape as stacked territory. See who owned which hours.
        </p>
        <ul class="feature-card__list">
          <li>Volume = total audience over time</li>
          <li>Share = territory by time bucket</li>
          <li>Others keeps the whole field intact</li>
        </ul>
        <a class="feature-card__link" href="/day-flow/">Open Day Flow →</a>
      </article>

      <article class="feature-card">
        <div class="feature-card__eyebrow">RIVALRIES</div>
        <h2>Rivalry Radar</h2>
        <p class="feature-card__lead">
          Find the battles that matter now and compare major audience lines over time.
        </p>
        <ul class="feature-card__list">
          <li>Recommended battles first</li>
          <li>Viewers / Indexed switch</li>
          <li>Rise and reversal markers</li>
        </ul>
        <a class="feature-card__link" href="/battle-lines/">Open Rivalry Radar →</a>
      </article>
    </section>

    <section class="home-two-col page-section">
      <section class="card">
        <h2>Priority order on this site</h2>
        <ol class="priority-list">
          <li>No browser crashes</li>
          <li>You should understand the page at a glance</li>
          <li>Only then do we add lightweight effects</li>
        </ol>
        <p class="code-note">
          Stability &gt; Readability &gt; Update smoothness &gt; Effects
        </p>
      </section>

      <section class="card">
        <h2>Current status</h2>
        <div class="home-status-list">
          <div class="home-status-row">
            <span>Static multipage shell</span>
            <strong>Ready</strong>
          </div>
          <div class="home-status-row">
            <span>Pages Functions stub</span>
            <strong>Ready</strong>
          </div>
          <div class="home-status-row">
            <span>Collector Worker scaffold</span>
            <strong>Ready</strong>
          </div>
          <div class="home-status-row">
            <span>Real renderer</span>
            <strong>Next</strong>
          </div>
        </div>
      </section>
    </section>

    <section class="card page-section">
      <h2>Support Livefield</h2>
      <p>
        Livefield is kept public as an unofficial observation site. If you want to support collection, storage, uptime,
        and future expansion, use the dedicated donate page.
      </p>
      <div class="actions">
        <a class="action" href="/donate/">Open Donate Page</a>
      </div>
    </section>

    <section class="card page-section">
      <h2>Next steps</h2>
      <div class="roadmap-list">
        <div class="roadmap-item">
          <strong>1. Heatmap build</strong>
          <span>Create the first real visualization with Canvas 2D and low-load rules.</span>
        </div>
        <div class="roadmap-item">
          <strong>2. Day Flow build</strong>
          <span>Build the territory view with dual Volume / Share modes.</span>
        </div>
        <div class="roadmap-item">
          <strong>3. Rivalry Radar build</strong>
          <span>Add the comparison view focused on battles, rises, and reversals.</span>
        </div>
      </div>
    </section>

    ${renderStatusNote(
      "This home page is a lightweight static shell. Heavy rendering stays off this page while we lock the roles, routes, and priorities first."
    )}
    ${renderFooter()}
  `
}
