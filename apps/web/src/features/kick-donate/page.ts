import { renderKickShell } from "../kick-shell/render"

const STRIPE_URL = "https://buy.stripe.com/dRm8wIcJ99jGfbJ5kLcIE01"

export function renderKickDonatePage(root: HTMLElement): void {
  root.className = "site-shell kick-site"
  root.innerHTML = renderKickShell("donate", `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-label">SUPPORT</div>
        <h1>Support Kick Livefield</h1>
        <p>
          Kick Livefield is still in the shell phase, but support for the broader Livefield project already helps future collection, hosting, storage, and development.
        </p>
      </div>
    </section>

    <section class="card page-section">
      <h2>Support link</h2>
      <p>
        Donations currently go through the shared Livefield support flow.
      </p>
      <div class="actions">
        <a class="action" href="${STRIPE_URL}" target="_blank" rel="noreferrer">Open support page</a>
      </div>
    </section>

    <section class="card page-section">
      <h2>Current note</h2>
      <p>
        This page is Kick-specific as an entry point, but the payment destination is currently shared with the broader Livefield project.
      </p>
    </section>
  `)
}
