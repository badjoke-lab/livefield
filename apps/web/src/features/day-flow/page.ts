import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"

export function renderDayFlowPage(root: HTMLElement): void {
  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("day-flow")}
    ${renderHero({
      eyebrow: "TODAY",
      title: "Day Flow",
      subtitle: "Read the daily Twitch audience landscape as stacked territory over time.",
      note: "Volume = total viewers over time / Share = audience share by time bucket. This is still a static mock.",
      actions: [
        { href: "/battle-lines/", label: "Open Rivalry Radar" },
        { href: "/method/", label: "Open Method" }
      ]
    })}

    <div class="controls">
      <span class="pill">Today</span>
      <span class="pill">Top 20 + Others</span>
      <span class="pill">Volume</span>
      <span class="pill">5m buckets</span>
    </div>

    <section class="summary-strip page-section">
      <div class="summary-item">
        <strong>Peak leader</strong>
        <span>Stream A (mock)</span>
      </div>
      <div class="summary-item">
        <strong>Longest dominance</strong>
        <span>Evening window (mock)</span>
      </div>
      <div class="summary-item">
        <strong>Hottest window</strong>
        <span>Around 20:00 (mock)</span>
      </div>
      <div class="summary-item">
        <strong>Biggest rise</strong>
        <span>Stream C (mock)</span>
      </div>
    </section>

    <section class="grid-2 page-section">
      <section class="dayflow-mock-card">
        <div class="dayflow-mock-card__head">
          <div>
            <strong>Daily audience landscape</strong>
            <p>A mock view of who owned which hours of the Twitch live field throughout the day.</p>
          </div>
          <div class="dayflow-mock-modes">
            <span class="pill">Volume</span>
            <span class="pill">Share</span>
          </div>
        </div>

        <div class="dayflow-mock-stage">
          <div class="dayflow-grid dayflow-grid--h"></div>
          <div class="dayflow-grid dayflow-grid--v"></div>

          <div class="dayflow-ylabels">
            <span>High</span>
            <span>Mid</span>
            <span>Low</span>
          </div>

          <div class="dayflow-stream dayflow-stream--a"></div>
          <div class="dayflow-stream dayflow-stream--b"></div>
          <div class="dayflow-stream dayflow-stream--c"></div>
          <div class="dayflow-stream dayflow-stream--d"></div>
          <div class="dayflow-stream dayflow-stream--others"></div>

          <div class="dayflow-heatpoint" style="left:62%; top:31%;"></div>
          <div class="dayflow-heatpoint dayflow-heatpoint--sm" style="left:36%; top:42%;"></div>
          <div class="dayflow-heatpoint dayflow-heatpoint--sm" style="left:78%; top:24%;"></div>

          <div class="dayflow-nowline" style="left:74%;">
            <span>Now</span>
          </div>

          <div class="dayflow-xlabels">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </div>

        <div class="dayflow-legend-row">
          <span><i class="legend-dot legend-dot--size"></i> Band thickness = viewers</span>
          <span><i class="legend-dot legend-dot--glow"></i> Hotspot = activity signal</span>
          <span><i class="legend-dot legend-dot--shake"></i> Volume / Share toggle</span>
        </div>
      </section>

      <section class="dayflow-side">
        <section class="card">
          <h2>Time Focus</h2>
          <div class="kv">
            <div class="kv-row"><span>Selected time</span><strong>19:35</strong></div>
            <div class="kv-row"><span>Rank 1</span><strong>Stream A</strong></div>
            <div class="kv-row"><span>Rank 2</span><strong>Stream B</strong></div>
            <div class="kv-row"><span>Peak share</span><strong>Stream A</strong></div>
            <div class="kv-row"><span>Hottest stream</span><strong>Stream C</strong></div>
          </div>
        </section>

        <section class="card">
          <h2>What this page shows</h2>
          <ul class="feature-card__list">
            <li>Which hours were hottest across the full site</li>
            <li>Who owned each time window</li>
            <li>How daily leadership shifted over time</li>
          </ul>
        </section>
      </section>
    </section>

    ${renderStatusNote("Day Flow is the daily overview. Use Heatmap for the current field and Rivalry Radar for precision comparison.")}
    ${renderFooter()}
  `
}
