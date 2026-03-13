export type LowLoadMode = {
  enabled: boolean
  maxDpr: number
}

const STORAGE_KEY = "livefield:low-load"

export function getLowLoadStorageKey(): string {
  return STORAGE_KEY
}

export function readLowLoadEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function writeLowLoadEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0")
  } catch {
    // ignore
  }
}

export function resolveLowLoadMode(): LowLoadMode {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false

  if (readLowLoadEnabled()) {
    return { enabled: true, maxDpr: 1.5 }
  }

  if (reducedMotion) {
    return { enabled: true, maxDpr: 1.5 }
  }

  return { enabled: false, maxDpr: 2 }
}
