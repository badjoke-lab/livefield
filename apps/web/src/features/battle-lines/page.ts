import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"

type BattleLinesResponse = {
  source: "api" | "demo"
  state: "live" | "partial" | "complete" | "empty" | "error" | "demo"
  updatedAt: string
  filters: {
    day: "today" | "yesterday" | "date"
    date: string
    top: 3 | 5 | 10
    metric: "viewers" | "indexed"
    bucketMinutes: 1 | 5 | 10
    focus: string
  }
  summary: {
    leader: string
    biggestRise: string
    peakMoment: string
    reversals: number
  }
  buckets: string[]
  lines: Array<{
    streamerId: string
    name: string
    color: string
    points: number[]
    peakViewers: number
    latestViewers: number
    risePerMin: number
    reversalCount: number
  }>
  focusStrip: Array<{ streamerId: string; name: string }>
  focusDetail: {
    streamerId: string
    name: string
    peakViewers: number
    latestViewers: number
    biggestRiseTime: string
    reversalCount: number
  }
  events: Array<{ type: "peak" | "rise" | "reversal"; bucket: string; label: string; streamerId: string; rivalId?: string }>
}

const numberFmt = new Intl.NumberFormat("en-US")

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function buildUrl(form: HTMLFormElement, focusOverride?: string): string {
  const data = new FormData(form)
  const day = String(data.get("day") ?? "today")
  const date = String(data.get("date") ?? "")
  const top = String(data.get("top") ?? "5")
  const metric = String(data.get("metric") ?? "viewers")
  const bucket = String(data.get("bucket") ?? "5")

  const url = new URL("/api/battle-lines", window.location.origin)
  url.searchParams.set("day", day)
  if (day === "date" && date) url.searchParams.set("date", date)
  url.searchParams.set("top", top)
  url.searchParams.set("metric", metric)
  url.searchParams.set("bucket", bucket)
  if (focusOverride) url.searchParams.set("focus", focusOverride)
  return url.toString()
}

