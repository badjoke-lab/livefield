export type BattleLinesInteractionTarget = {
  streamerId: string
  x: number
  y: number
  radius: number
}

export type BattleLinesInteractionHandle = {
  destroy: () => void
}

type BattleLinesInteractionOptions = {
  getTargets: () => BattleLinesInteractionTarget[]
  onHoverChange?: (streamerId: string | null) => void
  onSelect?: (streamerId: string) => void
  hoverPadding?: number
}

function findNearestTarget(
  targets: BattleLinesInteractionTarget[],
  x: number,
  y: number,
  hoverPadding: number
): BattleLinesInteractionTarget | null {
  let winner: BattleLinesInteractionTarget | null = null
  let bestDistanceSq = Infinity

  for (const target of targets) {
    const dx = x - target.x
    const dy = y - target.y
    const distanceSq = dx * dx + dy * dy
    const maxRadius = target.radius + hoverPadding
    if (distanceSq > maxRadius * maxRadius) continue
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq
      winner = target
    }
  }

  return winner
}

export function attachBattleLinesInteraction(
  canvas: HTMLCanvasElement,
  options: BattleLinesInteractionOptions
): BattleLinesInteractionHandle {
  const hoverPadding = options.hoverPadding ?? 10
  let hoveredStreamerId: string | null = null

  function canvasPointFromEvent(event: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  function updateHover(streamerId: string | null): void {
    if (hoveredStreamerId === streamerId) return
    hoveredStreamerId = streamerId
    options.onHoverChange?.(streamerId)
  }

  function onPointerMove(event: PointerEvent): void {
    const point = canvasPointFromEvent(event)
    const target = findNearestTarget(options.getTargets(), point.x, point.y, hoverPadding)
    updateHover(target?.streamerId ?? null)
  }

  function onPointerLeave(): void {
    updateHover(null)
  }

  function onClick(event: PointerEvent): void {
    const point = canvasPointFromEvent(event)
    const target = findNearestTarget(options.getTargets(), point.x, point.y, hoverPadding)
    if (!target) return
    options.onSelect?.(target.streamerId)
  }

  canvas.addEventListener("pointermove", onPointerMove)
  canvas.addEventListener("pointerleave", onPointerLeave)
  canvas.addEventListener("click", onClick)

  return {
    destroy() {
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerleave", onPointerLeave)
      canvas.removeEventListener("click", onClick)
      updateHover(null)
    }
  }
}
