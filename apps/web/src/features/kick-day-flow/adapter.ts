type DayFlowRequestParams = {
  day: "today" | "rolling24h" | "yesterday" | "date"
  date: string
  top: 10 | 20 | 50
  mode: "volume" | "share"
  bucketMinutes: 5 | 10
}

type FormOptions = {
  signal?: AbortSignal
}

type AdapterInput =
  | HTMLFormElement
  | (DayFlowRequestParams & { signal?: AbortSignal })

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function normalizeDay(value: unknown): DayFlowRequestParams["day"] {
  return value === "rolling24h" || value === "yesterday" || value === "date" ? value : "today"
}

function normalizeTop(value: unknown): DayFlowRequestParams["top"] {
  const n = Number(value)
  if (n === 10 || n === 50) return n
  return 20
}

function normalizeMode(value: unknown): DayFlowRequestParams["mode"] {
  return value === "share" ? "share" : "volume"
}

function normalizeBucket(value: unknown): DayFlowRequestParams["bucketMinutes"] {
  return Number(value) === 10 ? 10 : 5
}

export function readDayFlowRequestParams(form: HTMLFormElement): DayFlowRequestParams {
  const data = new FormData(form)

  const day = normalizeDay(
    data.get("day") ??
    data.get("rangeMode") ??
    data.get("scope")
  )

  const date = String(
    data.get("date") ??
    data.get("selectedDate") ??
    todayIso()
  )

  const top = normalizeTop(
    data.get("top")
  )

  const mode = normalizeMode(
    data.get("mode") ??
    data.get("valueMode")
  )

  const bucketMinutes = normalizeBucket(
    data.get("bucketMinutes") ??
    data.get("bucket") ??
    data.get("bucketSize")
  )

  return { day, date, top, mode, bucketMinutes }
}

function normalizeInput(
  input: AdapterInput,
  options: FormOptions = {}
): { params: DayFlowRequestParams; signal?: AbortSignal } {
  if (typeof HTMLFormElement !== "undefined" && input instanceof HTMLFormElement) {
    return {
      params: readDayFlowRequestParams(input),
      signal: options.signal,
    }
  }

  const { signal, ...rest } = input
  const source = rest as Record<string, unknown>
  return {
    params: {
      day: normalizeDay(source.day ?? source.rangeMode),
      date: String(source.date ?? source.selectedDate ?? todayIso()),
      top: normalizeTop(source.top ?? source.topN),
      mode: normalizeMode(source.mode ?? source.valueMode),
      bucketMinutes: normalizeBucket(source.bucketMinutes ?? source.bucket ?? source.bucketSize),
    },
    signal: options.signal ?? signal,
  }
}

export function buildDayFlowUrl(
  params: DayFlowRequestParams,
  origin: string = window.location.origin
): string {
  const url = new URL("/api/kick-day-flow", origin)
  url.searchParams.set("day", params.day)
  if (params.day === "date" && params.date) url.searchParams.set("date", params.date)
  url.searchParams.set("top", String(params.top))
  url.searchParams.set("mode", params.mode)
  url.searchParams.set("bucket", String(params.bucketMinutes))
  return url.toString()
}

export const buildKickDayFlowUrl = buildDayFlowUrl

async function requestKickDayFlow(
  params: DayFlowRequestParams,
  signal?: AbortSignal
): Promise<any> {
  const response = await fetch(buildDayFlowUrl(params), {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal,
  })

  if (!response.ok) {
    throw new Error(`kick day-flow api returned ${response.status}`)
  }

  return await response.json()
}

export async function fetchDayFlowPayload(
  params: DayFlowRequestParams,
  init: RequestInit = {}
): Promise<any> {
  return requestKickDayFlow(params, init.signal as AbortSignal | undefined)
}

export const fetchKickDayFlowPayload = fetchDayFlowPayload

export async function fetchDayFlowPayloadFromForm(
  form: HTMLFormElement,
  options: FormOptions = {}
): Promise<any> {
  const { params, signal } = normalizeInput(form, options)
  return requestKickDayFlow(params, signal)
}

export const fetchKickDayFlowPayloadFromForm = fetchDayFlowPayloadFromForm

export function payloadFiltersToRequestParams(filters: any): DayFlowRequestParams {
  return {
    day: normalizeDay(filters?.day ?? filters?.rangeMode),
    date: String(filters?.date ?? filters?.selectedDate ?? todayIso()),
    top: normalizeTop(filters?.top),
    mode: normalizeMode(filters?.mode ?? filters?.valueMode),
    bucketMinutes: normalizeBucket(filters?.bucketMinutes ?? filters?.bucketSize),
  }
}

export const payloadFiltersToKickRequestParams = payloadFiltersToRequestParams

export function isDayFlowAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError"
}

export const isKickDayFlowAbortError = isDayFlowAbortError

export async function getDayFlowPayload(
  input: AdapterInput,
  options: FormOptions = {}
): Promise<any> {
  const { params, signal } = normalizeInput(input, options)
  return requestKickDayFlow(params, signal)
}

export const getKickDayFlowPayload = getDayFlowPayload
