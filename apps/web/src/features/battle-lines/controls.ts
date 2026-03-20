export const BATTLE_LINES_CONTROLS_ID = "battle-lines-controls"

export function renderBattleLinesControls(): string {
  return `
    <form class="controls" id="${BATTLE_LINES_CONTROLS_ID}">
      <select name="day" aria-label="Day">
        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="date">Date</option>
      </select>
      <input type="date" name="date" aria-label="Date picker" />
      <select name="top" aria-label="Top N">
        <option value="3">Top 3</option>
        <option value="5" selected>Top 5</option>
        <option value="10">Top 10</option>
      </select>
      <select name="metric" aria-label="Metric">
        <option value="viewers" selected>Viewers</option>
        <option value="indexed">Indexed</option>
      </select>
      <select name="bucket" aria-label="Bucket size">
        <option value="1">1m</option>
        <option value="5" selected>5m</option>
        <option value="10">10m</option>
      </select>
      <button type="submit">Refresh</button>
    </form>
  `
}
