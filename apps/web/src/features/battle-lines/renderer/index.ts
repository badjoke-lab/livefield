import type {
  BattleCandidate,
  BattleLinesPayload
} from "../../../../../../packages/shared/src/types/battle-lines"
import type { UiState } from "../state"
import { buildHighlightedIds } from "../state"
import { drawBattleAxis } from "./draw-axis"
import { drawBattleLines } from "./draw-lines"
import { drawBattleEndMarkers, drawBattleNowLine } from "./draw-markers"
import {
  attachBattleLinesInteraction,
  type BattleLinesInteractionTarget
} from "./interaction"
import { createBattleChartScaleState } from "./scales"

type StageWithCleanup = HTMLElement & {
  __battleLinesCleanup?: () => void
}

type MountBattleLinesRendererOptions = {
  onHoverChange?: (streamerId: string | null) => void
  onSelect?: (streamerId: string) => void
}

function getPrimaryIds(activePrimary: BattleCandidate | null): Set<string> {
  const ids = new Set<string>()
  if (!activePrimary) return ids
  ids.add(activePrimary.leftId)
  ids.add(activePrimary.rightId)
  return ids
}

function ensureCanvasSize(canvas: HTMLCanvasElement, stage: HTMLElement): {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
} | null {
  const rect = stage.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  const dpr = Math.max(1, window.devicePixelRatio || 1)

  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  return { ctx, width, height }
}

function drawBattleLinesCanvas(
  canvas: HTMLCanvasElement,
  stage: HTMLElement,
  payload: BattleLinesPayload,
  uiState: UiState,
  activePrimary: BattleCandidate | null,
  hoveredStreamerId: string | null
): BattleLinesInteractionTarget[] {
  const sized = ensureCanvasSize(canvas, stage)
  if (!sized) return []

  const { ctx, width, height } = sized
  ctx.clearRect(0, 0, width, height)

  const scale = createBattleChartScaleState({
    width,
    height,
    lines: payload.lines.map((line) => line.points),
    pointCount: Math.max(...payload.lines.map((line) => line.points.length), 1),
    bucketCount: payload.buckets.length
  })

  const highlightedIds = buildHighlightedIds(payload, uiState, activePrimary)
  const primaryIds = getPrimaryIds(activePrimary)

  drawBattleAxis(ctx, scale)
  drawBattleLines(ctx, scale, payload.lines, highlightedIds, primaryIds)
  drawBattleNowLine(ctx, scale)
  return drawBattleEndMarkers(
    ctx,
    scale,
    payload.lines,
    highlightedIds,
    primaryIds,
    uiState.focusId || null,
    hoveredStreamerId,
    payload.recommendation
  )
}

export function mountBattleLinesRenderer(
  stage: HTMLElement,
  payload: BattleLinesPayload,
  uiState: UiState,
  activePrimary: BattleCandidate | null,
  options: MountBattleLinesRendererOptions = {}
): void {
  const stageEl = stage as StageWithCleanup
  stageEl.__battleLinesCleanup?.()

  const canvas = stage.querySelector<HTMLCanvasElement>("[data-battle-lines-canvas]")
  if (!canvas) return

  let hoveredStreamerId: string | null = null
  let interactionTargets: BattleLinesInteractionTarget[] = []

  const render = () => {
    interactionTargets = drawBattleLinesCanvas(canvas, stage, payload, uiState, activePrimary, hoveredStreamerId)
    stage.dataset.hoverActive = hoveredStreamerId ? "true" : "false"
    canvas.style.cursor = hoveredStreamerId ? "pointer" : "crosshair"
  }

  const interaction = attachBattleLinesInteraction(canvas, {
    getTargets: () => interactionTargets,
    onHoverChange: (streamerId) => {
      if (hoveredStreamerId === streamerId) return
      hoveredStreamerId = streamerId
      options.onHoverChange?.(streamerId)
      render()
    },
    onSelect: (streamerId) => {
      options.onSelect?.(streamerId)
    }
  })

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(() => render())
    observer.observe(stage)

    stageEl.__battleLinesCleanup = () => {
      observer.disconnect()
      interaction.destroy()
      options.onHoverChange?.(null)
    }
  } else {
    const onResize = () => render()
    window.addEventListener("resize", onResize)

    stageEl.__battleLinesCleanup = () => {
      window.removeEventListener("resize", onResize)
      interaction.destroy()
      options.onHoverChange?.(null)
    }
  }

  render()
}
