import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"
import {
  fetchBattleLinesPayloadFromForm,
  isBattleLinesAbortError
} from "../../shared/api/battle-lines-api"
import type {
  BattleCandidate,
  BattleLinesPayload
} from "../../../../../packages/shared/src/types/battle-lines"
import { BATTLE_LINES_CONTROLS_ID, renderBattleLinesControls } from "./controls"
import {
  renderBattlePrimaryDetailSections,
  renderBattleDataStateSection,
  renderBattleFeedSection,
  renderBattleEmptyDetailSection
} from "./detail-panel"
import { renderFocusStripSection } from "./focus-strip"
import {
  BATTLE_LINES_AUTO_REFRESH_MS,
  buildBattleFeed,
  buildHighlightedIds,
  normalizeUiState,
  resolveActivePrimary,
  shouldAutoRefreshBattleLines,
  type UiState
} from "./state"
import {
  resolveObservedWindowState,
  resolveViewportRange,
  type ChartViewportMode
} from "../../shared/runtime/observed-window"
import {
  renderAddRivalUtilitySection,
  renderBattleEmptySummaryStrip,
  renderBattleSummaryCompact,
  renderBattleSummaryStrip,
  renderReversalStripSection,
  renderPrimaryBattleSummary,
  renderSecondaryBattlesSection
} from "./summary"
import { mountBattleLinesRenderer } from "./renderer"

