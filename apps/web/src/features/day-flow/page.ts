import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"

type DayFlowResponse = {
  source: "api" | "demo"
  state: "live" | "partial" | "complete" | "empty" | "demo"
  filters: { day: "today" | "yesterday" | "date"; date: string; top: 10 | 20 | 50; metric: "volume" | "share"; bucketMinutes: 5 | 10 }
  summary: { peakLeader: string; longestDominance: string; hottestWindow: string; biggestRise: string; activity: string }
  timeFocus: { selectedTime: string; rank1: string; rank2: string; peakShare: string; hottestStream: string }
  buckets: string[]
  streams: Array<{ name: string; isOthers: boolean; points: number[]; totalViewerMinutes: number }>
}

const numberFmt = new Intl.NumberFormat("en-US")

function renderSeries(payload: DayFlowResponse): string {
  const topRows = payload.streams.slice(0, 8)
  return `
    <section class="card">
      <h2>Daily audience landscape</h2>
      <p class="muted">Real Twitch rollup-backed data when available. Volume/Share changes geometry only by viewers. Activity remains secondary.</p>
      <div class="kv">
        ${topRows
          .map((stream) => {
            const latest = stream.points[stream.points.length - 1] ?? 0
            const peak = stream.points.reduce((best, point) => Math.max(best, point), 0)
            return `<div class="kv-row"><span>${stream.name}${stream.isOthers ? " (required)" : ""}</span><strong>${numberFmt.format(latest)} now / ${numberFmt.format(peak)} peak</strong></div>`
          })
          .join("")}
      </div>
    </section>
  `
}

function buildUrl(form: HTMLFormElement): string {
  const data = new FormData(form)
  const day = String(data.get("day") ?? "today")
  const date = String(data.get("date") ?? "")
  const top = String(data.get("top") ?? "20")
  const metric = String(data.get("metric") ?? "volume")
  const bucket = String(data.get("bucket") ?? "5")

  const url = new URL("/api/day-flow", window.location.origin)
  url.searchParams.set("day", day)
  if (day === "date" && date) url.searchParams.set("date", date)
  url.searchParams.set("top", top)
  url.searchParams.set("metric", metric)
  url.searchParams.set("bucket", bucket)
  return url.toString()
}

async function loadPayload(form: HTMLFormElement, target: HTMLElement): Promise<void> {
  target.innerHTML = `<section class="card"><h2>Loading Day Flow…</h2></section>`

  try {
    const response = await fetch(buildUrl(form))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const payload = (await response.json()) as DayFlowResponse
    target.innerHTML = `
      <section class="summary-strip page-section">
        <div class="summary-item"><strong>Peak leader</strong><span>${payload.summary.peakLeader}</span></div>
        <div class="summary-item"><strong>Longest dominance</strong><span>${payload.summary.longestDominance}</span></div>
        <div class="summary-item"><strong>Hottest window</strong><span>${payload.summary.hottestWindow}</span></div>
        <div class="summary-item"><strong>Biggest rise</strong><span>${payload.summary.biggestRise}</span></div>
      </section>

      <section class="grid-2 page-section">
        ${renderSeries(payload)}
        <section class="dayflow-side">
          <section class="card">
            <h2>Time Focus</h2>
            <div class="kv">
              <div class="kv-row"><span>Selected time</span><strong>${payload.timeFocus.selectedTime}</strong></div>
              <div class="kv-row"><span>Rank 1</span><strong>${payload.timeFocus.rank1}</strong></div>
              <div class="kv-row"><span>Rank 2</span><strong>${payload.timeFocus.rank2}</strong></div>
              <div class="kv-row"><span>Peak share</span><strong>${payload.timeFocus.peakShare}</strong></div>
              <div class="kv-row"><span>Hottest stream</span><strong>${payload.timeFocus.hottestStream}</strong></div>
            </div>
          </section>
          <section class="card">
            <h2>Data State</h2>
            <div class="kv">
              <div class="kv-row"><span>Source</span><strong>${payload.source}</strong></div>
              <div class="kv-row"><span>Status</span><strong>${payload.state}</strong></div>
              <div class="kv-row"><span>Coverage</span><strong>Top ${payload.filters.top} + Others</strong></div>
              <div class="kv-row"><span>Activity</span><strong>${payload.summary.activity}</strong></div>
            </div>
          </section>
        </section>
      </section>
    `
  } catch {
    target.innerHTML = `<section class="card"><h2>Day Flow error</h2><p>Could not load /api/day-flow. Try again shortly.</p></section>`
  }
}

export function renderDayFlowPage(root: HTMLElement): void {
  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("day-flow")}
    ${renderHero({
      eyebrow: "TODAY",
      title: "Day Flow",
      subtitle: "Read the daily Twitch audience landscape as stacked territory over time.",
      note: "Today view with Yesterday/Date picker, Top N + Others, Volume/Share, and 5m/10m controls.",
      actions: [
        { href: "/battle-lines/", label: "Open Rivalry Radar" },
        { href: "/method/", label: "Open Method" }
      ]
    })}

    <form class="controls" id="day-flow-controls">
      <select name="day" aria-label="Day">
        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="date">Date</option>
      </select>
      <input type="date" name="date" aria-label="Date picker" />
      <select name="top" aria-label="Top N">
        <option value="10">Top 10 + Others</option>
        <option value="20" selected>Top 20 + Others</option>
        <option value="50">Top 50 + Others</option>
      </select>
      <select name="metric" aria-label="Metric">
        <option value="volume" selected>Volume</option>
        <option value="share">Share</option>
      </select>
      <select name="bucket" aria-label="Bucket size">
        <option value="5" selected>5m buckets</option>
        <option value="10">10m buckets</option>
      </select>
      <button type="submit">Refresh</button>
    </form>

    <div id="day-flow-content"></div>

    ${renderStatusNote("Day Flow is the daily overview. Use Heatmap for the current field and Rivalry Radar for precision comparison.")}
    ${renderFooter()}
  `

  const form = root.querySelector<HTMLFormElement>("#day-flow-controls")
  const content = root.querySelector<HTMLElement>("#day-flow-content")
  if (!form || !content) return

  form.addEventListener("submit", (event) => {
    event.preventDefault()
    void loadPayload(form, content)
  })

  void loadPayload(form, content)
}
