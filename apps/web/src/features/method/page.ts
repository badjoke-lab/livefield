import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"


  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("method")}
    ${renderHero({
      eyebrow: "METHOD",

      subtitle: "How each page reads data today, what changes on historical dates, and how to interpret sparse windows."
    })}
    <section class="card page-section">
      <h2>Core reading model</h2>
      <ul>
        <li><strong>Viewers are primary.</strong> Position, area, rank, and ownership signals are viewer-first.</li>
        <li><strong>Activity is secondary.</strong> If sampled chat activity is missing, charts still render with viewer signals.</li>
        <li><strong>Status can be live, partial, stale, empty, demo, or error.</strong> Partial is not a failure; it means observed coverage is incomplete.</li>
      </ul>
    </section>
    <section class="card page-section">
      <h2>By timeframe</h2>
      <ul>
        <li><strong>Today:</strong> uses the hot/raw live path and updates on short intervals.</li>
        <li><strong>Yesterday and Date:</strong> use rollup/history-backed reads for stable historical playback.</li>
        <li><strong>Sparse today:</strong> may default to an observed-window view when only a portion of today has been seen.</li>
      </ul>
    </section>
    <section class="card page-section">
      <h2>By feature</h2>
      <ul>
        <li><strong>Heatmap:</strong> historical views read from saved snapshot frames.</li>
        <li><strong>Day Flow:</strong> historical views read rollup band series.</li>
        <li><strong>Battle Lines:</strong> historical views use rollup line series plus reversal events.</li>
      </ul>
    </section>
    <section class="card page-section">
      <h2>How to read “degraded” periods</h2>
      <p>“Degraded” means the site is intentionally transparent about reduced coverage or freshness. It does <em>not</em> automatically mean the data is unusable. Check each page note for whether the limitation is partial coverage, stale refresh, or empty window.</p>
    </section>
    ${renderFooter()}
  `
}
