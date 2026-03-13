import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"

export function renderMethodPage(root: HTMLElement): void {
  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("method")}
    ${renderHero({
      eyebrow: "METHOD",
      title: "Method",
      subtitle: "A short guide to the core metrics, how to read each page, and why low-load behavior comes first."
    })}
    <section class="card page-section">
      <h2>Initial notes</h2>
      <ul>
        <li>Viewers are the main signal.</li>
        <li>Activity is treated as a secondary signal.</li>
        <li>Stability and readability come before visual effects.</li>
      </ul>
    </section>
    ${renderFooter()}
  `
}
