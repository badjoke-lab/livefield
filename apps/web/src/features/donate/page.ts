import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"

const DONATE_URL = "https://buy.stripe.com/dRm8wIcJ99jGfbJ5kLcIE01"

export function renderDonatePage(root: HTMLElement): void {
  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("donate")}
    ${renderHero({
      eyebrow: "SUPPORT",
      title: "Support Livefield",
      subtitle:
        "Livefield stays public as an unofficial Twitch observation site. If you want to support uptime, collection, and future expansion, you can continue via Stripe here.",
      note:
        "Support is optional. Stripe handles checkout on a separate page.",
      actions: [
        { href: "/", label: "Back to Home" },
        { href: "/status/", label: "Open Status" }
      ]
    })}

    <section class="summary-strip page-section">
      <div class="summary-item">
        <strong>Purpose</strong>
        <span>Keep Livefield public</span>
      </div>
      <div class="summary-item">
        <strong>Route</strong>
        <span>Stripe checkout</span>
      </div>
      <div class="summary-item">
        <strong>Use</strong>
        <span>Collection, operations, uptime</span>
      </div>
      <div class="summary-item">
        <strong>Scope</strong>
        <span>Optional support only</span>
      </div>
    </section>

    <section class="card page-section">
      <h2>Support via Stripe</h2>
      <p>
        Support helps cover collection runs, lightweight storage, uptime checks, and careful future expansion.
        Payments are handled through Stripe checkout.
      </p>
      <div class="actions">
        <a class="action action--primary" href="${DONATE_URL}" target="_blank" rel="noreferrer noopener">Continue to Stripe</a>
        <a class="action" href="#support-helps">How support helps</a>
      </div>
      <p class="code-note" style="margin-top:10px">
        You will be sent to Stripe checkout to complete your support.
      </p>
    </section>

    <section class="home-two-col page-section" id="support-helps">
      <section class="card">
        <h2>What support helps with</h2>
        <div class="home-status-list">
          <div class="home-status-row">
            <span>Collection & uptime</span>
            <strong>Ongoing</strong>
          </div>
          <div class="home-status-row">
            <span>Storage & operations</span>
            <strong>Ongoing</strong>
          </div>
          <div class="home-status-row">
            <span>Future expansion</span>
            <strong>Gradual</strong>
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Important note</h2>
        <p>
          Livefield is an unofficial observation site and is not affiliated with Twitch.
          Support helps the project itself, not the platform or the streamers shown on the site.
        </p>
      </section>
    </section>

    ${renderStatusNote(
      "Donate stays on its own lightweight page so the core feature pages remain focused on reading the live field without overlay clutter."
    )}
    ${renderFooter()}
  `
}
