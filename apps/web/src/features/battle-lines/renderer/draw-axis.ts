import {
  getBattleChartInnerHeight,
  getBattleChartInnerWidth,
  type BattleChartScaleState
} from "./scales"

export function drawBattleAxis(
  ctx: CanvasRenderingContext2D,
  scale: BattleChartScaleState
): void {
  const left = scale.paddingLeft
  const top = scale.paddingTop
  const width = getBattleChartInnerWidth(scale)
  const height = getBattleChartInnerHeight(scale)

  ctx.save()

  ctx.strokeStyle = "rgba(122, 162, 255, 0.08)"
  ctx.lineWidth = 1

  for (let i = 0; i <= 4; i += 1) {
    const y = top + (height * i) / 4
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(left + width, y)
    ctx.stroke()
  }

  for (let i = 0; i <= 4; i += 1) {
    const x = left + (width * i) / 4
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, top + height)
    ctx.stroke()
  }

  ctx.strokeStyle = "rgba(122, 162, 255, 0.14)"
  ctx.lineWidth = 1
  ctx.strokeRect(left, top, width, height)

  ctx.restore()
}
