import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"
import { kickSiteConfig } from "../../shared/app-shell/site-config"

export function renderKickHomePage(root: HTMLElement): void {
  root.className = "site-shell kick-home-page"
  root.innerHTML = `
    ${renderHeader("home", kickSiteConfig)}

    ${renderHero({
      eyebrow: "KICK",
      title: "Livefield - Kick",
      subtitle: "Kick observation layer under the broader Livefield structure.",
      note: "This MVP keeps the same Now / Today / Rivalries reading model while the cross-site portal lands later.",
      actions: [
        { href: "/kick/heatmap/", label: "Open Heatmap" },
        { href: "/kick/day-flow/", label: "Open Day Flow" }
      ]
    })}

    <section class="summary-strip page-section">
      <div class="summary-item"><strong>State</strong><span>Live shell</span></div>
      <div class="summary-item"><strong>Now</strong><span>Kick Heatmap</span></div>
      <div class="summary-item"><strong>Today</strong><span>Kick Day Flow</span></div>
      <div class="summary-item"><strong>Compare</strong><span>Kick Rivalry Radar</span></div>
    </section>

    <section class="grid-2 page-section">
      <section class="card">
        <h2>Available views</h2>
        <ul class="feature-list">
          <li><strong>Heatmap:</strong> read Kick momentum right now</li>
          <li><strong>Day Flow:</strong> inspect today’s ownership landscape</li>
          <li><strong>Rivalry Radar:</strong> compare adjacent leaders and reversals</li>
        </ul>
      </section>

      <section class="card">
        <h2>Current path</h2>
        <p>
          Kick is now a separate public layer inside the same repository. The shared portal top will come later, but the reading model is already aligned with the Twitch side.
        </p>
        <div class="actions">
          <a class="action" href="/kick/about/">Read Kick about</a>
          <a class="action" href="/kick/status/">Open Kick status</a>
          <a class="action" href="/">Open current Twitch site</a>
        </div>
      </section>
    </section>

    ${renderStatusNote({
      eyebrow: "LIVE COVERAGE",
      title: "Current public route",
      body: "Kick is now exposed as its own site layer, while Twitch remains the other active public route until the shared portal homepage is added.",
      items: [
        "same Now / Today / Rivalries split as the Twitch side",
        "shared shell and reading model, Kick-specific data path",
        "footer now links directly to the other platform"
      ],
      tone: "info"
    })}

    ${renderFooter(kickSiteConfig)}
  `
}
