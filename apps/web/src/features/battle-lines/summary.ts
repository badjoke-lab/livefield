import type {
  BattleCandidate,
  BattleLinesPayload,
  BattleReversalStripItem
} from "../../../../../packages/shared/src/types/battle-lines"
import type { UiState } from "./state"
import { renderAddRivalSection } from "./focus-strip"

type EscapeHtml = (value: string) => string
type FormatGap = (value: number) => string
type CandidateTagLabel = (tag: BattleCandidate["tag"]) => string

type SummaryHelpers = {
  escapeHtml: EscapeHtml
  formatGap: FormatGap
  candidateTagLabel: CandidateTagLabel
}

function formatDayLabel(payload: BattleLinesPayload): string {
  if (payload.filters.day === "today") return "Today"
  if (payload.filters.day === "yesterday") return "Yesterday"
  return payload.filters.date || "Custom date"
}

export function renderReversalStrip(
  items: BattleReversalStripItem[],
  escapeHtml: EscapeHtml,
  formatGap: FormatGap
): string {
  if (!items.length) return "<span>No reversals recorded yet</span>"

  return items
    .map(
      (item) =>
        `<span title="${escapeHtml(`${item.passer} passed ${item.passed} · ${formatGap(item.gapBefore)} → ${formatGap(item.gapAfter)}`)}">${escapeHtml(item.label)} · ${escapeHtml(item.timestamp.slice(11, 16))}</span>`
    )
    .join("")
}

export function renderRivalryRadarSection(
  payload: BattleLinesPayload,
  uiState: UiState,
  activePrimary: BattleCandidate | null,
  helpers: SummaryHelpers
): string {
  const { escapeHtml } = helpers

  return `
    <section class="card rivalry-radar rivalry-radar--primary">
      <div class="rivalry-radar__head">
        <div>
          <h2>Rivalry radar</h2>
          <p>Start with the recommended battle, then switch into custom focus when you want to track your own pair.</p>
        </div>
        <div class="battle-mock-modes">
          <span class="pill">${uiState.mode === "recommended" ? "Recommended view" : "Custom view"}</span>
          <button type="button" class="focus-chip" data-switch-mode="recommended">Back to recommended</button>
        </div>
      </div>

      ${renderPrimaryBattleSummary(payload, activePrimary, helpers)}
    </section>
  `
}

export function renderPrimaryBattleSummary(
  payload: BattleLinesPayload,
  activePrimary: BattleCandidate | null,
  helpers: SummaryHelpers
): string {
  const { escapeHtml, candidateTagLabel } = helpers

  return `
    <div class="rivalry-primary">
      <strong>Primary battle</strong>
      <h3>${activePrimary ? `${escapeHtml(activePrimary.leftName)} vs ${escapeHtml(activePrimary.rightName)}` : "No active battle candidate"}</h3>
      <p>${activePrimary ? `${escapeHtml(candidateTagLabel(activePrimary.tag))} · ${escapeHtml(activePrimary.currentGapLabel)} · ${escapeHtml(activePrimary.gapTrend)}` : "No close battle right now"}</p>
      <p>Latest reversal: ${escapeHtml(payload.recommendation.latestReversal)}</p>
      <p>Fastest challenger: ${escapeHtml(payload.recommendation.fastestChallenger)}</p>
    </div>
  `
}

export function renderSecondaryBattlesSection(
  payload: BattleLinesPayload,
  uiState: UiState,
  helpers: SummaryHelpers
): string {
  const { escapeHtml, candidateTagLabel } = helpers
  const secondaryBattles = payload.recommendation.secondaryBattles
  const visibleBattles = secondaryBattles.slice(0, 2)
  const overflowBattles = secondaryBattles.slice(2)

  const renderBattleChip = (item: BattleCandidate): string =>
    `<button type="button" class="focus-chip ${uiState.primaryKey === item.key ? "focus-chip--active" : ""}" data-primary-battle="${escapeHtml(item.key)}" data-primary-focus="${escapeHtml(item.leftId)}">${escapeHtml(item.leftName)} vs ${escapeHtml(item.rightName)} · ${escapeHtml(candidateTagLabel(item.tag))}</button>`

  return `
    <section class="rivalry-secondary rivalry-secondary--battles battle-utility-item">
      <strong>Secondary battles</strong>
      <div class="focus-chip-row">
        ${visibleBattles.map((item) => renderBattleChip(item)).join("") || `<span class="muted">No secondary battles right now.</span>`}
      </div>
      ${overflowBattles.length
        ? `<details class="battle-inline-more" data-battle-inline-more>
            <summary>More battles (${overflowBattles.length})</summary>
            <div class="focus-chip-row">${overflowBattles.map((item) => renderBattleChip(item)).join("")}</div>
          </details>`
        : ""}
    </section>
  `
}

export function renderReversalStripSection(payload: BattleLinesPayload, helpers: SummaryHelpers): string {
  const { escapeHtml, formatGap } = helpers
  const visibleReversals = payload.recommendation.reversalStrip.slice(0, 3)
  const overflowReversals = payload.recommendation.reversalStrip.slice(3)

  return `
    <section class="rivalry-secondary rivalry-secondary--strip battle-utility-item">
      <strong>Reversal strip</strong>
      <div class="reversal-strip">${renderReversalStrip(visibleReversals, escapeHtml, formatGap)}</div>
      ${overflowReversals.length
        ? `<details class="battle-inline-more battle-inline-more--reversal" data-battle-inline-more>
            <summary>More reversals (${overflowReversals.length})</summary>
            <div class="reversal-strip">${renderReversalStrip(overflowReversals, escapeHtml, formatGap)}</div>
          </details>`
        : ""}
    </section>
  `
}

export function renderAddRivalUtilitySection(
  payload: BattleLinesPayload,
  uiState: UiState,
  helpers: SummaryHelpers
): string {
  return `<section class="rivalry-secondary rivalry-secondary--add-rival battle-utility-item">${renderAddRivalSection(payload, uiState, helpers.escapeHtml)}</section>`
}

export function renderBattleSummaryStrip(payload: BattleLinesPayload, escapeHtml: EscapeHtml): string {
  return `
    <section class="summary-strip page-section summary-strip--battle-lines">
      <div class="summary-item"><strong>Live battle</strong><span>${escapeHtml(payload.summary.liveBattleNow)}</span></div>
      <div class="summary-item"><strong>Latest reversal</strong><span>${escapeHtml(payload.summary.latestReversal)}</span></div>
      <div class="summary-item"><strong>Fastest challenger</strong><span>${escapeHtml(payload.summary.fastestChallenger)}</span></div>
      <div class="summary-item"><strong>Most heated battle</strong><span>${escapeHtml(payload.summary.mostHeatedBattle)}</span></div>
    </section>
  `
}

export function renderBattleEmptySummaryStrip(payload: BattleLinesPayload, escapeHtml: EscapeHtml): string {
  return `
    <section class="summary-strip page-section summary-strip--battle-empty">
      <div class="summary-item"><strong>Status</strong><span>${escapeHtml(payload.state)}</span></div>
      <div class="summary-item"><strong>Current selection</strong><span>${escapeHtml(formatDayLabel(payload))}</span></div>
      <div class="summary-item"><strong>Updated</strong><span>${escapeHtml(payload.updatedAt.slice(11, 19))} UTC</span></div>
      <div class="summary-item"><strong>Next step</strong><span>Try Today, Yesterday, or reset the controls.</span></div>
    </section>
  `
}
