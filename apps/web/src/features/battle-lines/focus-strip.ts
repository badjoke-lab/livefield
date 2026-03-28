import type { BattleLinesPayload } from "../../../../../packages/shared/src/types/battle-lines"
import type { UiState } from "./state"

type EscapeHtml = (value: string) => string

export function renderAddRivalSection(
  payload: BattleLinesPayload,
  uiState: UiState,
  escapeHtml: EscapeHtml
): string {
  return `
    <div class="rivalry-secondary rivalry-secondary--add-rival">
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
  `
}

export function renderFocusStripSection(
  payload: BattleLinesPayload,
  uiState: UiState,
  escapeHtml: EscapeHtml
): string {
  return `
    <section class="battle-focus-strip-card battle-utility-item">
      <h3>Focus strip</h3>
      <div class="focus-chip-row">
        ${payload.focusStrip
          .map((item) => {
            const active = item.streamerId === uiState.focusId
            return `<button type="button" class="focus-chip ${active ? "focus-chip--active" : ""}" data-focus="${escapeHtml(item.streamerId)}">${escapeHtml(item.name)}</button>`
          })
          .join("")}
      </div>
    </section>
  `
}
