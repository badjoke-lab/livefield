import type {
  BattleCandidate,
  BattleLinesPayload
} from "../../../../../packages/shared/src/types/battle-lines"
import type { UiState } from "./state"

type EscapeHtml = (value: string) => string
type CandidateTagLabel = (tag: BattleCandidate["tag"]) => string

type DetailHelpers = {
  escapeHtml: EscapeHtml
  candidateTagLabel: CandidateTagLabel
}

const numberFmt = new Intl.NumberFormat("en-US")

function findHoveredLine(payload: BattleLinesPayload): BattleLinesPayload["lines"][number] | null {
  const latest = payload.recommendation.reversalStrip[0]
  if (!latest) return null
  return payload.lines.find((line) => line.name === latest.passer || line.name === latest.passed) ?? null
}

function emptyReasonText(payload: BattleLinesPayload): string {
  if (payload.filters.day === "today") {
    return "There is no comparable live rivalry set yet for the current window."
  }
  if (payload.filters.day === "yesterday") {
    return "Yesterday does not have enough stored rivalry data for the current controls."
  }
  return "This date does not currently have enough stored rivalry data for the selected controls."
}

export function renderBattleDetailSections(
  payload: BattleLinesPayload,
  uiState: UiState,
  activePrimary: BattleCandidate | null,
  battleFeed: string[],
  helpers: DetailHelpers
): string {
  const { escapeHtml, candidateTagLabel } = helpers

  const focusLine = payload.lines.find((line) => line.streamerId === uiState.focusId) ?? payload.lines[0] ?? null
  const currentRivalId =
    uiState.customRivals[0] ??
    (activePrimary ? (activePrimary.leftId === uiState.focusId ? activePrimary.rightId : activePrimary.leftId) : "")

  const rivalLine = payload.lines.find((line) => line.streamerId === currentRivalId) ?? null
  const latestReversal = payload.recommendation.reversalStrip[0] ?? null
  const hoverFallback = findHoveredLine(payload)

  return `
    <div class="battle-detail-sections">
      <section class="card battle-detail-card">
        <h2>Selected stream</h2>
        <div class="kv">
          <div class="kv-row"><span>Stream</span><strong>${escapeHtml(focusLine?.name ?? payload.focusDetail.name)}</strong></div>
          <div class="kv-row"><span>Peak viewers</span><strong>${numberFmt.format(focusLine?.peakViewers ?? payload.focusDetail.peakViewers)}</strong></div>
          <div class="kv-row"><span>Latest viewers</span><strong>${numberFmt.format(focusLine?.latestViewers ?? payload.focusDetail.latestViewers)}</strong></div>
          <div class="kv-row"><span>Biggest rise</span><strong>${escapeHtml(payload.focusDetail.biggestRiseTime)}</strong></div>
          <div class="kv-row"><span>Reversals</span><strong>${numberFmt.format(focusLine?.reversalCount ?? payload.focusDetail.reversalCount)}</strong></div>
          <div class="kv-row"><span>Hovered stream</span><strong data-battle-hover-name>${escapeHtml(hoverFallback?.name ?? "None")}</strong></div>
          <div class="kv-row"><span>Hovered latest viewers</span><strong data-battle-hover-latest>${hoverFallback ? numberFmt.format(hoverFallback.latestViewers) : "Move over end markers"}</strong></div>
          <div class="kv-row"><span>Hovered peak viewers</span><strong data-battle-hover-peak>${hoverFallback ? numberFmt.format(hoverFallback.peakViewers) : "—"}</strong></div>
          <div class="kv-row kv-row--feature"><span>Interaction</span><small data-battle-hover-hint>Hover end markers to preview. Click one to focus.</small></div>
        </div>
      </section>

      <section class="card battle-detail-card">
        <h2>Current matchup</h2>
        <div class="kv">
          <div class="kv-row"><span>Pair</span><strong>${activePrimary ? `${escapeHtml(activePrimary.leftName)} vs ${escapeHtml(activePrimary.rightName)}` : "N/A"}</strong></div>
          <div class="kv-row"><span>Gap now</span><strong>${activePrimary ? escapeHtml(activePrimary.currentGapLabel) : "N/A"}</strong></div>
          <div class="kv-row"><span>Gap trend</span><strong>${activePrimary ? escapeHtml(activePrimary.gapTrend) : "N/A"}</strong></div>
          <div class="kv-row"><span>Match tag</span><strong>${activePrimary ? escapeHtml(candidateTagLabel(activePrimary.tag)) : "N/A"}</strong></div>
          <div class="kv-row"><span>Compared rival</span><strong>${escapeHtml(rivalLine?.name ?? "N/A")}</strong></div>
          <div class="kv-row"><span>Latest viewers</span><strong>${focusLine && rivalLine ? `${numberFmt.format(focusLine.latestViewers)} vs ${numberFmt.format(rivalLine.latestViewers)}` : "N/A"}</strong></div>
          <div class="kv-row"><span>Peak viewers</span><strong>${focusLine && rivalLine ? `${numberFmt.format(focusLine.peakViewers)} vs ${numberFmt.format(rivalLine.peakViewers)}` : "N/A"}</strong></div>
        </div>
      </section>

      <section class="card battle-detail-card battle-detail-card--feed">
        <h2>Battle feed</h2>
        <div class="kv battle-feed-list">
          ${battleFeed.map((line) => `<div class="kv-row"><span>Feed</span><strong>${escapeHtml(line)}</strong></div>`).join("")}
        </div>
      </section>

      <section class="card battle-detail-card battle-detail-card--reversal">
        <h2>Latest reversal</h2>
        <div class="kv">
          <div class="kv-row"><span>Event</span><strong>${latestReversal ? escapeHtml(latestReversal.label) : "No recent reversal"}</strong></div>
          <div class="kv-row"><span>Passer</span><strong>${latestReversal ? escapeHtml(latestReversal.passer) : "N/A"}</strong></div>
          <div class="kv-row"><span>Passed</span><strong>${latestReversal ? escapeHtml(latestReversal.passed) : "N/A"}</strong></div>
          <div class="kv-row"><span>Gap change</span><strong>${latestReversal ? `${numberFmt.format(latestReversal.gapBefore)} → ${numberFmt.format(latestReversal.gapAfter)}` : "N/A"}</strong></div>
        </div>
      </section>

      <section class="card battle-detail-card">
        <h2>Data state</h2>
        <div class="kv">
          <div class="kv-row"><span>Source</span><strong>${payload.source}</strong></div>
          <div class="kv-row"><span>Status</span><strong>${payload.state}</strong></div>
          <div class="kv-row"><span>Top</span><strong>${payload.filters.top}</strong></div>
          <div class="kv-row"><span>Updated at</span><strong>${escapeHtml(payload.updatedAt.slice(11, 19))} UTC</strong></div>
        </div>
      </section>
    </div>
  `
}

