export type AnimationMode = {
  enabled: boolean
}

const STORAGE_KEY = "livefield:animation-off"

export function readAnimationEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "1"
  } catch {
    return true
  }
}

export function writeAnimationEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "0" : "1")
  } catch {
    // ignore
  }
}

export function resolveAnimationMode(): AnimationMode {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
  if (reducedMotion) {
    return { enabled: false }
  }
  return { enabled: readAnimationEnabled() }
}
