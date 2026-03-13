export function getClampedDpr(maxDpr = 2): number {
  const raw = window.devicePixelRatio || 1
  return Math.max(1, Math.min(raw, maxDpr))
}
