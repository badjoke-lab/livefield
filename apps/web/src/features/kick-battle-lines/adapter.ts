import type {
  BattleLinesFilters,
  BattleLinesPayload,
} from "../../../../../packages/shared/src/types/battle-lines"
import {
  readBattleLinesRequestParams,
  payloadFiltersToRequestParams,
  type BattleLinesRequestParams,
} from "../../shared/api/battle-lines-api"
import {
  getKickBattleLinesScaffoldPayload,
  type KickBattleLinesPayload as RawKickBattleLinesPayload,
} from "../../shared/api/kick-battle-lines-api"

type FormOptions = {
  focusOverride?: string
  signal?: AbortSignal
  origin?: string
}

type AdapterInput =
  | HTMLFormElement
  | (BattleLinesRequestParams & { signal?: AbortSignal })

function normalizeState(raw: RawKickBattleLinesPayload): BattleLinesPayload["state"] {
  if (raw.state === "error") return "error"
  if (raw.state === "empty" || raw.state === "unconfigured") return "empty"
  if (raw.state === "partial" || raw.state === "loading") return "partial"
  if (raw.state === "complete") return "complete"
  return "live"
}

function normalizePayload(
  raw: RawKickBattleLinesPayload,
  params: BattleLinesRequestParams
): BattleLinesPayload {
  const metric = raw.filters?.metric ?? params.metric

  return {
    ok: true,
    tool: "battle-lines",
    source: raw.source === "demo" ? "demo" : "api",
    state: normalizeState(raw),
    updatedAt: raw.updatedAt ?? raw.lastUpdated ?? new Date().toISOString(),
    filters: {
      day: raw.filters?.day ?? params.day,
      date: raw.filters?.date ?? params.date,
      top: raw.filters?.top ?? params.top,
      metric,
      bucketMinutes: raw.filters?.bucketMinutes ?? params.bucketMinutes,
      focus: raw.filters?.focus ?? params.focus ?? "",
    },
    summary: {
      leader: raw.summary.leader ?? "No leader",
      biggestRise: raw.summary.biggestRise ?? "No rise",
      peakMoment: raw.summary.peakMoment ?? "N/A",
      reversals: raw.summary.reversals ?? 0,
      liveBattleNow: raw.summary.liveBattleNow ?? raw.summary.strongestPair ?? "No live battle",
      latestReversal: raw.summary.latestReversal ?? "No reversal yet",
      fastestChallenger: raw.summary.fastestChallenger ?? "N/A",
      mostHeatedBattle: raw.summary.mostHeatedBattle ?? raw.summary.strongestPair ?? "No heated battle",
    },
    buckets: raw.buckets ?? [],
    lines: (raw.lines ?? []).map((line) => ({
      ...line,
      points:
        metric === "indexed"
          ? (() => {
              const base = line.viewerPoints[0] || line.points[0] || 0
              if (base <= 0) return line.viewerPoints.map(() => 100)
              return line.viewerPoints.map((value) => Math.round((value / base) * 100))
            })()
          : line.viewerPoints,
      viewerPoints: line.viewerPoints,
    })),
    focusStrip: raw.focusStrip ?? [],
    focusDetail: raw.focusDetail ?? {
      streamerId: "",
      name: "N/A",
      peakViewers: 0,
      latestViewers: 0,
      biggestRiseTime: "N/A",
      reversalCount: 0,
    },
    events: raw.events ?? [],
    recommendation: raw.recommendation ?? {
      primaryBattle: null,
      secondaryBattles: [],
      latestReversal: "No reversal yet",
      fastestChallenger: "N/A",
      reversalStrip: [],
    },
  }
}

function normalizeInput(
  input: AdapterInput,
  options: FormOptions = {}
): { params: BattleLinesRequestParams; signal?: AbortSignal } {
  if (typeof HTMLFormElement !== "undefined" && input instanceof HTMLFormElement) {
    return {
      params: readBattleLinesRequestParams(input, options.focusOverride),
      signal: options.signal,
    }
  }

  const { signal, ...rest } = input
  return {
    params: rest,
    signal: options.signal ?? signal,
  }
}

export function buildBattleLinesUrl(
  params: BattleLinesRequestParams,
  origin: string = window.location.origin
): string {
  const url = new URL("/api/kick-battle-lines", origin)
  url.searchParams.set("day", params.day)
  if (params.day === "date" && params.date) url.searchParams.set("date", params.date)
  url.searchParams.set("top", String(params.top))
  url.searchParams.set("metric", params.metric)
  url.searchParams.set("bucket", String(params.bucketMinutes))
  if (params.focus) url.searchParams.set("focus", params.focus)
  return url.toString()
}

export const buildKickBattleLinesUrl = buildBattleLinesUrl

export async function fetchBattleLinesPayload(
  params: BattleLinesRequestParams,
  _init: RequestInit & { origin?: string } = {}
): Promise<BattleLinesPayload> {
  const raw = await getKickBattleLinesScaffoldPayload({
    day: params.day,
    date: params.date,
    top: params.top,
    metric: params.metric,
    bucketMinutes: params.bucketMinutes,
    focus: params.focus,
  })
  return normalizePayload(raw, params)
}

export const fetchKickBattleLinesPayload = fetchBattleLinesPayload

export async function fetchBattleLinesPayloadFromForm(
  form: HTMLFormElement,
  options: FormOptions = {}
): Promise<BattleLinesPayload> {
  const { params } = normalizeInput(form, options)
  return fetchBattleLinesPayload(params, { origin: options.origin })
}

export const fetchKickBattleLinesPayloadFromForm = fetchBattleLinesPayloadFromForm

export function payloadFiltersToBattleRequestParams(
  filters: BattleLinesFilters
): BattleLinesRequestParams {
  return payloadFiltersToRequestParams(filters)
}

export const payloadFiltersToKickRequestParams = payloadFiltersToBattleRequestParams

export function isBattleLinesAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError"
}

export const isKickBattleLinesAbortError = isBattleLinesAbortError

export async function getBattleLinesPayload(
  input: AdapterInput,
  options: FormOptions = {}
): Promise<BattleLinesPayload> {
  const { params } = normalizeInput(input, options)
  return fetchBattleLinesPayload(params, { origin: options.origin })
}

export const getKickBattleLinesPayload = getBattleLinesPayload
