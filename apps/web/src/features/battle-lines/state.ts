import type {
  BattleCandidate,
  BattleLinesPayload
} from "../../../../../packages/shared/src/types/battle-lines"

export type UiMode = "recommended" | "custom"

export type UiState = {
  mode: UiMode
  focusId: string
  primaryKey: string | null
  customRivals: string[]
}

const numberFmt = new Intl.NumberFormat("en-US")

function formatGap(value: number): string {
  return `${numberFmt.format(Math.max(0, Math.round(value)))} gap`
}

export function normalizeUiState(payload: BattleLinesPayload, uiState: UiState): UiState {
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

export function resolveActivePrimary(payload: BattleLinesPayload, uiState: UiState): BattleCandidate | null {
  return (
    [payload.recommendation.primaryBattle, ...payload.recommendation.secondaryBattles]
      .filter((item): item is BattleCandidate => item !== null)
      .find((item) => item.key === uiState.primaryKey) ??
    payload.recommendation.primaryBattle ??
    null
  )
}

export function buildHighlightedIds(
  payload: BattleLinesPayload,
  uiState: UiState,
  activePrimary: BattleCandidate | null
): Set<string> {
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

export function buildBattleFeed(payload: BattleLinesPayload, activePrimary: BattleCandidate | null): string[] {
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
