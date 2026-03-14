export type ApiState = "live" | "stale" | "partial" | "empty" | "error" | "demo"
export type ApiSource = "api" | "demo"

export type ResolveApiStateInput = {
  source: ApiSource
  hasSnapshot: boolean
  isFresh: boolean
  isPartial: boolean
  hasError: boolean
}

export function resolveApiState(input: ResolveApiStateInput): ApiState {
  if (input.hasError) return "error"
  if (input.source === "demo") return "demo"
  if (!input.hasSnapshot) return "empty"
  if (input.isPartial) return "partial"
  if (!input.isFresh) return "stale"
  return "live"
}
