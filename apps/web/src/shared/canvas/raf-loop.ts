export type RafLoopHandle = {
  resume: () => void
  pause: () => void
  stop: () => void
}

export function createRafLoop(draw: (time: number) => void): RafLoopHandle {
  let rafId = 0
  let running = false

  const frame = (time: number) => {
    if (!running) return
    draw(time)
    rafId = window.requestAnimationFrame(frame)
  }

  return {
    resume() {
      if (running) return
      running = true
      rafId = window.requestAnimationFrame(frame)
    },
    pause() {
      running = false
      if (rafId) window.cancelAnimationFrame(rafId)
      rafId = 0
    },
    stop() {
      running = false
      if (rafId) window.cancelAnimationFrame(rafId)
      rafId = 0
    }
  }
}
