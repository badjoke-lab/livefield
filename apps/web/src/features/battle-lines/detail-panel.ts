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

  return `
    <section class="card">
      <h2>Selected details</h2>
      <div class="kv">
        <div class="kv-row"><span>Streamer</span><strong>${escapeHtml(focusLine?.name ?? payload.focusDetail.name)}</strong></div>
        <div class="kv-row"><span>Peak viewers</span><strong>${numberFmt.format(focusLine?.peakViewers ?? payload.focusDetail.peakViewers)}</strong></div>
        <div class="kv-row"><span>Latest viewers</span><strong>${numberFmt.format(focusLine?.latestViewers ?? payload.focusDetail.latestViewers)}</strong></div>
        <div class="kv-row"><span>Biggest rise</span><strong>${escapeHtml(payload.focusDetail.biggestRiseTime)}</strong></div>
        <div class="kv-row"><span>Reversal count</span><strong>${numberFmt.format(focusLine?.reversalCount ?? payload.focusDetail.reversalCount)}</strong></div>
        <div class="kv-row"><span>Hover preview</span><strong data-battle-hover-name>None</strong></div>
        <div class="kv-row"><span>Hover latest viewers</span><strong data-battle-hover-latest>Move over end markers</strong></div>
        <div class="kv-row kv-row--feature"><span>Interaction</span><small data-battle-hover-hint>Hover end markers to preview. Click one to focus.</small></div>
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
  `
}
