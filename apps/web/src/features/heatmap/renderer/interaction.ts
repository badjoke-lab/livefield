const MIN_SCALE = 1
const MAX_SCALE = 4
const ZOOM_STEP = 0.3

type Transform = {
  scale: number
  tx: number
  ty: number
}

export type TreemapInteractionHandle = {
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
  destroy: () => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function applyBounds(viewport: HTMLElement, content: HTMLElement, next: Transform): Transform {
  const vw = viewport.clientWidth
  const vh = viewport.clientHeight
  const cw = content.clientWidth * next.scale
  const ch = content.clientHeight * next.scale
  const minTx = Math.min(0, vw - cw)
  const minTy = Math.min(0, vh - ch)

  return {
    scale: next.scale,
    tx: clamp(next.tx, minTx, 0),
    ty: clamp(next.ty, minTy, 0)
  }
}

export function mountTreemapInteraction(viewport: HTMLElement, content: HTMLElement): TreemapInteractionHandle {
  let state: Transform = { scale: 1, tx: 0, ty: 0 }
  let dragging = false
  let dragStart = { x: 0, y: 0, tx: 0, ty: 0 }

  const render = () => {
    content.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`
  }

  const setState = (next: Transform) => {
    state = applyBounds(viewport, content, next)
    render()
  }

  const zoomAt = (targetScale: number, focusX: number, focusY: number) => {
    const scale = clamp(targetScale, MIN_SCALE, MAX_SCALE)
    const ratio = scale / state.scale
    const next: Transform = {
      scale,
      tx: focusX - (focusX - state.tx) * ratio,
      ty: focusY - (focusY - state.ty) * ratio
    }
    setState(next)
  }

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault()
    const rect = viewport.getBoundingClientRect()
    const focusX = event.clientX - rect.left
    const focusY = event.clientY - rect.top
    const direction = event.deltaY > 0 ? -1 : 1
    zoomAt(state.scale + direction * ZOOM_STEP, focusX, focusY)
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (state.scale <= 1) return
    dragging = true
    dragStart = { x: event.clientX, y: event.clientY, tx: state.tx, ty: state.ty }
    viewport.setPointerCapture(event.pointerId)
    viewport.dataset.dragging = "on"
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!dragging) return
    const dx = event.clientX - dragStart.x
    const dy = event.clientY - dragStart.y
    setState({ ...state, tx: dragStart.tx + dx, ty: dragStart.ty + dy })
  }

  const stopDragging = (event?: PointerEvent) => {
    if (!dragging) return
    dragging = false
    viewport.dataset.dragging = "off"
    if (event) viewport.releasePointerCapture(event.pointerId)
  }

  const handleResize = () => setState(state)

  viewport.addEventListener("wheel", handleWheel, { passive: false })
  viewport.addEventListener("pointerdown", handlePointerDown)
  viewport.addEventListener("pointermove", handlePointerMove)
  viewport.addEventListener("pointerup", stopDragging)
  viewport.addEventListener("pointercancel", stopDragging)
  window.addEventListener("resize", handleResize)

  render()

  return {
    zoomIn: () => zoomAt(state.scale + ZOOM_STEP, viewport.clientWidth / 2, viewport.clientHeight / 2),
    zoomOut: () => zoomAt(state.scale - ZOOM_STEP, viewport.clientWidth / 2, viewport.clientHeight / 2),
    reset: () => setState({ scale: 1, tx: 0, ty: 0 }),
    destroy: () => {
      window.removeEventListener("resize", handleResize)
      viewport.removeEventListener("wheel", handleWheel)
      viewport.removeEventListener("pointerdown", handlePointerDown)
      viewport.removeEventListener("pointermove", handlePointerMove)
      viewport.removeEventListener("pointerup", stopDragging)
      viewport.removeEventListener("pointercancel", stopDragging)
      viewport.dataset.dragging = "off"
    }
  }
}
