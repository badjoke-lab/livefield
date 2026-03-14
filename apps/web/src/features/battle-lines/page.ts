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

type UiMode = "recommended" | "custom"

type BattleCandidate = {
  key: string
  leftId: string
  rightId: string
  leftName: string
  rightName: string
  score: number
  gap: number
}

type RivalryRecommendation = {
  primary: BattleCandidate | null
  secondary: BattleCandidate[]
  latestReversal: string
  fastestChallenger: string
  reversalStrip: string[]
}

type UiState = {
  mode: UiMode
  focusId: string
  primaryKey: string | null
  customRivals: string[]
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

function parseIsoMinute(iso: string): number {
  const time = Date.parse(iso)
  return Number.isNaN(time) ? 0 : time
}

function buildRivalryRecommendation(payload: BattleLinesResponse): RivalryRecommendation {
  const candidates: BattleCandidate[] = []
  for (let left = 0; left < payload.lines.length; left += 1) {
    for (let right = left + 1; right < payload.lines.length; right += 1) {
      const a = payload.lines[left]
      const b = payload.lines[right]
      const combined = a.latestViewers + b.latestViewers
      const gap = Math.abs(a.latestViewers - b.latestViewers)
      const reversalBonus = payload.events.filter(
        (event) =>
          event.type === "reversal" &&
          ((event.streamerId === a.streamerId && event.rivalId === b.streamerId) ||
            (event.streamerId === b.streamerId && event.rivalId === a.streamerId))
      ).length
      const score = combined - gap * 0.6 + reversalBonus * 300
      candidates.push({
        key: `${a.streamerId}|${b.streamerId}`,
        leftId: a.streamerId,
        rightId: b.streamerId,
        leftName: a.name,
        rightName: b.name,
        score,
        gap
      })
    }
  }

  const ranked = [...candidates].sort((a, b) => b.score - a.score)
  const reversalEvents = payload.events
    .filter((event) => event.type === "reversal")
    .sort((a, b) => parseIsoMinute(b.bucket) - parseIsoMinute(a.bucket))

  const fastest = [...payload.lines].sort((a, b) => b.risePerMin - a.risePerMin)[0]
  const fastestChallenger = fastest ? `${fastest.name} (+${numberFmt.format(Math.round(fastest.risePerMin))}/min)` : "N/A"

  return {
    primary: ranked[0] ?? null,
    secondary: ranked.slice(1, 4),
    latestReversal:
      reversalEvents[0] !== undefined
        ? `${reversalEvents[0].label} @ ${reversalEvents[0].bucket.slice(11, 16)}`
        : "No reversal yet",
    fastestChallenger,
    reversalStrip: reversalEvents.slice(0, 6).map((event) => `${event.label} @ ${event.bucket.slice(11, 16)}`)
  }
}

function normalizeUiState(payload: BattleLinesResponse, uiState: UiState): UiState {
  const recommendation = buildRivalryRecommendation(payload)
  const availableIds = new Set(payload.lines.map((line) => line.streamerId))
  const resolvedFocus = availableIds.has(uiState.focusId) ? uiState.focusId : payload.filters.focus
  const fallbackPrimary = recommendation.primary?.key ?? null
  const primaryKey =
    uiState.primaryKey &&
    recommendation.primary !== null &&
    (uiState.primaryKey === recommendation.primary.key || recommendation.secondary.some((item) => item.key === uiState.primaryKey))
      ? uiState.primaryKey
      : fallbackPrimary

  return {
    mode: uiState.mode,
    focusId: resolvedFocus,
    primaryKey,
    customRivals: uiState.customRivals.filter((id) => availableIds.has(id) && id !== resolvedFocus).slice(0, 2)
  }
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
  return renderContentWithMode(payload, {
    mode: "recommended",
    focusId: payload.filters.focus,
    primaryKey: null,
    customRivals: []
  })
}

function renderContentWithMode(payload: BattleLinesResponse, uiState: UiState): string {
  const recommendation = buildRivalryRecommendation(payload)
  const activePrimary = [recommendation.primary, ...recommendation.secondary].find((item) => item?.key === uiState.primaryKey) ?? recommendation.primary

  const modeBadge = uiState.mode === "recommended" ? "Recommended state" : "Custom state"
  const battleFeed = payload.events.slice(0, 10)

  return `
    <section class="card page-section rivalry-radar">
      <div class="rivalry-radar__head">
        <div>
          <h2>Rivalry Radar</h2>
          <p>Start with a recommended battle, then switch to custom control without losing focus.</p>
        </div>
        <div class="battle-mock-modes">
          <span class="pill">${modeBadge}</span>
          <button type="button" class="focus-chip" data-switch-mode="recommended">Back to recommended</button>
        </div>
      </div>

      <div class="rivalry-primary">
        <strong>Primary battle</strong>
        <h3>${activePrimary ? `${escapeHtml(activePrimary.leftName)} vs ${escapeHtml(activePrimary.rightName)}` : "No battle candidates"}</h3>
        <p>Latest reversal: ${escapeHtml(recommendation.latestReversal)}</p>
        <p>Fastest challenger: ${escapeHtml(recommendation.fastestChallenger)}</p>
      </div>

      <div class="rivalry-secondary">
        <strong>Secondary battles</strong>
        <div class="focus-chip-row">
          ${recommendation.secondary
            .map(
              (item) =>
                `<button type="button" class="focus-chip ${uiState.primaryKey === item.key ? "focus-chip--active" : ""}" data-primary-battle="${escapeHtml(item.key)}">${escapeHtml(item.leftName)} vs ${escapeHtml(item.rightName)}</button>`
            )
            .join("")}
        </div>
      </div>

      <div class="rivalry-secondary rivalry-secondary--strip">
        <strong>Reversal strip</strong>
        <div class="reversal-strip">${recommendation.reversalStrip.map((line) => `<span>${escapeHtml(line)}</span>`).join("") || "<span>No reversals yet</span>"}</div>
      </div>

      <div class="rivalry-secondary">
        <strong>Add rival</strong>
        <div class="focus-chip-row">
          ${payload.lines
            .filter((line) => line.streamerId !== uiState.focusId)
            .slice(0, 6)
            .map((line) => {
              const selected = uiState.customRivals.includes(line.streamerId)
              return `<button type="button" class="focus-chip ${selected ? "focus-chip--active" : ""}" data-rival-id="${escapeHtml(line.streamerId)}">${selected ? "Added" : "Add"} ${escapeHtml(line.name)}</button>`
            })
            .join("")}
        </div>
      </div>
    </section>

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
          <h2>Battle feed</h2>
          <div class="kv">
            ${battleFeed
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

async function loadPayload(form: HTMLFormElement, target: HTMLElement, uiState: UiState): Promise<UiState> {
  target.innerHTML = `<section class="card"><h2>Loading Battle Lines…</h2></section>`

  try {
    const response = await fetch(buildUrl(form, uiState.focusId))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const payload = (await response.json()) as BattleLinesResponse
    const nextState = normalizeUiState(payload, uiState)
    target.innerHTML = renderContentWithMode(payload, nextState)

    target.querySelectorAll<HTMLButtonElement>("[data-focus]").forEach((button) => {
      button.addEventListener("click", () => {
        const focus = button.dataset.focus
        if (!focus) return
        void loadPayload(form, target, {
          ...nextState,
          mode: "custom",
          focusId: focus
        })
      })
    })

    target.querySelectorAll<HTMLButtonElement>("[data-primary-battle]").forEach((button) => {
      button.addEventListener("click", () => {
        const primaryKey = button.dataset.primaryBattle
        if (!primaryKey) return
        void loadPayload(form, target, {
          ...nextState,
          mode: "recommended",
          primaryKey
        })
      })
    })

    target.querySelectorAll<HTMLButtonElement>("[data-rival-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const rivalId = button.dataset.rivalId
        if (!rivalId) return

        const customRivals = nextState.customRivals.includes(rivalId)
          ? nextState.customRivals.filter((id) => id !== rivalId)
          : [...nextState.customRivals, rivalId].slice(0, 2)
        void loadPayload(form, target, {
          ...nextState,
          mode: "custom",
          customRivals
        })
      })
    })

    target.querySelectorAll<HTMLButtonElement>("[data-switch-mode='recommended']").forEach((button) => {
      button.addEventListener("click", () => {
        void loadPayload(form, target, {
          ...nextState,
          mode: "recommended",
          customRivals: []
        })
      })
    })

    return nextState
  } catch {
    target.innerHTML = `<section class="card"><h2>Battle Lines error</h2><p>Could not load /api/battle-lines. Try again shortly.</p></section>`
    return uiState
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

    ${renderStatusNote("Rivalry Radar recommendation layer is live with recommended and custom battle control.")}
    ${renderFooter()}
  `

  const form = root.querySelector<HTMLFormElement>("#battle-lines-controls")
  const content = root.querySelector<HTMLElement>("#battle-lines-content")
  if (!form || !content) return

  let uiState: UiState = {
    mode: "recommended",
    focusId: "",
    primaryKey: null,
    customRivals: []
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault()
    void loadPayload(form, content, uiState).then((nextState) => {
      uiState = nextState
    })
  })

  void loadPayload(form, content, uiState).then((nextState) => {
    uiState = nextState
  })
}
