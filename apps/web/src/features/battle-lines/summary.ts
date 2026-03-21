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
  const { escapeHtml, formatGap, candidateTagLabel } = helpers

  return `
    <section class="card page-section rivalry-radar">
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

      <div class="rivalry-primary">
        <strong>Primary battle</strong>
        <h3>${activePrimary ? `${escapeHtml(activePrimary.leftName)} vs ${escapeHtml(activePrimary.rightName)}` : "No active battle candidate"}</h3>
        <p>${activePrimary ? `${escapeHtml(candidateTagLabel(activePrimary.tag))} · ${escapeHtml(activePrimary.currentGapLabel)} · ${escapeHtml(activePrimary.gapTrend)}` : "No close battle right now"}</p>
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
        <div class="reversal-strip">${renderReversalStrip(payload.recommendation.reversalStrip, escapeHtml, formatGap)}</div>
      </div>

      ${renderAddRivalSection(payload, uiState, escapeHtml)}
    </section>
  `
}

export function renderBattleSummaryStrip(payload: BattleLinesPayload, escapeHtml: EscapeHtml): string {
  return `
    <section class="summary-strip page-section">
      <div class="summary-item"><strong>Live battle</strong><span>${escapeHtml(payload.summary.liveBattleNow)}</span></div>
      <div class="summary-item"><strong>Latest reversal</strong><span>${escapeHtml(payload.summary.latestReversal)}</span></div>
      <div class="summary-item"><strong>Fastest challenger</strong><span>${escapeHtml(payload.summary.fastestChallenger)}</span></div>
      <div class="summary-item"><strong>Most heated battle</strong><span>${escapeHtml(payload.summary.mostHeatedBattle)}</span></div>
    </section>
  `
}
