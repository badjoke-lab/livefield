import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"

const PAYPAL_DONATE_URL = "https://www.paypal.com/donate/?hosted_button_id=REPLACE_ME"
const IS_PLACEHOLDER = PAYPAL_DONATE_URL.includes("REPLACE_ME")

export function renderDonatePage(root: HTMLElement): void {
  const donateAction = IS_PLACEHOLDER
    ? `<span class="action action--disabled" aria-disabled="true">PayPal support coming soon</span>`
    : `<a class="action action--primary" href="${PAYPAL_DONATE_URL}" target="_blank" rel="noreferrer noopener">Donate with PayPal</a>`

  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("donate")}
    ${renderHero({
      eyebrow: "SUPPORT",
      title: "Support Livefield",
      subtitle:
        "Livefield stays public as an unofficial Twitch observation site. If you want to support uptime, collection, and future expansion, PayPal support will be connected here.",
      note:
        IS_PLACEHOLDER
          ? "PayPal support is being connected. This page is ready, and the live link will be added once the hosted button is prepared."
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
        <span>${IS_PLACEHOLDER ? "Coming soon" : "PayPal donation link"}</span>
      </div>
      <div class="summary-item">
        <strong>Use</strong>
        <span>Collection, ops, uptime</span>
      </div>
      <div class="summary-item">
        <strong>Scope</strong>
        <span>Optional support only</span>
      </div>
    </section>

    <section class="card page-section">
      <h2>Support via PayPal</h2>
      <p>
        Support helps cover collection runs, lightweight storage, uptime checks, and careful future expansion for new platform coverage.
        Payment is handled on PayPal, not on Livefield.
      </p>
      <div class="actions">
        ${donateAction}
        <a class="action" href="#support-helps">How support helps</a>
      </div>
      <p class="code-note" style="margin-top:10px">
        ${
          IS_PLACEHOLDER
            ? "The live PayPal button will be connected after the hosted button is ready."
            : "You will be sent to PayPal to complete the donation."
        }
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
