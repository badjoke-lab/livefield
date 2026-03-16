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
  focus: () => void
  blur: () => void
  isFocused: () => boolean
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

export function mountTreemapInteraction(
  viewport: HTMLElement,
  content: HTMLElement,
  onTransform?: (transform: { scale: number; tx: number; ty: number }) => void,
  onFocusChange?: (focused: boolean) => void
): TreemapInteractionHandle {
  let state: Transform = { scale: 1, tx: 0, ty: 0 }
  let dragging = false
  let focused = false
  let dragStart = { x: 0, y: 0, tx: 0, ty: 0 }

  const pointers = new Map<number, { x: number; y: number }>()
  let pinchStartDistance = 0
  let pinchStartScale = 1

  const render = () => {
    content.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`
  }

  const setState = (next: Transform) => {
    state = applyBounds(viewport, content, next)
    render()
    onTransform?.(state)
  }

  const setFocused = (next: boolean) => {
    focused = next
    viewport.dataset.focused = next ? "on" : "off"
    onFocusChange?.(next)
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
    if (!focused && !event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    const rect = viewport.getBoundingClientRect()
    const focusX = event.clientX - rect.left
    const focusY = event.clientY - rect.top
    const direction = event.deltaY > 0 ? -1 : 1
    zoomAt(state.scale + direction * ZOOM_STEP, focusX, focusY)
  }

  const getPointerDistance = (): number => {
    const values = [...pointers.values()]
    if (values.length < 2) return 0
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y)
  }

  const pointerFocus = (): { x: number; y: number } => {
    const values = [...pointers.values()]
    if (values.length === 0) return { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 }
    const sum = values.reduce((acc, pointer) => ({ x: acc.x + pointer.x, y: acc.y + pointer.y }), { x: 0, y: 0 })
    return { x: sum.x / values.length, y: sum.y / values.length }
  }

  const handlePointerDown = (event: PointerEvent) => {
    const rect = viewport.getBoundingClientRect()
    pointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top })

    if (pointers.size === 2) {
      pinchStartDistance = getPointerDistance()
      pinchStartScale = state.scale
      dragging = false
      viewport.dataset.dragging = "off"
      return
    }

    if (!focused || state.scale <= 1) return
    dragging = true
    dragStart = { x: event.clientX, y: event.clientY, tx: state.tx, ty: state.ty }
    viewport.setPointerCapture(event.pointerId)
    viewport.dataset.dragging = "on"
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return

    const rect = viewport.getBoundingClientRect()
    pointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top })

    if (pointers.size >= 2) {
      const distance = getPointerDistance()
      if (pinchStartDistance > 0) {
        const focus = pointerFocus()
        zoomAt(pinchStartScale * (distance / pinchStartDistance), focus.x, focus.y)
      }
      return
    }

    if (!dragging) return
    const dx = event.clientX - dragStart.x
    const dy = event.clientY - dragStart.y
    setState({ ...state, tx: dragStart.tx + dx, ty: dragStart.ty + dy })
  }

  const stopDragging = (event?: PointerEvent) => {
    if (event) pointers.delete(event.pointerId)
    if (pointers.size < 2) pinchStartDistance = 0

    if (!dragging) return
    dragging = false
    viewport.dataset.dragging = "off"
    if (event) viewport.releasePointerCapture(event.pointerId)
  }

  const handleResize = () => setState(state)

  const handleDocumentPointerDown = (event: PointerEvent) => {
    if (!focused) return
    if (!viewport.contains(event.target as Node)) {
      stopDragging()
      setFocused(false)
    }
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !focused) return
    stopDragging()
    setFocused(false)
  }

  viewport.addEventListener("wheel", handleWheel, { passive: false })
  viewport.addEventListener("pointerdown", handlePointerDown)
  viewport.addEventListener("pointermove", handlePointerMove)
  viewport.addEventListener("pointerup", stopDragging)
  viewport.addEventListener("pointercancel", stopDragging)
  document.addEventListener("pointerdown", handleDocumentPointerDown)
  window.addEventListener("keydown", handleKeydown)
  window.addEventListener("resize", handleResize)

  setFocused(false)
  render()
  onTransform?.(state)

  return {
    zoomIn: () => zoomAt(state.scale + ZOOM_STEP, viewport.clientWidth / 2, viewport.clientHeight / 2),
    zoomOut: () => zoomAt(state.scale - ZOOM_STEP, viewport.clientWidth / 2, viewport.clientHeight / 2),
    reset: () => setState({ scale: 1, tx: 0, ty: 0 }),
    focus: () => setFocused(true),
    blur: () => {
      stopDragging()
      setFocused(false)
    },
    isFocused: () => focused,
    destroy: () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("keydown", handleKeydown)
      document.removeEventListener("pointerdown", handleDocumentPointerDown)
      viewport.removeEventListener("wheel", handleWheel)
      viewport.removeEventListener("pointerdown", handlePointerDown)
      viewport.removeEventListener("pointermove", handlePointerMove)
      viewport.removeEventListener("pointerup", stopDragging)
      viewport.removeEventListener("pointercancel", stopDragging)
      viewport.dataset.dragging = "off"
      viewport.dataset.focused = "off"
    }
  }
}
