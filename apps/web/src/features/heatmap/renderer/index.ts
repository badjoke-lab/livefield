import type { HeatmapNode, HeatmapPayload } from "../../../../../packages/shared/src/types/heatmap"
import { createCanvasHost } from "../../../shared/canvas/canvas-host"
import { createRafLoop } from "../../../shared/canvas/raf-loop"
import { resolveAnimationMode } from "../../../shared/runtime/animation-mode"
import { resolveLowLoadMode } from "../../../shared/runtime/low-load-mode"
import { observePageVisibility } from "../../../shared/runtime/visibility"

export type HeatmapRendererHandle = {
  destroy: () => void
}

type HitRegion = {
  streamerId: string
  x: number
  y: number
  r: number
}

const slots = [
  { x: 0.14, y: 0.18 },
  { x: 0.44, y: 0.16 },
  { x: 0.70, y: 0.30 },
  { x: 0.27, y: 0.56 },
  { x: 0.58, y: 0.54 },
  { x: 0.80, y: 0.64 },
  { x: 0.15, y: 0.78 },
  { x: 0.42, y: 0.75 },
  { x: 0.68, y: 0.82 }
] as const

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save()
  ctx.strokeStyle = "rgba(122, 162, 255, 0.07)"
  ctx.lineWidth = 1

  const cell = 42
  for (let x = 0; x <= width; x += cell) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }

  for (let y = 0; y <= height; y += cell) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  ctx.restore()
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, "rgba(8, 16, 30, 0.98)")
  gradient.addColorStop(1, "rgba(11, 18, 34, 0.98)")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  const glowA = ctx.createRadialGradient(width * 0.18, height * 0.18, 0, width * 0.18, height * 0.18, width * 0.24)
  glowA.addColorStop(0, "rgba(122, 162, 255, 0.18)")
  glowA.addColorStop(1, "rgba(122, 162, 255, 0)")
  ctx.fillStyle = glowA
  ctx.fillRect(0, 0, width, height)

  const glowB = ctx.createRadialGradient(width * 0.78, height * 0.30, 0, width * 0.78, height * 0.30, width * 0.18)
  glowB.addColorStop(0, "rgba(132, 240, 255, 0.12)")
  glowB.addColorStop(1, "rgba(132, 240, 255, 0)")
  ctx.fillStyle = glowB
  ctx.fillRect(0, 0, width, height)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function getNodeRadius(viewers: number, width: number, lowLoad: boolean): number {
  const base = width < 520 ? 18 : 22
  const scaled = base + Math.sqrt(Math.max(0, viewers)) * 1.15
  const radius = clamp(scaled, width < 520 ? 20 : 24, width < 520 ? 68 : 92)
  return lowLoad ? radius * 0.88 : radius
}

function getNodeCenter(slotIndex: number, width: number, height: number): { x: number; y: number } {
  const slot = slots[slotIndex] ?? slots[slots.length - 1]
  const padX = width * 0.03
  const padY = height * 0.04

  return {
    x: padX + (width - padX * 2) * slot.x,
    y: padY + (height - padY * 2) * slot.y
  }
}

function getMomentumStrength(momentum: number): number {
  if (momentum >= 0.15) return 1
  if (momentum >= 0.08) return 0.75
  if (momentum >= 0.03) return 0.45
  return 0.18
}

