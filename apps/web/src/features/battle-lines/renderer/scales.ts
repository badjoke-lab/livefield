export type BattleChartScaleState = {
  width: number
  height: number
  paddingLeft: number
  paddingRight: number
  paddingTop: number
  paddingBottom: number
  pointCount: number
  bucketCount: number
  min: number
  max: number
  range: number
}

const DEFAULT_PADDING_LEFT = 56
const DEFAULT_PADDING_RIGHT = 16
const DEFAULT_PADDING_TOP = 24
const DEFAULT_PADDING_BOTTOM = 52

export function createBattleChartScaleState(args: {
  width: number
  height: number
  lines: number[][]
  pointCount: number
  bucketCount: number
}): BattleChartScaleState {
  const flattened = args.lines.flat()
  const max = Math.max(...flattened, 1)
  const min = Math.min(...flattened, 0)
  const range = Math.max(max - min, 1)

  return {
    width: Math.max(1, args.width),
    height: Math.max(1, args.height),
    paddingLeft: DEFAULT_PADDING_LEFT,
    paddingRight: DEFAULT_PADDING_RIGHT,
    paddingTop: DEFAULT_PADDING_TOP,
    paddingBottom: DEFAULT_PADDING_BOTTOM,
    pointCount: Math.max(1, args.pointCount),
    bucketCount: Math.max(1, args.bucketCount),
    min,
    max,
    range
  }
}

export function getBattleChartInnerWidth(scale: BattleChartScaleState): number {
  return Math.max(1, scale.width - scale.paddingLeft - scale.paddingRight)
}

export function getBattleChartInnerHeight(scale: BattleChartScaleState): number {
  return Math.max(1, scale.height - scale.paddingTop - scale.paddingBottom)
}

export function getBattleChartX(scale: BattleChartScaleState, pointIndex: number, pointCount: number = scale.pointCount): number {
  const count = Math.max(1, pointCount)
  if (count <= 1) return scale.paddingLeft
  return scale.paddingLeft + (getBattleChartInnerWidth(scale) * pointIndex) / (count - 1)
}

export function getBattleChartY(scale: BattleChartScaleState, value: number): number {
  const normalized = (value - scale.min) / scale.range
  return scale.paddingTop + getBattleChartInnerHeight(scale) * (1 - normalized)
}

export function getBattleNowLineX(scale: BattleChartScaleState): number {
  return getBattleChartX(scale, Math.max(0, scale.bucketCount - 1), scale.bucketCount)
}
