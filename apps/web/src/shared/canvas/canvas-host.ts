import { getClampedDpr } from "./dpr"

type CanvasHostOptions = {
  maxDpr?: number
}

export type CanvasHost = {
  resize: () => void
  get: () => { ctx: CanvasRenderingContext2D; width: number; height: number; dpr: number }
  destroy: () => void
}

export function createCanvasHost(canvas: HTMLCanvasElement, options: CanvasHostOptions = {}): CanvasHost {
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("2D context not available")
  }

  let width = 0
  let height = 0
  let dpr = 1

  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    width = Math.max(1, Math.floor(rect.width))
    height = Math.max(1, Math.floor(rect.height))
    dpr = getClampedDpr(options.maxDpr ?? 2)

    canvas.width = Math.max(1, Math.floor(width * dpr))
    canvas.height = Math.max(1, Math.floor(height * dpr))
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const ro = new ResizeObserver(() => resize())
  ro.observe(canvas)

  resize()

  return {
    resize,
    get: () => ({ ctx, width, height, dpr }),
    destroy: () => {
      ro.disconnect()
    }
  }
}
