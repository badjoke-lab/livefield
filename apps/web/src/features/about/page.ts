import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"

export function renderAboutPage(root: HTMLElement): void {
  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("about")}
    ${renderHero({
      eyebrow: "ABOUT",
      title: "About Livefield",
      subtitle: "Livefield is an unofficial Twitch-focused observation project built around three views: now, today, and rivalries."
    })}
    <section class="card page-section">
      <h2>Current scope</h2>
      <p>This v1 repository is a Twitch-only MVP focused on stable observation first.</p>
    </section>
    ${renderFooter()}
  `
}
