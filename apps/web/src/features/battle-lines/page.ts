import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"
import { fetchBattleLinesPayloadFromForm } from "../../shared/api/battle-lines-api"
import type {
  BattleCandidate,
  BattleLinesPayload,
  BattleReversalStripItem
} from "../../../../packages/shared/src/types/battle-lines"

type UiMode = "recommended" | "custom"

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

function formatGap(value: number): string {
  return `${numberFmt.format(Math.max(0, Math.round(value)))} gap`
}

function candidateTagLabel(tag: BattleCandidate["tag"]): string {
  if (tag === "recent-reversal") return "Recent reversal"
  if (tag === "rising-challenger") return "Rising challenger"
  if (tag === "heated") return "Heated"
  return "Closing"
}

function toPath(points: number[], allLines: number[][]): string {
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
      return `${pointIdx === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(" ")
}

function normalizeUiState(payload: BattleLinesPayload, uiState: UiState): UiState {
  const availableIds = new Set(payload.lines.map((line) => line.streamerId))
  const availablePrimaryKeys = new Set(
    [payload.recommendation.primaryBattle, ...payload.recommendation.secondaryBattles]
      .filter((item): item is BattleCandidate => item !== null)
      .map((item) => item.key)
  )

  const resolvedFocus =
    availableIds.has(uiState.focusId) ? uiState.focusId : (payload.filters.focus || payload.lines[0]?.streamerId || "")
  const fallbackPrimary = payload.recommendation.primaryBattle?.key ?? null
  const primaryKey =
    uiState.primaryKey && availablePrimaryKeys.has(uiState.primaryKey)
      ? uiState.primaryKey
      : fallbackPrimary

  return {
    mode: uiState.mode,
    focusId: resolvedFocus,
    primaryKey,
    customRivals: uiState.customRivals.filter((id) => availableIds.has(id) && id !== resolvedFocus).slice(0, 2)
  }
}

function resolveActivePrimary(payload: BattleLinesPayload, uiState: UiState): BattleCandidate | null {
  return (
    [payload.recommendation.primaryBattle, ...payload.recommendation.secondaryBattles]
      .filter((item): item is BattleCandidate => item !== null)
      .find((item) => item.key === uiState.primaryKey) ??
    payload.recommendation.primaryBattle ??
    null
  )
}

function buildHighlightedIds(payload: BattleLinesPayload, uiState: UiState, activePrimary: BattleCandidate | null): Set<string> {
  const ids = new Set<string>()

  if (uiState.mode === "custom") {
    if (uiState.focusId) ids.add(uiState.focusId)
    for (const rivalId of uiState.customRivals) ids.add(rivalId)
    if (!ids.size && activePrimary) {
      ids.add(activePrimary.leftId)
      ids.add(activePrimary.rightId)
    }
    if (!ids.size && payload.lines[0]) ids.add(payload.lines[0].streamerId)
    return ids
  }

  if (activePrimary) {
    ids.add(activePrimary.leftId)
    ids.add(activePrimary.rightId)
  }

  return ids
}

function buildBattleFeed(payload: BattleLinesPayload, activePrimary: BattleCandidate | null): string[] {
  const lines: string[] = []

  if (activePrimary) {
    lines.push(
      `${activePrimary.leftName} vs ${activePrimary.rightName} is ${activePrimary.gapTrend} (${formatGap(activePrimary.gap)})`
    )
  }

  if (payload.summary.latestReversal !== "No reversal yet") lines.push(payload.summary.latestReversal)
  if (payload.summary.fastestChallenger !== "N/A") lines.push(payload.summary.fastestChallenger)
  if (payload.summary.mostHeatedBattle !== "No heated battle") lines.push(payload.summary.mostHeatedBattle)

  for (const item of payload.recommendation.reversalStrip.slice(0, 2)) {
    lines.push(`${item.label} @ ${item.timestamp.slice(11, 16)}`)
  }

  return [...new Set(lines)].slice(0, 5)
}

function renderReversalStrip(items: BattleReversalStripItem[]): string {
  if (!items.length) return "<span>No reversals yet</span>"

  return items
    .map(
      (item) =>
        `<span title="${escapeHtml(`${item.passer} passed ${item.passed} · ${formatGap(item.gapBefore)} → ${formatGap(item.gapAfter)}`)}">${escapeHtml(item.label)} · ${escapeHtml(item.timestamp.slice(11, 16))}</span>`
    )
    .join("")
}

function renderChart(payload: BattleLinesPayload, uiState: UiState, activePrimary: BattleCandidate | null): string {
  if (!payload.lines.length) {
    return `
      <section class="battle-mock-card">
        <div class="battle-mock-card__head">
          <div>
            <strong>Battle lines</strong>
            <p>No lines available for the selected day yet.</p>
          </div>
        </div>
      </section>
    `
  }

  const allPoints = payload.lines.map((line) => line.points)
  const nowBucketIndex = Math.max(0, payload.buckets.length - 1)
  const nowRatio = payload.buckets.length > 1 ? nowBucketIndex / (payload.buckets.length - 1) : 0
  const nowLeft = 4 + nowRatio * 92
  const highlightedIds = buildHighlightedIds(payload, uiState, activePrimary)

  return `
    <section class="battle-mock-card">
      <div class="battle-mock-card__head">
        <div>
          <strong>Battle lines</strong>
          <p>Recommended battle is strongest by default. Custom selection keeps control on your pair.</p>
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
            .map((line, index) => {
              const isHighlighted = highlightedIds.has(line.streamerId)
              const isPrimary =
                activePrimary !== null && (line.streamerId === activePrimary.leftId || line.streamerId === activePrimary.rightId)

              const strokeWidth = isPrimary ? 5.2 : isHighlighted ? 4.2 : Math.max(2.2, 4.2 - index * 0.2)
              const strokeOpacity = isPrimary ? 1 : isHighlighted ? 0.92 : 0.28

              return `<path class="battle-line" style="stroke:${line.color};stroke-width:${strokeWidth};stroke-opacity:${strokeOpacity}" d="${toPath(line.points, allPoints)}" />`
            })
            .join("")}
          <line class="battle-now-line" x1="${(nowLeft / 100) * 1000}" y1="26" x2="${(nowLeft / 100) * 1000}" y2="468" />
        </svg>

        ${payload.lines
          .slice(0, 5)
          .map((line, index) => {
            const y = 24 + index * 12
            const isHighlighted = highlightedIds.has(line.streamerId)
            return `<div class="battle-line-label" style="left:86%; top:${y}%; color:${line.color}; opacity:${isHighlighted ? 1 : 0.42}">${escapeHtml(line.name)}</div>`
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
        <span><i class="legend-dot legend-dot--glow"></i> Primary battle = strongest emphasis</span>
        <span><i class="legend-dot legend-dot--shake"></i> Vertical line = current bucket</span>
      </div>
    </section>
  `
}

function renderContentWithMode(payload: BattleLinesPayload, uiState: UiState): string {
  const activePrimary = resolveActivePrimary(payload, uiState)
  const battleFeed = buildBattleFeed(payload, activePrimary)
  const focusLine = payload.lines.find((line) => line.streamerId === uiState.focusId) ?? payload.lines[0] ?? null
  const currentRivalId =
    uiState.customRivals[0]
    ?? (activePrimary
      ? (activePrimary.leftId === uiState.focusId ? activePrimary.rightId : activePrimary.leftId)
      : "")
  const rivalLine = payload.lines.find((line) => line.streamerId === currentRivalId) ?? null
  const modeBadge = uiState.mode === "recommended" ? "Recommended state" : "Custom state"

  return `
    <section class="card page-section rivalry-radar">
      <div class="rivalry-radar__head">
        <div>
          <h2>Rivalry Radar</h2>
          <p>Start with the current recommended battle, then keep custom control on your own pair.</p>
        </div>
        <div class="battle-mock-modes">
          <span class="pill">${modeBadge}</span>
          <button type="button" class="focus-chip" data-switch-mode="recommended">Back to recommended</button>
        </div>
      </div>

      <div class="rivalry-primary">
        <strong>Primary battle</strong>
        <h3>${activePrimary ? `${escapeHtml(activePrimary.leftName)} vs ${escapeHtml(activePrimary.rightName)}` : "No battle candidates"}</h3>
        <p>${activePrimary ? `${escapeHtml(candidateTagLabel(activePrimary.tag))} · ${escapeHtml(activePrimary.currentGapLabel)} · ${escapeHtml(activePrimary.gapTrend)}` : "No live battle now"}</p>
        <p>Latest reversal: ${escapeHtml(payload.recommendation.latestReversal)}</p>
        <p>Fastest challenger: ${escapeHtml(payload.recommendation.fastestChallenger)}</p>
      </div>

      <div class="rivalry-secondary">
        <strong>Secondary battles</strong>
        <div class="focus-chip-row">
          ${payload.recommendation.secondaryBattles
            .map(
              (item) =>
                `<button type="button" class="focus-chip ${uiState.primaryKey === item.key ? "focus-chip--active" : ""}" data-primary-battle="${escapeHtml(item.key)}" data-primary-focus="${escapeHtml(item.leftId)}">${escapeHtml(item.leftName)} vs ${escapeHtml(item.rightName)} · ${escapeHtml(candidateTagLabel(item.tag))}</button>`
            )
            .join("") || `<span class="muted">No secondary battles right now.</span>`}
        </div>
      </div>

      <div class="rivalry-secondary rivalry-secondary--strip">
        <strong>Reversal strip</strong>
        <div class="reversal-strip">${renderReversalStrip(payload.recommendation.reversalStrip)}</div>
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
      <div class="summary-item"><strong>Live battle now</strong><span>${escapeHtml(payload.summary.liveBattleNow)}</span></div>
      <div class="summary-item"><strong>Latest reversal</strong><span>${escapeHtml(payload.summary.latestReversal)}</span></div>
      <div class="summary-item"><strong>Fastest challenger</strong><span>${escapeHtml(payload.summary.fastestChallenger)}</span></div>
      <div class="summary-item"><strong>Most heated battle</strong><span>${escapeHtml(payload.summary.mostHeatedBattle)}</span></div>
    </section>

    <section class="grid-2 page-section">
      ${renderChart(payload, uiState, activePrimary)}
      <section class="battle-side">
        <section class="card">
          <h2>Focus strip</h2>
          <div class="focus-chip-row">
            ${payload.focusStrip
              .map((item) => {
                const active = item.streamerId === uiState.focusId
                return `<button type="button" class="focus-chip ${active ? "focus-chip--active" : ""}" data-focus="${escapeHtml(item.streamerId)}">${escapeHtml(item.name)}</button>`
              })
              .join("")}
          </div>
        </section>

        <section class="card">
          <h2>Selected details</h2>
          <div class="kv">
            <div class="kv-row"><span>Streamer</span><strong>${escapeHtml(focusLine?.name ?? payload.focusDetail.name)}</strong></div>
            <div class="kv-row"><span>Peak viewers</span><strong>${numberFmt.format(focusLine?.peakViewers ?? payload.focusDetail.peakViewers)}</strong></div>
            <div class="kv-row"><span>Latest viewers</span><strong>${numberFmt.format(focusLine?.latestViewers ?? payload.focusDetail.latestViewers)}</strong></div>
            <div class="kv-row"><span>Biggest rise</span><strong>${escapeHtml(payload.focusDetail.biggestRiseTime)}</strong></div>
            <div class="kv-row"><span>Reversal count</span><strong>${numberFmt.format(focusLine?.reversalCount ?? payload.focusDetail.reversalCount)}</strong></div>
          </div>
        </section>

        <section class="card">
          <h2>Current battle</h2>
          <div class="kv">
            <div class="kv-row"><span>Pair</span><strong>${activePrimary ? `${escapeHtml(activePrimary.leftName)} vs ${escapeHtml(activePrimary.rightName)}` : "N/A"}</strong></div>
            <div class="kv-row"><span>Current gap</span><strong>${activePrimary ? escapeHtml(activePrimary.currentGapLabel) : "N/A"}</strong></div>
            <div class="kv-row"><span>Gap trend</span><strong>${activePrimary ? escapeHtml(activePrimary.gapTrend) : "N/A"}</strong></div>
            <div class="kv-row"><span>Tag</span><strong>${activePrimary ? escapeHtml(candidateTagLabel(activePrimary.tag)) : "N/A"}</strong></div>
            <div class="kv-row"><span>Rival</span><strong>${escapeHtml(rivalLine?.name ?? "N/A")}</strong></div>
          </div>
        </section>

        <section class="card">
          <h2>Battle feed</h2>
          <div class="kv">
            ${battleFeed.map((line) => `<div class="kv-row"><span>FEED</span><strong>${escapeHtml(line)}</strong></div>`).join("")}
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
    const payload = await fetchBattleLinesPayloadFromForm(form, {
      focusOverride: uiState.focusId || undefined
    })

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
        const focusId = button.dataset.primaryFocus
        if (!primaryKey) return

        void loadPayload(form, target, {
          ...nextState,
          mode: "custom",
          primaryKey,
          focusId: focusId || nextState.focusId
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
          primaryKey: payload.recommendation.primaryBattle?.key ?? null,
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
  root.className = "site-shell battle-lines-page"
  root.innerHTML = `
    ${renderHeader("battle-lines")}
    ${renderHero({
      eyebrow: "RIVALRIES",
      title: "Rivalry Radar",
      subtitle: "See who is fighting for attention right now.",
      note: "Today/Yesterday/Date, Top 3/5/10, Viewers/Indexed, 1m/5m/10m, recommended battle, custom focus, and reversal strip.",
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

    ${renderStatusNote("Rivalry Radar uses API-provided primary and secondary battles, with custom state layered on top.")}
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
