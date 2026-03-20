import type { BattleLine } from "../../../../../../packages/shared/src/types/battle-lines"
import {
  getBattleChartX,
  getBattleChartY,
  getBattleNowLineX,
  getBattleChartInnerHeight,
  type BattleChartScaleState
} from "./scales"

export function drawBattleNowLine(
  ctx: CanvasRenderingContext2D,
  scale: BattleChartScaleState
): void {
  const x = getBattleNowLineX(scale)
  const top = scale.paddingTop
  const bottom = scale.paddingTop + getBattleChartInnerHeight(scale)

  ctx.save()
  ctx.strokeStyle = "rgba(131, 240, 183, 0.95)"
  ctx.lineWidth = 2
  ctx.setLineDash([6, 6])
  ctx.shadowColor = "rgba(131, 240, 183, 0.35)"
  ctx.shadowBlur = 10

  ctx.beginPath()
  ctx.moveTo(x, top)
  ctx.lineTo(x, bottom)
  ctx.stroke()

  ctx.restore()
}

export function drawBattleEndMarkers(
  ctx: CanvasRenderingContext2D,
  scale: BattleChartScaleState,
  lines: BattleLine[],
  highlightedIds: Set<string>,
  primaryIds: Set<string>
): void {
  lines.slice(0, 5).forEach((line) => {
    if (!line.points.length) return

    const pointIndex = line.points.length - 1
    const x = getBattleChartX(scale, pointIndex, line.points.length)
    const y = getBattleChartY(scale, line.points[pointIndex] ?? 0)
    const isHighlighted = highlightedIds.has(line.streamerId)
    const isPrimary = primaryIds.has(line.streamerId)
    const radius = isPrimary ? 4.5 : isHighlighted ? 3.5 : 2.75

    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = line.color
    ctx.globalAlpha = isPrimary ? 1 : isHighlighted ? 0.92 : 0.45
    ctx.shadowColor = line.color
    ctx.shadowBlur = isPrimary ? 12 : isHighlighted ? 8 : 0
    ctx.fill()
    ctx.restore()
  })
}
