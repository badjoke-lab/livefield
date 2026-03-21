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
  renderBattleDetailSections,
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
  renderBattleEmptySummaryStrip,
  renderBattleSummaryStrip,
  renderRivalryRadarSection
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
  if (!payload) return "Loading live battle lines…"
  if (shouldAutoRefreshBattleLines(payload.filters)) {
    return `Live refresh runs every ${Math.round(BATTLE_LINES_AUTO_REFRESH_MS / 1000)}s on Today.`
  }
  return "Live refresh is available on Today."
}

function renderChart(payload: BattleLinesPayload, uiState: UiState, activePrimary: BattleCandidate | null): string {
  if (!payload.lines.length) {
    return `
      <section class="battle-mock-card battle-mock-card--battle-lines battle-state-card battle-state-card--empty">
        <div class="battle-mock-card__head">
          <div>
            <strong>Battle lines</strong>
            <p>No battle lines are available for this selection yet.</p>
          </div>
        </div>
      </section>
    `
  }

  const nowBucketIndex = Math.max(0, payload.buckets.length - 1)
  const nowRatio = payload.buckets.length > 1 ? nowBucketIndex / (payload.buckets.length - 1) : 0
  const nowLeft = 4 + nowRatio * 92
  const highlightedIds = buildHighlightedIds(payload, uiState, activePrimary)

  return `
    <section class="battle-mock-card battle-mock-card--battle-lines">
      <div class="battle-mock-card__head">
        <div>
          <strong>Battle lines</strong>
          <p>Start with the recommended battle, then keep your own focus when you want to track a specific pair.</p>
          <div class="battle-live-row">
            <span class="pill pill--quiet" data-battle-refresh-state>${shouldAutoRefreshBattleLines(payload.filters) ? "Live refresh on" : "Live refresh off"}</span>
            <span class="battle-live-note" data-battle-refresh-note>${escapeHtml(getRefreshNoteText(payload))}</span>
          </div>
        </div>
        <div class="battle-mock-modes">
          <span class="pill">${payload.filters.metric === "indexed" ? "Indexed" : "Viewers"}</span>
          <span class="pill">${payload.filters.bucketMinutes}m</span>
          <span class="pill">${payload.state}</span>
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

function renderEmptyRecoveryLayout(payload: BattleLinesPayload): string {
  return `
    ${renderBattleEmptySummaryStrip(payload, escapeHtml)}
    ${renderBattleEmptyDetailSection(payload, escapeHtml)}
  `
}

function renderContentWithMode(payload: BattleLinesPayload, uiState: UiState): string {
  if (payload.state === "empty" || !payload.lines.length) {
    return renderEmptyRecoveryLayout(payload)
  }

  const activePrimary = resolveActivePrimary(payload, uiState)
  const battleFeed = buildBattleFeed(payload, activePrimary)

  return `
    ${renderRivalryRadarSection(payload, uiState, activePrimary, {
      escapeHtml,
      formatGap,
      candidateTagLabel
    })}

    ${renderBattleSummaryStrip(payload, escapeHtml)}

    <section class="grid-2 page-section battle-lines-layout">
      ${renderChart(payload, uiState, activePrimary)}
      <section class="battle-side">
        ${renderFocusStripSection(payload, uiState, escapeHtml)}
        ${renderBattleDetailSections(payload, uiState, activePrimary, battleFeed, {
          escapeHtml,
          candidateTagLabel
        })}
      </section>
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
        ? "Live refresh on"
        : "Live refresh off"
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
      note: "Today/Yesterday/Date, Top 3/5/10, Viewers/Indexed, 1m/5m/10m, recommended battle, custom focus, and reversal strip.",
      actions: [
        { href: "/day-flow/", label: "Open Day Flow" },
        { href: "/method/", label: "Open Method" }
      ]
    })}

    ${renderBattleLinesControls()}

    <div id="battle-lines-content" class="battle-lines-content"></div>

    ${renderStatusNote("Rivalry Radar combines API battle recommendations with your current custom focus.")}
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
      content.innerHTML = `<section class="card battle-state-card battle-state-card--loading"><h2>Loading battle lines…</h2><p>Pulling the latest rivalry state now.</p></section>`
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
      uiState = nextState
      lastPayload = payload

      content.innerHTML = renderContentWithMode(payload, nextState)
      applyRefreshUi(content, payload, false)
      updateHoverPreview(content, payload, null)

      const activePrimary = resolveActivePrimary(payload, nextState)
      const stage = content.querySelector<HTMLElement>("[data-battle-lines-stage]")
      if (stage && payload.state !== "empty" && payload.lines.length) {
        mountBattleLinesRenderer(stage, payload, nextState, activePrimary, {
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

      scheduleAutoRefresh(payload)
      return nextState
    } catch (error) {
      if (isBattleLinesAbortError(error)) {
        return uiState
      }

      if (!silent) {
        content.innerHTML = `<section class="card battle-state-card battle-state-card--error"><h2>Battle lines unavailable</h2><p>Could not refresh battle lines right now. Try again shortly.</p></section>`
      } else {
        applyRefreshUi(content, lastPayload, false, "Refresh failed. Keeping your previous live view.")
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
