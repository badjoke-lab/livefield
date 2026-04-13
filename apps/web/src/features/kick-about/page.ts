import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"
import { kickSiteConfig } from "../../shared/app-shell/site-config"

export function renderKickAboutPage(root: HTMLElement): void {
  root.className = "site-shell kick-about-page"
  root.innerHTML = `
    ${renderHeader("about", kickSiteConfig)}

    ${renderHero({
      eyebrow: "ABOUT",
      title: "About Livefield - Kick",
      subtitle: "Kick-focused observation under the same Livefield reading model.",
      note: "The split is platform-specific collection, not a mixed toggle inside one page.",
      actions: [
        { href: "/kick/heatmap/", label: "Open Heatmap" },
        { href: "/kick/battle-lines/", label: "Open Rivalry Radar" }
      ]
    })}

    <section class="grid-2 page-section">
      <section class="card">
        <h2>What stays shared</h2>
        <ul class="feature-list">
          <li>Now / Today / Rivalries role split</li>
          <li>shared shell, cards, hero, and footer pattern</li>
          <li>honest stale / partial / empty status language</li>
        </ul>
      </section>

      <section class="card">
        <h2>What is Kick-specific</h2>
        <ul class="feature-list">
          <li>collector path and source limits</li>
          <li>payload normalization for Kick data</li>
          <li>coverage notes and Kick stream routing</li>
        </ul>
      </section>
    </section>

    ${renderStatusNote({
      eyebrow: "SITE SHAPE",
      title: "Why Kick is separate",
      body: "Kick is not being added as a platform toggle inside the Twitch pages. It is a separate site layer under the Livefield name so the reading model stays consistent while the data paths stay honest.",
      items: [
        "separate route tree under /kick/",
        "same product grammar across platforms",
        "shared portal landing can come later without rewriting the data pages"
      ],
      tone: "info"
    })}

    ${renderFooter(kickSiteConfig)}
  `
}