type RootWithCleanup = HTMLElement & {
  __battleLinesDispose?: () => void
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

function getRefreshNoteText(payload: BattleLinesPayload | null): string {
  if (!payload) return "Loading battle lines data…"
  if (shouldAutoRefreshBattleLines(payload.filters)) {
    return `Auto-refresh runs every ${Math.round(BATTLE_LINES_AUTO_REFRESH_MS / 1000)}s on Today.`
  }
  return "Auto-refresh is available only on Today."
}

function buildBattleObservedIndices(payload: BattleLinesPayload): number[] {
  const indices: number[] = []
  for (let index = 0; index < payload.buckets.length; index += 1) {
    if (payload.lines.some((line) => (line.points[index] ?? 0) > 0 || (line.viewerPoints[index] ?? 0) > 0)) {
      indices.push(index)
    }
  }
  return indices
}

function buildBattleChartPayload(
  payload: BattleLinesPayload,
  startIndex: number,
  endIndex: number
): BattleLinesPayload {
  const safeStart = Math.max(0, Math.min(startIndex, payload.buckets.length - 1))
  const safeEnd = Math.max(safeStart, Math.min(endIndex, payload.buckets.length - 1))
  return {
    ...payload,
    buckets: payload.buckets.slice(safeStart, safeEnd + 1),
    lines: payload.lines.map((line) => ({
      ...line,
      points: line.points.slice(safeStart, safeEnd + 1),
      viewerPoints: line.viewerPoints.slice(safeStart, safeEnd + 1)
    }))
  }
}

function selectSparseBattleLines(
  lines: BattleLinesPayload["lines"],
  uiState: UiState,
  activePrimary: BattleCandidate | null,
  maxLines: number
): BattleLinesPayload["lines"] {
  if (lines.length <= maxLines) return lines

  const requiredIds = new Set<string>()
  if (uiState.focusId) requiredIds.add(uiState.focusId)
  if (activePrimary) {
    requiredIds.add(activePrimary.leftId)
    requiredIds.add(activePrimary.rightId)
  }

  const selected: BattleLinesPayload["lines"] = []
  for (const line of lines) {
    if (!requiredIds.has(line.streamerId)) continue
    selected.push(line)
    if (selected.length >= maxLines) return selected
  }

  for (const line of lines) {
    if (selected.some((candidate) => candidate.streamerId === line.streamerId)) continue
    selected.push(line)
    if (selected.length >= maxLines) break
  }

  return selected
}

function renderBattleViewportLabels(
  payload: BattleLinesPayload,
  highlightedIds: Set<string>,
  sparseMode: boolean
): string {
  const lines = payload.lines.slice(0, sparseMode ? 2 : 3)
  if (!lines.length) return ""
  const maxValue = Math.max(...lines.flatMap((line) => line.points), 1)
  const minValue = Math.min(...lines.flatMap((line) => line.points), 0)
  const range = Math.max(1, maxValue - minValue)
  let previousTop = 8

  return lines
    .map((line) => {
      const lastValue = line.points[line.points.length - 1] ?? 0
      const rawTop = 10 + ((maxValue - lastValue) / range) * 68
      const clampedTop = Math.max(previousTop + 8, Math.min(84, rawTop))
      previousTop = clampedTop
      const opacity = highlightedIds.has(line.streamerId) ? 0.95 : 0.55
      const compactName = line.name.length > 14 ? `${line.name.slice(0, 13)}…` : line.name
      return `<div class="battle-line-label" style="left:80%; top:${clampedTop}%; color:${line.color}; opacity:${opacity}">${escapeHtml(compactName)}</div>`
    })
    .join("")
}

function renderChart(
  payload: BattleLinesPayload,
  chartPayload: BattleLinesPayload,
  uiState: UiState,
  activePrimary: BattleCandidate | null,
  viewportMode: ChartViewportMode,
  observedSinceLabel: string | null,
  sparseMode: boolean
): string {
  if (!payload.lines.length) {
    return `
      <section class="battle-mock-card battle-mock-card--battle-lines battle-state-card battle-state-card--empty">
        <div class="battle-mock-card__head">
          <div>
            <strong>Battle lines</strong>
            <p>No battle lines are available in the observed window for this selection yet.</p>
          </div>
        </div>
      </section>
    `
  }

  const nowBucketIndex = Math.max(0, chartPayload.buckets.length - 1)
  const nowRatio = chartPayload.buckets.length > 1 ? nowBucketIndex / (chartPayload.buckets.length - 1) : 0
  const nowLeft = 4 + nowRatio * 92
  const highlightedIds = buildHighlightedIds(payload, uiState, activePrimary)

  return `
    <section class="battle-mock-card battle-mock-card--battle-lines">
      <div class="battle-mock-card__head">
        <div>
          <strong>Battle lines</strong>
          <p>Start with the recommended battle, then keep your own focus when you want to track a specific pair.</p>
          <div class="battle-live-row">
            <span class="pill pill--quiet" data-battle-refresh-state>${shouldAutoRefreshBattleLines(payload.filters) ? "Auto-refresh on" : "Auto-refresh off"}</span>
            <span class="battle-live-note" data-battle-refresh-note>${escapeHtml(getRefreshNoteText(payload))}</span>
          </div>
        </div>
        <div class="battle-mock-modes">
          <span class="pill">${payload.filters.metric === "indexed" ? "Indexed" : "Viewers"}</span>
          <span class="pill">${payload.filters.bucketMinutes}m</span>
          <span class="pill">${payload.state}</span>
          ${observedSinceLabel ? `<span class="pill pill--quiet">Observed since ${observedSinceLabel} UTC</span>` : ""}
          ${payload.filters.day === "today"
            ? `<button type="button" class="focus-chip ${viewportMode === "observed" ? "focus-chip--active" : ""}" data-battle-viewport="observed">Observed window</button>
               <button type="button" class="focus-chip ${viewportMode === "full-day" ? "focus-chip--active" : ""}" data-battle-viewport="full-day">Full day</button>`
            : ""}
        </div>
      </div>

      <div class="battle-mock-stage battle-mock-stage--battle-lines" data-battle-lines-stage data-hover-active="false">
        <canvas
          class="battle-lines-canvas"
          data-battle-lines-canvas
          aria-label="Battle lines chart"
          role="img"
        ></canvas>

        <div class="battle-ylabels">
          <span>High</span>
          <span>Mid</span>
          <span>Low</span>
        </div>

        ${renderBattleViewportLabels(chartPayload, highlightedIds, sparseMode)}

        <div class="battle-now-badge" style="left:${nowLeft}%;"><span>Now</span></div>

        <div class="battle-xlabels">
          <span>${chartPayload.buckets[0]?.slice(11, 16) ?? "00:00"}</span>
          <span>${chartPayload.buckets[Math.floor(chartPayload.buckets.length * 0.25)]?.slice(11, 16) ?? "06:00"}</span>
          <span>${chartPayload.buckets[Math.floor(chartPayload.buckets.length * 0.5)]?.slice(11, 16) ?? "12:00"}</span>
          <span>${chartPayload.buckets[Math.floor(chartPayload.buckets.length * 0.75)]?.slice(11, 16) ?? "18:00"}</span>
          <span>${chartPayload.buckets[chartPayload.buckets.length - 1]?.slice(11, 16) ?? "24:00"}</span>
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

function renderEmptyRecoveryLayout(payload: BattleLinesPayload): string {
  return `
    ${renderBattleEmptySummaryStrip(payload, escapeHtml)}
    ${renderBattleEmptyDetailSection(payload, escapeHtml)}
  `
}

function renderContentWithMode(
  payload: BattleLinesPayload,
  chartPayload: BattleLinesPayload,
  uiState: UiState,
  viewportMode: ChartViewportMode,
  observedSinceLabel: string | null,
  sparseMode: boolean
): string {
  if (payload.state === "empty" || !payload.lines.length) {
    return renderEmptyRecoveryLayout(payload)
  }

  const activePrimary = resolveActivePrimary(payload, uiState)
  const battleFeed = buildBattleFeed(payload, activePrimary)

  return `
    ${renderBattleSummaryStrip(payload, escapeHtml)}
    ${renderBattleSummaryCompact(payload, escapeHtml)}

    <section class="page-section battle-lines-main-grid">
      <section class="battle-lines-main-column">
        <section class="card battle-primary-card battle-utility-item">
          ${renderPrimaryBattleSummary(payload, activePrimary, {
            escapeHtml,
            formatGap,
            candidateTagLabel
          })}
        </section>

        ${renderChart(payload, chartPayload, uiState, activePrimary, viewportMode, observedSinceLabel, sparseMode)}

        ${renderReversalStripSection(payload, {
          escapeHtml,
          formatGap,
          candidateTagLabel
        })}

        ${renderSecondaryBattlesSection(payload, uiState, {
          escapeHtml,
          formatGap,
          candidateTagLabel
        })}

        ${renderBattleFeedSection(battleFeed, escapeHtml)}
      </section>

      <aside class="battle-side battle-side--primary battle-lines-support-column">
        ${renderBattlePrimaryDetailSections(payload, uiState, activePrimary, {
          escapeHtml,
          candidateTagLabel
        })}

        ${renderFocusStripSection(payload, uiState, escapeHtml)}

        ${renderAddRivalUtilitySection(payload, uiState, {
          escapeHtml,
          formatGap,
          candidateTagLabel
        })}

        ${renderBattleDataStateSection(payload, escapeHtml)}
      </aside>
    </section>
  `
}

function updateHoverPreview(target: HTMLElement, payload: BattleLinesPayload, hoveredStreamerId: string | null): void {
  const nameEl = target.querySelector<HTMLElement>("[data-battle-hover-name]")
  const latestEl = target.querySelector<HTMLElement>("[data-battle-hover-latest]")
  const peakEl = target.querySelector<HTMLElement>("[data-battle-hover-peak]")
  const hintEl = target.querySelector<HTMLElement>("[data-battle-hover-hint]")

  if (!nameEl || !latestEl || !peakEl || !hintEl) return

  const hoveredLine = payload.lines.find((line) => line.streamerId === hoveredStreamerId) ?? null

  if (!hoveredLine) {
    nameEl.textContent = "None"
    latestEl.textContent = "Move over end markers"
    peakEl.textContent = "—"
    hintEl.textContent = "Hover end markers to preview. Click one to focus."
    return
  }

  nameEl.textContent = hoveredLine.name
  latestEl.textContent = numberFmt.format(hoveredLine.latestViewers)
  peakEl.textContent = numberFmt.format(hoveredLine.peakViewers)
  hintEl.textContent = "Click this marker to focus the detail panel."
}

function applyRefreshUi(
  target: HTMLElement,
  payload: BattleLinesPayload | null,
  updating: boolean,
  overrideMessage?: string
): void {
  target.classList.toggle("battle-lines-content--updating", updating)

  const stateEl = target.querySelector<HTMLElement>("[data-battle-refresh-state]")
  const noteEl = target.querySelector<HTMLElement>("[data-battle-refresh-note]")

  if (stateEl) {
    stateEl.textContent = updating
      ? "Refreshing…"
      : payload && shouldAutoRefreshBattleLines(payload.filters)
        ? "Auto-refresh on"
        : "Auto-refresh off"
    stateEl.dataset.updating = updating ? "true" : "false"
  }

  if (noteEl) {
    noteEl.textContent = overrideMessage ?? getRefreshNoteText(payload)
    noteEl.dataset.updating = updating ? "true" : "false"
  }
}

function setBattleLinesDay(form: HTMLFormElement, day: "today" | "yesterday"): void {
  const dayEl = form.querySelector<HTMLSelectElement>('select[name="day"]')
  const dateEl = form.querySelector<HTMLInputElement>('input[name="date"]')
  if (dayEl) dayEl.value = day
  if (dateEl) dateEl.value = ""
}

function resetBattleLinesControls(form: HTMLFormElement): void {
  const dayEl = form.querySelector<HTMLSelectElement>('select[name="day"]')
  const dateEl = form.querySelector<HTMLInputElement>('input[name="date"]')
  const topEl = form.querySelector<HTMLSelectElement>('select[name="top"]')
  const metricEl = form.querySelector<HTMLSelectElement>('select[name="metric"]')
  const bucketEl = form.querySelector<HTMLSelectElement>('select[name="bucket"]')

  if (dayEl) dayEl.value = "today"
  if (dateEl) dateEl.value = ""
  if (topEl) topEl.value = "5"
  if (metricEl) metricEl.value = "viewers"
  if (bucketEl) bucketEl.value = "5"
}

function initializeBattleDetailDisclosures(target: HTMLElement): void {
  const isMobile = window.matchMedia("(max-width: 768px)").matches

  target.querySelectorAll<HTMLElement>("[data-battle-disclosure]").forEach((section) => {
    const toggle = section.querySelector<HTMLButtonElement>("[data-battle-disclosure-toggle]")
    const panel = section.querySelector<HTMLElement>("[data-battle-disclosure-panel]")
    if (!toggle || !panel) return

    const setExpanded = (expanded: boolean): void => {
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false")
      panel.hidden = !expanded
      section.dataset.expanded = expanded ? "true" : "false"
    }

    setExpanded(!isMobile)
    toggle.onclick = () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true"
      setExpanded(!expanded)
    }
  })

  target.querySelectorAll<HTMLDetailsElement>("[data-battle-inline-more]").forEach((details) => {
    details.open = !isMobile
  })
}

export function renderBattleLinesPage(root: HTMLElement): void {
  const rootEl = root as RootWithCleanup
  rootEl.__battleLinesDispose?.()

  root.className = "site-shell battle-lines-page"
  root.innerHTML = `
    ${renderHeader("battle-lines")}
    ${renderHero({
      eyebrow: "RIVALRIES",
      title: "Rivalry Radar",
      subtitle: "See who is fighting for attention right now.",
      note: "Today = live hot path. Yesterday/Date = saved rollup history. Sparse Today may switch to observed-window mode.",
      actions: [
        { href: "/day-flow/", label: "Open Day Flow" },

      ]
    })}

    <section class="battle-lines-controls-wrap">
      ${renderBattleLinesControls()}
    </section>

    <div id="battle-lines-content" class="battle-lines-content"></div>

    ${renderStatusNote({
      eyebrow: "LIVE COVERAGE",
      title: "What partial means in Rivalry Radar",
      body: "Today shows the observed rivalry window, so sparse views are normal before coverage fills in.",
      items: [
        "partial = observed channels/pages only, not full Twitch coverage",
        "observed mode avoids fake full-day curves before enough buckets exist"
      ],
      tone: "info"
    })}
    ${renderFooter()}
  `

  const form = root.querySelector<HTMLFormElement>(`#${BATTLE_LINES_CONTROLS_ID}`)
  const content = root.querySelector<HTMLElement>("#battle-lines-content")
  if (!form || !content) return

  let uiState: UiState = {
    mode: "recommended",
    focusId: "",
    primaryKey: null,
    customRivals: []
  }

  let disposed = false
  let refreshTimer: number | null = null
  let currentController: AbortController | null = null
  let requestVersion = 0
  let lastPayload: BattleLinesPayload | null = null
  let viewportPreference: ChartViewportMode | null = null

  function clearRefreshTimer(): void {
    if (refreshTimer !== null) {
      window.clearTimeout(refreshTimer)
      refreshTimer = null
    }
  }

  function abortInFlight(): void {
    currentController?.abort()
    currentController = null
  }

  function scheduleAutoRefresh(payload: BattleLinesPayload): void {
    clearRefreshTimer()
    if (disposed) return
    if (!shouldAutoRefreshBattleLines(payload.filters)) return

    refreshTimer = window.setTimeout(() => {
      void runLoad({ silent: true, reason: "auto" })
    }, BATTLE_LINES_AUTO_REFRESH_MS)
  }

  async function runLoad(options: { silent?: boolean; reason?: "manual" | "auto" | "interaction" } = {}): Promise<UiState> {
    clearRefreshTimer()
    abortInFlight()

    const controller = new AbortController()
    currentController = controller
    const requestId = ++requestVersion
    const silent = options.silent ?? false

    if (!silent) {
      content.innerHTML = `<section class="card battle-state-card battle-state-card--loading"><h2>Loading battle lines…</h2><p>Fetching the latest observed rivalry window now.</p></section>`
    } else {
      applyRefreshUi(content, lastPayload, true, options.reason === "auto" ? "Refreshing the live battle snapshot…" : "Updating your current selection…")
    }

    try {
      const payload = await fetchBattleLinesPayloadFromForm(form, {
        focusOverride: uiState.focusId || undefined,
        signal: controller.signal
      })

      if (disposed || controller.signal.aborted || requestId != requestVersion) {
        return uiState
      }

      const nextState = normalizeUiState(payload, uiState)
      const observedState = resolveObservedWindowState({
        dayMode: payload.filters.day,
        bucketMinutes: payload.filters.bucketMinutes,
        buckets: payload.buckets,
        observedIndices: buildBattleObservedIndices(payload)
      })
      const effectiveViewport = payload.filters.day === "today"
        ? (viewportPreference ?? observedState.defaultMode)
        : "full-day"
      const activePrimary = resolveActivePrimary(payload, nextState)
      const viewportRange = resolveViewportRange(observedState, effectiveViewport)
      const chartPayloadBase = buildBattleChartPayload(payload, viewportRange.startIndex, viewportRange.endIndex)
      const chartPayload = observedState.isSparseToday && effectiveViewport === "observed"
        ? {
            ...chartPayloadBase,
            lines: selectSparseBattleLines(chartPayloadBase.lines, nextState, activePrimary, 4)
          }
        : chartPayloadBase
      uiState = nextState
      lastPayload = payload

      content.innerHTML = renderContentWithMode(
        payload,
        chartPayload,
        nextState,
        effectiveViewport,
        observedState.isSparseToday ? observedState.observedSinceLabel : null,
        observedState.isSparseToday
      )
      initializeBattleDetailDisclosures(content)
      applyRefreshUi(content, payload, false)
      updateHoverPreview(content, payload, null)

      const stage = content.querySelector<HTMLElement>("[data-battle-lines-stage]")
      if (stage && payload.state !== "empty" && payload.lines.length) {
        mountBattleLinesRenderer(stage, chartPayload, nextState, activePrimary, {
          onHoverChange: (streamerId) => {
            updateHoverPreview(content, payload, streamerId)
          },
          onSelect: (streamerId) => {
            uiState = {
              ...uiState,
              mode: "custom",
              focusId: streamerId
            }
            void runLoad({ silent: true, reason: "interaction" })
          }
        })
      }

      content.querySelectorAll<HTMLButtonElement>("[data-focus]").forEach((button) => {
        button.addEventListener("click", () => {
          const focus = button.dataset.focus
          if (!focus) return
          uiState = {
            ...uiState,
            mode: "custom",
            focusId: focus
          }
          void runLoad({ silent: true, reason: "interaction" })
        })
      })

      content.querySelectorAll<HTMLButtonElement>("[data-primary-battle]").forEach((button) => {
        button.addEventListener("click", () => {
          const primaryKey = button.dataset.primaryBattle
          const focusId = button.dataset.primaryFocus
          if (!primaryKey) return

          uiState = {
            ...uiState,
            mode: "custom",
            primaryKey,
            focusId: focusId || uiState.focusId
          }
          void runLoad({ silent: true, reason: "interaction" })
        })
      })

      content.querySelectorAll<HTMLButtonElement>("[data-rival-id]").forEach((button) => {
        button.addEventListener("click", () => {
          const rivalId = button.dataset.rivalId
          if (!rivalId) return

          const customRivals = uiState.customRivals.includes(rivalId)
            ? uiState.customRivals.filter((id) => id !== rivalId)
            : [...uiState.customRivals, rivalId].slice(0, 2)

          uiState = {
            ...uiState,
            mode: "custom",
            customRivals
          }
          void runLoad({ silent: true, reason: "interaction" })
        })
      })

      content.querySelectorAll<HTMLButtonElement>("[data-switch-mode='recommended']").forEach((button) => {
        button.addEventListener("click", () => {
          uiState = {
            ...uiState,
            mode: "recommended",
            primaryKey: payload.recommendation.primaryBattle?.key ?? null,
            customRivals: []
          }
          void runLoad({ silent: true, reason: "interaction" })
        })
      })

      content.querySelectorAll<HTMLButtonElement>("[data-battle-quick-day]").forEach((button) => {
        button.addEventListener("click", () => {
          const day = button.dataset.battleQuickDay
          if (day === "today" || day === "yesterday") {
            setBattleLinesDay(form, day)
            void runLoad({ silent: false, reason: "manual" })
          }
        })
      })

      content.querySelectorAll<HTMLButtonElement>("[data-battle-reset-filters='true']").forEach((button) => {
        button.addEventListener("click", () => {
          resetBattleLinesControls(form)
          void runLoad({ silent: false, reason: "manual" })
        })
      })

      content.querySelectorAll<HTMLButtonElement>("[data-battle-viewport]").forEach((button) => {
        button.addEventListener("click", () => {
          const mode = button.dataset.battleViewport
          if (mode !== "observed" && mode !== "full-day") return
          viewportPreference = mode
          void runLoad({ silent: true, reason: "interaction" })
        })
      })

      scheduleAutoRefresh(payload)
      return nextState
    } catch (error) {
      if (isBattleLinesAbortError(error)) {
        return uiState
      }

      if (!silent) {
        content.innerHTML = `<section class="card battle-state-card battle-state-card--error"><h2>Battle lines unavailable</h2><p>Could not refresh battle lines right now. Try again shortly.</p></section>`
      } else {
        applyRefreshUi(content, lastPayload, false, "Refresh failed. Keeping your previous observed view.")
      }

      return uiState
    } finally {
      if (requestId == requestVersion) {
        currentController = null
      }
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault()
    void runLoad({ silent: false, reason: "manual" })
  })

  rootEl.__battleLinesDispose = () => {
    disposed = true
    clearRefreshTimer()
    abortInFlight()
    const stage = root.querySelector<HTMLElement>("[data-battle-lines-stage]") as HTMLElement & { __battleLinesCleanup?: () => void } | null
    stage?.__battleLinesCleanup?.()
  }

  void runLoad({ silent: false, reason: "manual" })
}
