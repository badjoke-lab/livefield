import type {
  BattleLine,
  BattleLinesRecommendation
} from "../../../../../../packages/shared/src/types/battle-lines"
import {
  getBattleChartX,
  getBattleChartY,
  getBattleNowLineX,
  getBattleChartInnerHeight,
  type BattleChartScaleState
} from "./scales"
import type { BattleLinesInteractionTarget } from "./interaction"

function getLatestReversalIds(recommendation: BattleLinesRecommendation): Set<string> {
  const ids = new Set<string>()
  const latest = recommendation.reversalStrip[0]
  if (!latest) return ids

  ids.add(latest.passer)
  ids.add(latest.passed)
  return ids
}

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
  primaryIds: Set<string>,
  selectedStreamerId: string | null,
  hoveredStreamerId: string | null,
  recommendation: BattleLinesRecommendation
): BattleLinesInteractionTarget[] {
  const targets: BattleLinesInteractionTarget[] = []
  const latestReversalIds = getLatestReversalIds(recommendation)

  lines.slice(0, 5).forEach((line) => {
    if (!line.points.length) return

    const pointIndex = line.points.length - 1
    const x = getBattleChartX(scale, pointIndex, line.points.length)
    const y = getBattleChartY(scale, line.points[pointIndex] ?? 0)

    const isHighlighted = highlightedIds.has(line.streamerId)
    const isPrimary = primaryIds.has(line.streamerId)
    const isSelected = selectedStreamerId === line.streamerId
    const isHovered = hoveredStreamerId === line.streamerId
    const isLatestReversal = latestReversalIds.has(line.name)

    const radius = isHovered
      ? 6.4
      : isSelected
        ? 5.4
        : isLatestReversal
          ? 4.9
          : isPrimary
            ? 4.5
            : isHighlighted
              ? 3.5
              : 2.75

    const alpha = isHovered ? 1 : isSelected ? 1 : isPrimary ? 1 : isHighlighted ? 0.92 : 0.45

    ctx.save()

    if (isLatestReversal) {
      ctx.beginPath()
      ctx.arc(x, y, radius + 6.5, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(255, 211, 107, 0.12)"
      ctx.fill()
    }

    ctx.beginPath()
    ctx.arc(x, y, radius + (isHovered ? 5 : isSelected ? 4 : isLatestReversal ? 3 : 0), 0, Math.PI * 2)
    ctx.fillStyle = isHovered
      ? "rgba(255, 255, 255, 0.16)"
      : isSelected
        ? "rgba(255, 255, 255, 0.12)"
        : isLatestReversal
          ? "rgba(255, 211, 107, 0.14)"
          : "rgba(255, 255, 255, 0.0)"
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = line.color
    ctx.globalAlpha = alpha
    ctx.shadowColor = isLatestReversal ? "rgba(255, 211, 107, 0.85)" : line.color
    ctx.shadowBlur = isHovered ? 18 : isSelected ? 14 : isLatestReversal ? 14 : isPrimary ? 12 : isHighlighted ? 8 : 0
    ctx.fill()

    if (isHovered || isSelected || isLatestReversal) {
      ctx.beginPath()
      ctx.arc(x, y, radius + 2.5, 0, Math.PI * 2)
      ctx.strokeStyle = isLatestReversal ? "rgba(255, 211, 107, 0.88)" : "rgba(255,255,255,0.66)"
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.95
      ctx.shadowBlur = 0
      ctx.stroke()
    }

    ctx.restore()

    targets.push({
      streamerId: line.streamerId,
      x,
      y,
      radius: Math.max(radius + 4, 10)
    })
  })

  return targets
}