function drawAgitationRings(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  agitationLevel: HeatmapNode["agitationLevel"]
): void {
  if (agitationLevel <= 0) return

  const ringCount = agitationLevel >= 4 ? 2 : 1

  for (let i = 0; i < ringCount; i += 1) {
    const offset = i === 0 ? 8 : 16
    const alphaBase = agitationLevel >= 5 ? 0.34 : agitationLevel >= 4 ? 0.26 : agitationLevel >= 3 ? 0.20 : 0.14
    const alpha = Math.max(0.08, alphaBase - i * 0.07)

    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r + offset, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255, 211, 107, ${alpha})`
    ctx.lineWidth = agitationLevel >= 5 && i === 0 ? 2.2 : 1.4
    ctx.setLineDash(agitationLevel >= 4 ? [5, 5] : [3, 5])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  node: HeatmapNode,
  slotIndex: number,
  isSelected: boolean,
  lowLoad: boolean,
  animationEnabled: boolean,
  time: number
): HitRegion {
  const { x: cx, y: cy } = getNodeCenter(slotIndex, width, height)
  const r = getNodeRadius(node.viewers, width, lowLoad)
  const momentumStrength = getMomentumStrength(node.momentum)
  const pulse = animationEnabled ? 1 + Math.sin(time / 420 + slotIndex * 0.6) * 0.06 : 1
  const glowPulse = animationEnabled ? 1 + Math.sin(time / 520 + slotIndex * 0.5) * 0.08 : 1

  ctx.save()

  drawAgitationRings(ctx, cx, cy, r, node.agitationLevel)

  ctx.beginPath()
  ctx.arc(cx, cy, r + (isSelected ? 12 * pulse : 7), 0, Math.PI * 2)
  ctx.strokeStyle = isSelected ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.14)"
  ctx.lineWidth = isSelected ? 2.2 : 1.2
  ctx.setLineDash([4, 4])
  ctx.stroke()
  ctx.setLineDash([])

  if (isSelected) {
    const haloRadius = r * 1.55 * pulse
    const halo = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, haloRadius)
    halo.addColorStop(0, "rgba(132, 240, 255, 0.08)")
    halo.addColorStop(0.45, "rgba(132, 240, 255, 0.14)")
    halo.addColorStop(1, "rgba(132, 240, 255, 0)")
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(cx, cy, haloRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  const glowRadius = r * (1.2 + momentumStrength * 0.28) * glowPulse
  const glow = ctx.createRadialGradient(cx, cy, r * 0.18, cx, cy, glowRadius)
  glow.addColorStop(0, `rgba(168, 247, 255, ${0.16 + momentumStrength * 0.26})`)
  glow.addColorStop(0.45, `rgba(122, 162, 255, ${0.08 + momentumStrength * 0.18})`)
  glow.addColorStop(1, "rgba(122, 162, 255, 0)")
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2)
  ctx.fill()

  const body = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.3, r * 0.12, cx, cy, r)
  body.addColorStop(0, "rgba(175, 244, 255, 0.95)")
  body.addColorStop(0.34, "rgba(110, 196, 255, 0.55)")
  body.addColorStop(0.74, "rgba(72, 111, 255, 0.26)")
  body.addColorStop(1, "rgba(72, 111, 255, 0.14)")
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = isSelected ? "rgba(132, 240, 255, 0.82)" : "rgba(132, 240, 255, 0.45)"
  ctx.lineWidth = isSelected ? 2.2 : 1.3
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  const showName = slotIndex < 8
  if (showName) {
    ctx.textAlign = "center"
    ctx.fillStyle = "rgba(238, 246, 255, 0.98)"
    ctx.font = `700 ${width < 520 ? 11 : 14}px Inter, system-ui, sans-serif`
    ctx.fillText(node.name, cx, cy + 4)
  }

  if (slotIndex < 5) {
    ctx.fillStyle = "rgba(158, 176, 211, 0.9)"
    ctx.font = "12px Inter, system-ui, sans-serif"
    ctx.fillText(`${node.viewers.toLocaleString()}`, cx, cy + r + 22)
  }

  if (slotIndex < 6) {
    const badgeY = cy - r - 16
    ctx.font = "11px Inter, system-ui, sans-serif"
    ctx.textAlign = "center"

    ctx.fillStyle = isSelected ? "rgba(10,18,34,0.92)" : "rgba(8,16,30,0.82)"
    ctx.strokeStyle = isSelected ? "rgba(132,240,255,0.24)" : "rgba(122, 162, 255, 0.12)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(cx - 34, badgeY - 11, 68, 22, 999)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = "rgba(238,243,255,0.92)"
    ctx.fillText(`Lv${node.agitationLevel}`, cx, badgeY + 4)
  }

  ctx.restore()

  return { streamerId: node.streamerId, x: cx, y: cy, r }
}

function drawCornerMeta(
  ctx: CanvasRenderingContext2D,
  width: number,
  payload: HeatmapPayload,
  lowLoad: boolean,
  animationEnabled: boolean,
  visibleCount: number
): void {
  ctx.save()

  const lines = [
    `Task 8B: Animation`,
    `source: ${payload.source}`,
    `visible: ${visibleCount}`,
    `low-load: ${lowLoad ? "on" : "off"} / anim: ${animationEnabled ? "on" : "off"}`
  ]

  const boxWidth = width < 520 ? 210 : 248
  const boxHeight = 84
  const x = width - boxWidth - 16
  const y = 16

  ctx.fillStyle = "rgba(8, 16, 30, 0.78)"
  ctx.strokeStyle = "rgba(122, 162, 255, 0.14)"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(x, y, boxWidth, boxHeight, 14)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = "rgba(238, 243, 255, 0.95)"
  ctx.font = "700 13px Inter, system-ui, sans-serif"
  ctx.fillText(lines[0], x + 14, y + 22)

  ctx.fillStyle = "rgba(158, 176, 211, 0.92)"
  ctx.font = "12px Inter, system-ui, sans-serif"
  ctx.fillText(lines[1], x + 14, y + 42)
  ctx.fillText(lines[2], x + 14, y + 58)
  ctx.fillText(lines[3], x + 14, y + 74)

  ctx.restore()
}

function getLocalPoint(canvas: HTMLCanvasElement, event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}

function findHitRegion(regions: HitRegion[], x: number, y: number): HitRegion | null {
  for (let i = regions.length - 1; i >= 0; i -= 1) {
    const region = regions[i]
    const dx = x - region.x
    const dy = y - region.y
    if (dx * dx + dy * dy <= region.r * region.r) {
      return region
    }
  }
  return null
}

export function mountHeatmapRenderer(
  canvas: HTMLCanvasElement,
  payload: HeatmapPayload,
  selectedStreamerId: string,
  onSelect: (streamerId: string) => void
): HeatmapRendererHandle {
  const lowLoadMode = resolveLowLoadMode()
  const animationMode = resolveAnimationMode()
  const host = createCanvasHost(canvas, { maxDpr: lowLoadMode.maxDpr })
  const visibleCount = lowLoadMode.enabled ? 5 : slots.length
  const nodes = payload.nodes.slice(0, visibleCount)
  let hitRegions: HitRegion[] = []

  const draw = (time: number) => {
    const { ctx, width, height } = host.get()
    ctx.clearRect(0, 0, width, height)
    drawBackground(ctx, width, height)
    drawGrid(ctx, width, height)

    hitRegions = nodes.map((node, index) =>
      drawNode(
        ctx,
        width,
        height,
        node,
        index,
        node.streamerId === selectedStreamerId,
        lowLoadMode.enabled,
        animationMode.enabled,
        time
      )
    )

    drawCornerMeta(ctx, width, payload, lowLoadMode.enabled, animationMode.enabled, visibleCount)
  }

  const handlePointerMove = (event: PointerEvent) => {
    const { x, y } = getLocalPoint(canvas, event)
    const hit = findHitRegion(hitRegions, x, y)
    canvas.style.cursor = hit ? "pointer" : "default"
  }

  const handlePointerDown = (event: PointerEvent) => {
    const { x, y } = getLocalPoint(canvas, event)
    const hit = findHitRegion(hitRegions, x, y)
    if (hit && hit.streamerId !== selectedStreamerId) {
      onSelect(hit.streamerId)
    }
  }

  const handlePointerLeave = () => {
    canvas.style.cursor = "default"
  }

  const loop = createRafLoop(draw)
  const unobserve = observePageVisibility(
    () => loop.pause(),
    () => loop.resume()
  )

  canvas.addEventListener("pointermove", handlePointerMove)
  canvas.addEventListener("pointerdown", handlePointerDown)
  canvas.addEventListener("pointerleave", handlePointerLeave)

  loop.resume()

  return {
    destroy() {
      loop.stop()
      unobserve()
      canvas.removeEventListener("pointermove", handlePointerMove)
      canvas.removeEventListener("pointerdown", handlePointerDown)
      canvas.removeEventListener("pointerleave", handlePointerLeave)
      canvas.style.cursor = "default"
      host.destroy()
    }
  }
}
