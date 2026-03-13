import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"

export function renderStatusPage(root: HTMLElement): void {
  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("status")}
    ${renderHero({
      eyebrow: "STATUS",
      title: "System Status",
      subtitle: "Use this page to confirm collector, cache, and API health for the Twitch MVP."
    })}
    <section class="card page-section">
      <div class="kv">
        <div class="kv-row"><span>Collector</span><span>placeholder</span></div>
        <div class="kv-row"><span>Latest snapshot</span><span>placeholder</span></div>
        <div class="kv-row"><span>API /heatmap</span><span>placeholder</span></div>
        <div class="kv-row"><span>API /day-flow</span><span>placeholder</span></div>
        <div class="kv-row"><span>API /battle-lines</span><span>placeholder</span></div>
      </div>
    </section>
    ${renderFooter()}
  `
}