function toPath(points: number[], index: number, allLines: number[][]): string {
  if (!points.length) return ""

  const width = 1000
  const height = 520
  const paddingX = 44
  const paddingTop = 24
  const paddingBottom = 52

  const flattened = allLines.flat()
  const max = Math.max(...flattened, 1)
  const min = Math.min(...flattened, 0)
  const range = Math.max(max - min, 1)

  return points
    .map((value, pointIdx) => {
      const x = paddingX + ((width - paddingX * 2) * pointIdx) / Math.max(points.length - 1, 1)
      const normalized = (value - min) / range
      const y = paddingTop + (height - paddingTop - paddingBottom) * (1 - normalized)
      return `${pointIdx === 0 && index >= 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(" ")
}

function renderChart(payload: BattleLinesResponse): string {
  const allPoints = payload.lines.map((line) => line.points)
  const nowBucketIndex = Math.max(0, payload.buckets.length - 1)
  const nowRatio = payload.buckets.length > 1 ? nowBucketIndex / (payload.buckets.length - 1) : 0
  const nowLeft = 4 + nowRatio * 92

  return `
    <section class="battle-mock-card">
      <div class="battle-mock-card__head">
        <div>
          <strong>Battle lines</strong>
          <p>Real Twitch-backed comparison when available with demo fallback.</p>
        </div>
        <div class="battle-mock-modes">
          <span class="pill">${payload.filters.metric === "indexed" ? "Indexed" : "Viewers"}</span>
          <span class="pill">${payload.filters.bucketMinutes}m</span>
          <span class="pill">${payload.state}</span>
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
          ${payload.lines
            .map(
              (line, index) =>
                `<path class="battle-line" style="stroke:${line.color};stroke-width:${Math.max(2.5, 5 - index * 0.25)}" d="${toPath(line.points, index, allPoints)}" />`
            )
            .join("")}
          <line class="battle-now-line" x1="${(nowLeft / 100) * 1000}" y1="26" x2="${(nowLeft / 100) * 1000}" y2="468" />
        </svg>

        ${payload.lines
          .slice(0, 5)
          .map((line, index) => {
            const y = 24 + index * 12
            return `<div class="battle-line-label" style="left:86%; top:${y}%; color:${line.color}">${escapeHtml(line.name)}</div>`
          })
          .join("")}

        <div class="battle-now-badge" style="left:${nowLeft}%;"><span>Now</span></div>

        <div class="battle-xlabels">
          <span>${payload.buckets[0]?.slice(11, 16) ?? "00:00"}</span>
          <span>${payload.buckets[Math.floor(payload.buckets.length * 0.25)]?.slice(11, 16) ?? "06:00"}</span>
          <span>${payload.buckets[Math.floor(payload.buckets.length * 0.5)]?.slice(11, 16) ?? "12:00"}</span>
          <span>${payload.buckets[Math.floor(payload.buckets.length * 0.75)]?.slice(11, 16) ?? "18:00"}</span>
          <span>${payload.buckets[payload.buckets.length - 1]?.slice(11, 16) ?? "24:00"}</span>
        </div>
      </div>

      <div class="battle-legend-row">
        <span><i class="legend-dot legend-dot--size"></i> Line height = ${payload.filters.metric}</span>
        <span><i class="legend-dot legend-dot--glow"></i> Events = peak / rise / reversal</span>
        <span><i class="legend-dot legend-dot--shake"></i> Vertical line = current bucket</span>
      </div>
    </section>
  `
}

function renderContent(payload: BattleLinesResponse): string {
  return `
    <section class="summary-strip page-section">
      <div class="summary-item"><strong>Leader</strong><span>${escapeHtml(payload.summary.leader)}</span></div>
      <div class="summary-item"><strong>Biggest rise</strong><span>${escapeHtml(payload.summary.biggestRise)}</span></div>
      <div class="summary-item"><strong>Peak moment</strong><span>${escapeHtml(payload.summary.peakMoment)}</span></div>
      <div class="summary-item"><strong>Reversals</strong><span>${numberFmt.format(payload.summary.reversals)}</span></div>
    </section>

    <section class="grid-2 page-section">
      ${renderChart(payload)}
      <section class="battle-side">
        <section class="card">
          <h2>Focus strip</h2>
          <div class="focus-chip-row">
            ${payload.focusStrip
              .map((item) => {
                const active = item.streamerId === payload.filters.focus
                return `<button type="button" class="focus-chip ${active ? "focus-chip--active" : ""}" data-focus="${escapeHtml(item.streamerId)}">${escapeHtml(item.name)}</button>`
              })
              .join("")}
          </div>
        </section>

        <section class="card">
          <h2>Selected details</h2>
          <div class="kv">
            <div class="kv-row"><span>Streamer</span><strong>${escapeHtml(payload.focusDetail.name)}</strong></div>
            <div class="kv-row"><span>Peak viewers</span><strong>${numberFmt.format(payload.focusDetail.peakViewers)}</strong></div>
            <div class="kv-row"><span>Latest viewers</span><strong>${numberFmt.format(payload.focusDetail.latestViewers)}</strong></div>
            <div class="kv-row"><span>Biggest rise</span><strong>${escapeHtml(payload.focusDetail.biggestRiseTime)}</strong></div>
            <div class="kv-row"><span>Reversal count</span><strong>${numberFmt.format(payload.focusDetail.reversalCount)}</strong></div>
          </div>
        </section>

        <section class="card">
          <h2>Event layer</h2>
          <div class="kv">
            ${payload.events
              .slice(0, 10)
              .map((event) => `<div class="kv-row"><span>${event.type.toUpperCase()}</span><strong>${escapeHtml(event.label)} @ ${escapeHtml(event.bucket.slice(11, 16))}</strong></div>`)
              .join("")}
          </div>
        </section>

        <section class="card">
          <h2>Data State</h2>
          <div class="kv">
            <div class="kv-row"><span>Source</span><strong>${payload.source}</strong></div>
            <div class="kv-row"><span>Status</span><strong>${payload.state}</strong></div>
            <div class="kv-row"><span>Top</span><strong>${payload.filters.top}</strong></div>
            <div class="kv-row"><span>Updated</span><strong>${escapeHtml(payload.updatedAt.slice(11, 19))} UTC</strong></div>
          </div>
        </section>
      </section>
    </section>
  `
}

async function loadPayload(form: HTMLFormElement, target: HTMLElement, focusOverride?: string): Promise<void> {
  target.innerHTML = `<section class="card"><h2>Loading Battle Lines…</h2></section>`

  try {
    const response = await fetch(buildUrl(form, focusOverride))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const payload = (await response.json()) as BattleLinesResponse
    target.innerHTML = renderContent(payload)

    target.querySelectorAll<HTMLButtonElement>("[data-focus]").forEach((button) => {
      button.addEventListener("click", () => {
        const focus = button.dataset.focus
        if (!focus) return
        void loadPayload(form, target, focus)
      })
    })
  } catch {
    target.innerHTML = `<section class="card"><h2>Battle Lines error</h2><p>Could not load /api/battle-lines. Try again shortly.</p></section>`
  }
}

export function renderBattleLinesPage(root: HTMLElement): void {
  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("battle-lines")}
    ${renderHero({
      eyebrow: "RIVALRIES",
      title: "Rivalry Radar",
      subtitle: "Compare Twitch audience lines with a stable base battle layer.",
      note: "Today/Yesterday/Date, Top 3/5/10, Viewers/Indexed, 1m/5m/10m, Focus strip, and event layer.",
      actions: [
        { href: "/day-flow/", label: "Open Day Flow" },
        { href: "/method/", label: "Open Method" }
      ]
    })}

    <form class="controls" id="battle-lines-controls">
      <select name="day" aria-label="Day">
        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="date">Date</option>
      </select>
      <input type="date" name="date" aria-label="Date picker" />
      <select name="top" aria-label="Top N">
        <option value="3">Top 3</option>
        <option value="5" selected>Top 5</option>
        <option value="10">Top 10</option>
      </select>
      <select name="metric" aria-label="Metric">
        <option value="viewers" selected>Viewers</option>
        <option value="indexed">Indexed</option>
      </select>
      <select name="bucket" aria-label="Bucket size">
        <option value="1">1m</option>
        <option value="5" selected>5m</option>
        <option value="10">10m</option>
      </select>
      <button type="submit">Refresh</button>
    </form>

    <div id="battle-lines-content"></div>

    ${renderStatusNote("Rivalry Radar base comparison is live. Recommendation layers will be added in follow-up PRs.")}
    ${renderFooter()}
  `

  const form = root.querySelector<HTMLFormElement>("#battle-lines-controls")
  const content = root.querySelector<HTMLElement>("#battle-lines-content")
  if (!form || !content) return

  form.addEventListener("submit", (event) => {
    event.preventDefault()
    void loadPayload(form, content)
  })

  void loadPayload(form, content)
}