export function renderBattleEmptyDetailSection(payload: BattleLinesPayload, escapeHtml: EscapeHtml): string {
  return `
    <section class="battle-empty-layout page-section">
      <section class="card battle-empty-card battle-empty-card--main">
        <h2>No battle lines for this selection</h2>
        <p>${escapeHtml(emptyReasonText(payload))}</p>
        <div class="battle-empty-actions">
          <button type="button" class="focus-chip" data-battle-quick-day="today">Try Today</button>
          <button type="button" class="focus-chip" data-battle-quick-day="yesterday">Try Yesterday</button>
          <button type="button" class="focus-chip" data-battle-reset-filters="true">Reset controls</button>
        </div>
      </section>

      <section class="card battle-empty-card">
        <h2>What to try next</h2>
        <div class="battle-empty-list">
          <p>Switch the day above and refresh.</p>
          <p>Use broader defaults like Top 5, Viewers, and 5m.</p>
          <p>Check again later if today has not filled in yet.</p>
        </div>
      </section>

      <section class="card battle-empty-card">
        <h2>Current state</h2>
        <div class="kv">
          <div class="kv-row"><span>Source</span><strong>${payload.source}</strong></div>
          <div class="kv-row"><span>Status</span><strong>${payload.state}</strong></div>
          <div class="kv-row"><span>Top</span><strong>${payload.filters.top}</strong></div>
          <div class="kv-row"><span>Metric</span><strong>${payload.filters.metric}</strong></div>
          <div class="kv-row"><span>Bucket</span><strong>${payload.filters.bucketMinutes}m</strong></div>
          <div class="kv-row"><span>Updated at</span><strong>${escapeHtml(payload.updatedAt.slice(11, 19))} UTC</strong></div>
        </div>
      </section>
    </section>
  `
}
