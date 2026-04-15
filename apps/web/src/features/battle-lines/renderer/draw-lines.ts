import type { BattleLine } from "../../../../../../packages/shared/src/types/battle-lines"
import {
  getBattleChartX,
  getBattleChartY,
  type BattleChartScaleState
} from "./scales"

export function drawBattleLines(
  ctx: CanvasRenderingContext2D,
  scale: BattleChartScaleState,
  lines: BattleLine[],
  highlightedIds: Set<string>,
  primaryIds: Set<string>
): void {
  lines.forEach((line, index) => {
    if (!line.points.length) return

    const isHighlighted = highlightedIds.has(line.streamerId)
    const isPrimary = primaryIds.has(line.streamerId)

    const strokeWidth = isPrimary ? 5.2 : isHighlighted ? 4.2 : Math.max(2.2, 4.2 - index * 0.2)
    const strokeOpacity = isPrimary ? 1 : isHighlighted ? 0.92 : 0.28

    ctx.save()
    ctx.beginPath()

    let hasVisibleSegment = false
    let drawing = false

    line.points.forEach((value, pointIndex) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        drawing = false
        return
      }

      const x = getBattleChartX(scale, pointIndex, line.points.length)
      const y = getBattleChartY(scale, value)
      if (!drawing) {
        ctx.moveTo(x, y)
        drawing = true
      } else {
        ctx.lineTo(x, y)
      }

      hasVisibleSegment = true
    })

    if (!hasVisibleSegment) {
      ctx.restore()
      return
    }

    ctx.strokeStyle = line.color
    ctx.lineWidth = strokeWidth
    ctx.globalAlpha = strokeOpacity
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.shadowColor = line.color
    ctx.shadowBlur = isPrimary ? 16 : isHighlighted ? 10 : 0
    ctx.stroke()
    ctx.restore()
  })
}
