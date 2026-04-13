import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"
import { kickSiteConfig } from "../../shared/app-shell/site-config"

const STRIPE_URL = "https://buy.stripe.com/dRm8wIcJ99jGfbJ5kLcIE01"

export function renderKickDonatePage(root: HTMLElement): void {
  root.className = "site-shell kick-donate-page"
  root.innerHTML = `
    ${renderHeader("donate", kickSiteConfig)}

    ${renderHero({
      eyebrow: "SUPPORT",
      title: "Support Livefield - Kick",
      subtitle: "Kick pages are separate, but support still goes through the shared Livefield donation flow.",
      note: "This keeps MVP payment handling simple while the product splits by platform.",
      actions: [
        { href: STRIPE_URL, label: "Open support page", external: true },
        { href: "/kick/status/", label: "Open Kick status" }
      ]
    })}

    <section class="grid-2 page-section">
      <section class="card">
        <h2>What support covers</h2>
        <ul class="feature-list">
          <li>hosting and Cloudflare runtime</li>
          <li>storage and collection growth</li>
          <li>continued Twitch + Kick feature work</li>
        </ul>
      </section>

      <section class="card">
        <h2>Current payment route</h2>
        <p>
          Donations currently land in the shared Livefield support flow rather than a Kick-only destination.
        </p>
        <div class="actions">
          <a class="action" href="${STRIPE_URL}" target="_blank" rel="noreferrer">Open support page</a>
        </div>
      </section>
    </section>

    ${renderStatusNote({
      eyebrow: "PAYMENT NOTE",
      title: "Shared support path for MVP",
      body: "Kick has its own public pages, but donation handling is still shared with the broader Livefield project for now.",
      items: [
        "Kick-specific entry point",
        "shared payment destination",
        "platform-specific support split can be added later if needed"
      ],
      tone: "info"
    })}

    ${renderFooter(kickSiteConfig)}
  `
}
