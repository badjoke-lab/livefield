import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"

export function renderBattleLinesPage(root: HTMLElement): void {
  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("battle-lines")}
    ${renderHero({
      eyebrow: "RIVALRIES",
      title: "Rivalry Radar",
      subtitle: "Find the battles that matter now and compare major audience lines over time.",
      note: "Viewers = absolute comparison / Indexed = each stream normalized to its own daily peak. This page is still a static mock.",
      actions: [
        { href: "/day-flow/", label: "Open Day Flow" },
        { href: "/method/", label: "Open Method" }
      ]
    })}

    <div class="controls">
      <span class="pill">Top 5</span>
      <span class="pill">Viewers</span>
      <span class="pill">5m granularity</span>
      <span class="pill">Recommended mode</span>
    </div>

    <section class="summary-strip page-section">
      <div class="summary-item">
        <strong>Primary battle</strong>
        <span>Stream A vs Stream B</span>
      </div>
      <div class="summary-item">
        <strong>Biggest rise</strong>
        <span>Stream C</span>
      </div>
      <div class="summary-item">
        <strong>Hottest moment</strong>
        <span>Around 20:10</span>
      </div>
      <div class="summary-item">
        <strong>Reversal count</strong>
        <span>3 expected</span>
      </div>
    </section>

    <section class="grid-2 page-section">
      <section class="battle-mock-card">
        <div class="battle-mock-card__head">
          <div>
            <strong>Recommended battle timeline</strong>
            <p>A mock view of major audience lines with reversals, rises, and hotspots.</p>
          </div>
          <div class="battle-mock-modes">
            <span class="pill">Viewers</span>
            <span class="pill">Indexed</span>
          </div>
        </div>

        <div class="battle-mock-stage">
          <div class="battle-grid battle-grid--h"></div>
          <div class="battle-grid battle-grid--v"></div>

          <div class="battle-ylabels">
            <span>High</span>
            <span>Mid</span>
            <span>Low</span>
          </div>

          <svg class="battle-lines-svg" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true">
            <path class="battle-line battle-line--a" d="M40,390 C120,360 180,310 250,280 C330,244 390,240 470,198 C560,152 620,120 700,138 C790,158 860,180 960,170" />
            <path class="battle-line battle-line--b" d="M40,260 C120,250 190,240 260,260 C340,284 410,312 500,300 C580,288 650,228 740,214 C830,200 900,210 960,238" />
            <path class="battle-line battle-line--c" d="M40,430 C120,420 190,418 270,404 C350,390 420,340 500,310 C580,280 650,330 730,356 C820,386 900,404 960,392" />
            <path class="battle-line battle-line--d" d="M40,470 C120,468 190,456 260,438 C340,418 410,404 500,394 C590,384 660,370 740,360 C830,346 900,332 960,324" />
            <path class="battle-line battle-line--e" d="M40,500 C120,496 190,492 270,488 C360,480 430,470 520,458 C610,444 700,430 790,422 C880,414 920,406 960,400" />

            <circle class="battle-point battle-point--peak" cx="700" cy="138" r="10" />
            <circle class="battle-point battle-point--peak" cx="840" cy="200" r="8" />
            <circle class="battle-point battle-point--heat" cx="520" cy="300" r="8" />
            <circle class="battle-point battle-point--heat" cx="740" cy="214" r="7" />
            <circle class="battle-point battle-point--rise" cx="500" cy="310" r="7" />
            <circle class="battle-point battle-point--rise" cx="470" cy="198" r="7" />

            <line class="battle-now-line" x1="760" y1="26" x2="760" y2="468" />
          </svg>

          <div class="battle-line-label battle-line-label--a" style="left:83%; top:26%;">Stream A</div>
          <div class="battle-line-label battle-line-label--b" style="left:84%; top:38%;">Stream B</div>
          <div class="battle-line-label battle-line-label--c" style="left:84%; top:66%;">Stream C</div>
          <div class="battle-line-label battle-line-label--d" style="left:84%; top:56%;">Stream D</div>
          <div class="battle-line-label battle-line-label--e" style="left:84%; top:75%;">Stream E</div>

          <div class="battle-now-badge" style="left:76%;">
            <span>Now</span>
          </div>

          <div class="battle-xlabels">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </div>

        <div class="battle-legend-row">
          <span><i class="legend-dot legend-dot--size"></i> Line height = viewers</span>
          <span><i class="legend-dot legend-dot--glow"></i> Glow points = heat / rise</span>
          <span><i class="legend-dot legend-dot--shake"></i> Vertical line = current time</span>
        </div>
      </section>

      <section class="battle-side">
        <section class="card">
          <h2>Rivalry strip</h2>
          <div class="focus-chip-row">
            <span class="focus-chip focus-chip--active">Stream A</span>
            <span class="focus-chip">Stream B</span>
            <span class="focus-chip">Stream C</span>
            <span class="focus-chip">Stream D</span>
            <span class="focus-chip">Stream E</span>
          </div>
        </section>

        <section class="card">
          <h2>Selected details</h2>
          <div class="kv">
            <div class="kv-row"><span>Streamer</span><strong>Stream A</strong></div>
            <div class="kv-row"><span>Peak viewers</span><strong>3,120</strong></div>
            <div class="kv-row"><span>Biggest rise</span><strong>19:05</strong></div>
            <div class="kv-row"><span>Hottest moment</span><strong>20:10</strong></div>
            <div class="kv-row"><span>Reversal count</span><strong>2</strong></div>
          </div>
        </section>

        <section class="card">
          <h2>What this page shows</h2>
          <ul class="feature-card__list">
            <li>Who overtook whom, and when</li>
            <li>Which stream surged in which window</li>
            <li>How audience lines and hotspots overlapped</li>
          </ul>
        </section>
      </section>
    </section>

    ${renderStatusNote("Rivalry Radar is the precision comparison page. Use Day Flow for the daily landscape and Heatmap for the live field.")}
    ${renderFooter()}
  `
}
