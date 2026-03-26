import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"

const PAYPAL_DONATE_URL = 'https://www.paypal.com/donate/?hosted_button_id=REPLACE_ME'
const IS_PLACEHOLDER = PAYPAL_DONATE_URL.includes("REPLACE_ME")

export function renderDonatePage(root: HTMLElement): void {
  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("donate")}
    ${renderHero({
      eyebrow: "SUPPORT",
      title: "Support Livefield",
      subtitle:
        "Livefield stays public as an unofficial Twitch observation site. If you want to support uptime, collection, and future expansion, you can donate via PayPal.",
      note:
        IS_PLACEHOLDER
          ? "PayPal link is not connected yet. This page is a placeholder shell for now."
          : "Support is optional. The donation flow opens on PayPal and completes there.",
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
        <strong>Payment</strong>
        <span>${IS_PLACEHOLDER ? "Placeholder mode" : "PayPal donation link"}</span>
      </div>
      <div class="summary-item">
        <strong>Use</strong>
        <span>Collection, storage, uptime</span>
      </div>
      <div class="summary-item">
        <strong>Scope</strong>
        <span>Optional support only</span>
      </div>
    </section>

    <section class="card page-section">
      <h2>Donate with PayPal</h2>
      <p>
        Donations help cover collection runs, storage, uptime checks, and future expansion for new platform coverage.
        This page only routes you to PayPal. Payment is completed there, not on Livefield.
      </p>
      <div class="actions">
        <a class="action" href="${PAYPAL_DONATE_URL}" target="_blank" rel="noreferrer noopener">Donate with PayPal</a>
        <a class="action" href="/about/">Why Livefield exists</a>
      </div>
      <p class="code-note" style="margin-top:10px">
        ${
          IS_PLACEHOLDER
            ? "Placeholder link only. Replace REPLACE_ME later with the real PayPal hosted button ID."
            : "You will be sent to PayPal to complete the donation."
        }
      </p>
    </section>

    <section class="home-two-col page-section">
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
          Donations support the project itself, not the platform or the streamers shown on the site.
        </p>
      </section>
    </section>

    ${renderStatusNote(
      "Donate is separated into its own lightweight page so the core feature pages stay focused on reading the live field without overlay clutter."
    )}
    ${renderFooter()}
  `
}
