import { assertBattleLinesPayload } from "../../../../../packages/shared/src/schemas/battle-lines"
import type {
  BattleLinesDayMode,
  BattleLinesFilters,
  BattleLinesMetricMode,
  BattleLinesPayload
} from "../../../../../packages/shared/src/types/battle-lines"

export type BattleLinesRequestParams = {
  day: BattleLinesDayMode
  date: string
  top: 3 | 5 | 10
  metric: BattleLinesMetricMode
  bucketMinutes: 1 | 5 | 10
  focus?: string
}

function normalizeTop(raw: FormDataEntryValue | null): 3 | 5 | 10 {
  return raw === "3" ? 3 : raw === "10" ? 10 : 5
}

function normalizeBucket(raw: FormDataEntryValue | null): 1 | 5 | 10 {
  return raw === "1" ? 1 : raw === "10" ? 10 : 5
}

function normalizeMetric(raw: FormDataEntryValue | null): BattleLinesMetricMode {
  return raw === "indexed" ? "indexed" : "viewers"
}

function normalizeDay(raw: FormDataEntryValue | null): BattleLinesDayMode {
  return raw === "yesterday" ? "yesterday" : raw === "date" ? "date" : "today"
}

export function readBattleLinesRequestParams(form: HTMLFormElement, focusOverride?: string): BattleLinesRequestParams {
  const data = new FormData(form)

  return {
    day: normalizeDay(data.get("day")),
    date: String(data.get("date") ?? ""),
    top: normalizeTop(data.get("top")),
    metric: normalizeMetric(data.get("metric")),
    bucketMinutes: normalizeBucket(data.get("bucket")),
    focus: focusOverride && focusOverride.trim() ? focusOverride : undefined
  }
}

export function buildBattleLinesUrl(
  params: BattleLinesRequestParams,
  origin: string = window.location.origin
): string {
  const url = new URL("/api/battle-lines", origin)
  url.searchParams.set("day", params.day)
  if (params.day === "date" && params.date) url.searchParams.set("date", params.date)
  url.searchParams.set("top", String(params.top))
  url.searchParams.set("metric", params.metric)
  url.searchParams.set("bucket", String(params.bucketMinutes))
  if (params.focus) url.searchParams.set("focus", params.focus)
  return url.toString()
}

export async function fetchBattleLinesPayload(
  params: BattleLinesRequestParams,
  init: RequestInit & { origin?: string } = {}
): Promise<BattleLinesPayload> {
  const response = await fetch(buildBattleLinesUrl(params, init.origin), {
    method: "GET",
    signal: init.signal
  })

  if (!response.ok) {
    throw new Error(`Battle Lines request failed: HTTP ${response.status}`)
  }

  const payload = await response.json()
  assertBattleLinesPayload(payload)
  return payload
}

export async function fetchBattleLinesPayloadFromForm(
  form: HTMLFormElement,
  options: { focusOverride?: string; signal?: AbortSignal; origin?: string } = {}
): Promise<BattleLinesPayload> {
  return fetchBattleLinesPayload(readBattleLinesRequestParams(form, options.focusOverride), {
    signal: options.signal,
    origin: options.origin
  })
}

export function payloadFiltersToRequestParams(filters: BattleLinesFilters): BattleLinesRequestParams {
  return {
    day: filters.day,
    date: filters.date,
    top: filters.top,
    metric: filters.metric,
    bucketMinutes: filters.bucketMinutes,
    focus: filters.focus || undefined
  }
}

export function isBattleLinesAbortError(error: unknown): boolean {
  if (error instanceof DOMException) return error.name === "AbortError"
  if (error instanceof Error) return error.name === "AbortError"
  return false
}
