export const BATTLE_LINES_CONTROLS_ID = "battle-lines-controls"

export function renderBattleLinesControls(): string {
  return `
    <form class="controls controls--battle-lines battle-lines-controls" id="${BATTLE_LINES_CONTROLS_ID}">
      <select name="day" aria-label="Day" class="battle-control battle-lines-control battle-lines-control--today" data-role="primary-filter">
        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="date">Date</option>
      </select>

      <input type="date" name="date" aria-label="Date picker" class="battle-control battle-lines-control battle-lines-control--date" data-role="primary-filter" />

      <select name="top" aria-label="Top N" class="battle-control battle-lines-control battle-lines-control--top" data-role="primary-filter">
        <option value="3">Top 3</option>
        <option value="5" selected>Top 5</option>
        <option value="10">Top 10</option>
      </select>

      <select name="metric" aria-label="Metric" class="battle-control battle-lines-control battle-lines-control--metric" data-role="secondary-filter">
        <option value="viewers" selected>Viewers</option>
        <option value="indexed">Indexed</option>
      </select>

      <select name="bucket" aria-label="Bucket size" class="battle-control battle-lines-control battle-lines-control--bucket" data-role="secondary-filter">
        <option value="1">1m</option>
        <option value="5" selected>5m</option>
        <option value="10">10m</option>
      </select>

      <button type="submit" class="action battle-control battle-lines-control battle-lines-control--refresh" data-role="action">Refresh</button>
    </form>
  `
}
