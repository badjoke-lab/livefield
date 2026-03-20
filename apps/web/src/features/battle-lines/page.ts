import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"
import { fetchBattleLinesPayloadFromForm } from "../../shared/api/battle-lines-api"
import type {
  BattleCandidate,
  BattleLinesPayload
} from "../../../../../packages/shared/src/types/battle-lines"
import { BATTLE_LINES_CONTROLS_ID, renderBattleLinesControls } from "./controls"
import { renderBattleDetailSections } from "./detail-panel"
import { renderFocusStripSection } from "./focus-strip"
import {
  buildBattleFeed,
  buildHighlightedIds,
  normalizeUiState,
  resolveActivePrimary,
  type UiState
} from "./state"
import {
  renderBattleSummaryStrip,
  renderRivalryRadarSection
} from "./summary"
import { mountBattleLinesRenderer } from "./renderer"

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

      <div class="battle-mock-stage" data-battle-lines-stage data-hover-active="false">
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

function renderContentWithMode(payload: BattleLinesPayload, uiState: UiState): string {
  const activePrimary = resolveActivePrimary(payload, uiState)
  const battleFeed = buildBattleFeed(payload, activePrimary)

  return `
    ${renderRivalryRadarSection(payload, uiState, activePrimary, {
      escapeHtml,
      formatGap,
      candidateTagLabel
    })}

    ${renderBattleSummaryStrip(payload, escapeHtml)}

    <section class="grid-2 page-section">
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
  const hintEl = target.querySelector<HTMLElement>("[data-battle-hover-hint]")

  if (!nameEl || !latestEl || !hintEl) return

  const hoveredLine = payload.lines.find((line) => line.streamerId === hoveredStreamerId) ?? null

  if (!hoveredLine) {
    nameEl.textContent = "None"
    latestEl.textContent = "Move over end markers"
    hintEl.textContent = "Hover end markers to preview. Click one to focus."
    return
  }

  nameEl.textContent = hoveredLine.name
  latestEl.textContent = numberFmt.format(hoveredLine.latestViewers)
  hintEl.textContent = "Click this marker to focus the detail panel."
}

async function loadPayload(form: HTMLFormElement, target: HTMLElement, uiState: UiState): Promise<UiState> {
  target.innerHTML = `<section class="card"><h2>Loading Battle Lines…</h2></section>`

  try {
    const payload = await fetchBattleLinesPayloadFromForm(form, {
      focusOverride: uiState.focusId || undefined
    })

    const nextState = normalizeUiState(payload, uiState)
    target.innerHTML = renderContentWithMode(payload, nextState)
    updateHoverPreview(target, payload, null)

    const activePrimary = resolveActivePrimary(payload, nextState)
    const stage = target.querySelector<HTMLElement>("[data-battle-lines-stage]")
    if (stage) {
      mountBattleLinesRenderer(stage, payload, nextState, activePrimary, {
        onHoverChange: (streamerId) => {
          updateHoverPreview(target, payload, streamerId)
        },
        onSelect: (streamerId) => {
          void loadPayload(form, target, {
            ...nextState,
            mode: "custom",
            focusId: streamerId
          })
        }
      })
    }

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

    ${renderBattleLinesControls()}

    <div id="battle-lines-content"></div>

    ${renderStatusNote("Rivalry Radar uses API-provided primary and secondary battles, with custom state layered on top.")}
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
