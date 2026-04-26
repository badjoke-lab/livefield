import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"
import { createCanvasHost, type CanvasHost } from "../../shared/canvas/canvas-host"
import { getDayFlowPayload } from "../../shared/api/day-flow-api"
import type {
  DayFlowBandSeries,
  DayFlowPayload,
} from "../../../../../packages/shared/src/types/day-flow"

const numberFmt = new Intl.NumberFormat("en-US")
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
const pctFmt = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 })

const CACHE_KEY = "viewloom.dayflow.last-good.v2"
const STYLE_ID = "viewloom-dayflow-style"

type RangeMode = "today" | "rolling24h" | "yesterday" | "date"
type LayoutMode = "wide" | "split"
type MetricMode = "volume" | "share"
type ScopeMode = "full" | "topFocus"
type ShareBasis = "global" | "topN"
type TopN = 10 | 20 | 50
type BucketSize = 5 | 10

type ViewState = {
  layout: LayoutMode
  rangeMode: RangeMode
  selectedDate: string
  topN: TopN
  metric: MetricMode
  scope: ScopeMode
  bucketSize: BucketSize
  selectedBucketIndex: number
  selectedStreamerId: string | null
  dimOthers: boolean
  autoUpdate: boolean
}

type ViewModel = {
  payload: DayFlowPayload
  topBands: DayFlowBandSeries[]
  others: DayFlowBandSeries | null
  visibleBands: DayFlowBandSeries[]
  visibleStart: number
  visibleEnd: number
  selectedIndex: number
  observedTotal: number[]
  topTotal: number[]
  yMax: number
  shareBasis: ShareBasis
}

type ChartGeometry = {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

type FocusRow = {
  rank: number
  band: DayFlowBandSeries
  viewers: number
  share: number
  momentum: number
  gapToPrev: number | null
  gapToNext: number | null
  barRatio: number
}

const PALETTE = [
  "#7DD3FC",
  "#A78BFA",
  "#F0ABFC",
  "#F9A8D4",
  "#FDBA74",
  "#BEF264",
  "#5EEAD4",
  "#93C5FD",
  "#C4B5FD",
  "#FCA5A5",
  "#67E8F9",
  "#86EFAC",
  "#FDE68A",
  "#D8B4FE",
  "#99F6E4",
  "#BFDBFE",
  "#FBCFE8",
  "#FED7AA",
  "#A7F3D0",
  "#DDD6FE",
]

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoTimeLabel(iso: string | null | undefined): string {
  return iso ? iso.slice(11, 16) : "N/A"
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function normalizeRange(value: unknown): RangeMode {
  return value === "rolling24h" || value === "yesterday" || value === "date" ? value : "today"
}

function normalizeLayout(value: unknown): LayoutMode {
  return value === "split" ? "split" : "wide"
}

function normalizeMetric(value: unknown): MetricMode {
  return value === "share" ? "share" : "volume"
}

function normalizeScope(value: unknown): ScopeMode {
  return value === "topFocus" || value === "top-focus" || value === "focus" ? "topFocus" : "full"
}

function normalizeTop(value: unknown): TopN {
  const n = Number(value)
  if (n === 10 || n === 50) return n
  return 20
}

function normalizeBucket(value: unknown): BucketSize {
  return Number(value) === 10 ? 10 : 5
}

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function colorForBand(band: DayFlowBandSeries, rank: number): string {
  if (band.isOthers) return "#475569"
  const key = band.streamerId || band.name || String(rank)
  return PALETTE[(hashString(key) + rank * 3) % PALETTE.length]
}

function alphaForBand(band: DayFlowBandSeries, rank: number, state: ViewState): number {
  if (band.isOthers) return state.scope === "full" ? 0.22 : 0
  if (state.selectedStreamerId && state.selectedStreamerId !== band.streamerId) {
    return state.dimOthers ? 0.18 : 0.38
  }
  if (state.scope === "topFocus") {
    if (rank < 5) return 0.92
    if (rank < 20) return 0.78
    return 0.62
  }
  if (rank < 5) return 0.82
  if (rank < 20) return 0.68
  return 0.50
}

function getInitialState(): ViewState {
  const params = new URL(window.location.href).searchParams
  const legacyLayout = params.get("layout") === "theater" ? "wide" : params.get("layout")
  const savedAuto = window.localStorage.getItem("viewloom.dayflow.autoUpdate")
  return {
    layout: normalizeLayout(legacyLayout),
    rangeMode: normalizeRange(params.get("rangeMode") ?? params.get("day")),
    selectedDate: params.get("date") ?? todayIso(),
    topN: normalizeTop(params.get("top")),
    metric: normalizeMetric(params.get("metric") ?? params.get("mode")),
    scope: normalizeScope(params.get("scope")),
    bucketSize: normalizeBucket(params.get("bucket")),
    selectedBucketIndex: -1,
    selectedStreamerId: null,
    dimOthers: false,
    autoUpdate: savedAuto === null ? true : savedAuto === "true",
  }
}

function updateUrl(state: ViewState): void {
  const url = new URL(window.location.href)
  url.searchParams.set("layout", state.layout)
  url.searchParams.set("day", state.rangeMode)
  url.searchParams.set("rangeMode", state.rangeMode)
  if (state.rangeMode === "date") url.searchParams.set("date", state.selectedDate)
  else url.searchParams.delete("date")
  url.searchParams.set("top", String(state.topN))
  url.searchParams.set("metric", state.metric)
  url.searchParams.set("mode", state.metric)
  url.searchParams.set("scope", state.scope)
  url.searchParams.set("bucket", String(state.bucketSize))
  window.history.replaceState({}, "", url)
}

function getObservedEnd(payload: DayFlowPayload): number {
  for (let i = payload.buckets.length - 1; i >= 0; i -= 1) {
    if ((payload.totalViewersByBucket[i] ?? 0) > 0) return i
  }
  return Math.max(0, payload.buckets.length - 1)
}

function getVisibleRange(payload: DayFlowPayload): { start: number; end: number } {
  if (payload.buckets.length === 0) return { start: 0, end: 0 }
  if (payload.rangeMode === "today") return { start: 0, end: getObservedEnd(payload) }
  return { start: 0, end: payload.buckets.length - 1 }
}

function withViewloomColors(bands: DayFlowBandSeries[]): DayFlowBandSeries[] {
  return bands.map((band, index) => ({ ...band, color: colorForBand(band, index) }))
}

function computeTopTotal(topBands: DayFlowBandSeries[], bucketCount: number): number[] {
  return Array.from({ length: bucketCount }, (_, bucketIndex) =>
    topBands.reduce((sum, band) => sum + (band.buckets[bucketIndex]?.viewers ?? 0), 0)
  )
}

function buildViewModel(payload: DayFlowPayload, state: ViewState): ViewModel {
  const coloredBands = withViewloomColors(payload.bands)
  const topBands = coloredBands.filter((band) => !band.isOthers)
  const others = coloredBands.find((band) => band.isOthers) ?? null
  const visibleBands = state.scope === "topFocus" ? topBands : topBands
  const range = getVisibleRange(payload)
  const observedTotal = payload.totalViewersByBucket.map((value) => Math.max(0, value ?? 0))
  const topTotal = computeTopTotal(topBands, payload.buckets.length)
  const selectedIndex = clamp(
    state.selectedBucketIndex >= 0 ? state.selectedBucketIndex : range.end,
    range.start,
    range.end,
  )

  let yMax = 1
  let shareBasis: ShareBasis = "global"
  if (state.metric === "volume" && state.scope === "full") {
    yMax = Math.max(1, ...observedTotal.slice(range.start, range.end + 1))
  } else if (state.metric === "volume" && state.scope === "topFocus") {
    yMax = Math.max(1, ...topTotal.slice(range.start, range.end + 1))
  } else if (state.metric === "share" && state.scope === "topFocus") {
    shareBasis = "topN"
  }

  return {
    payload,
    topBands,
    others,
    visibleBands,
    visibleStart: range.start,
    visibleEnd: range.end,
    selectedIndex,
    observedTotal,
    topTotal,
    yMax,
    shareBasis,
  }
}

function valueForBand(band: DayFlowBandSeries, bucketIndex: number, view: ViewModel, state: ViewState): number {
  const bucket = band.buckets[bucketIndex]
  if (!bucket) return 0
  if (state.metric === "volume") return Math.max(0, bucket.viewers)
  if (state.scope === "topFocus") {
    const total = Math.max(1, view.topTotal[bucketIndex] ?? 0)
    return Math.max(0, bucket.viewers) / total
  }
  return Math.max(0, bucket.share)
}

function chartGeometry(width: number, height: number): ChartGeometry {
  const compact = width < 720
  const left = compact ? 34 : 46
  const right = compact ? 10 : 16
  const top = compact ? 14 : 18
  const bottom = compact ? 28 : 34
  return {
    left,
    right,
    top,
    bottom,
    width: Math.max(1, width - left - right),
    height: Math.max(1, height - top - bottom),
  }
}

function xForBucket(bucketIndex: number, view: ViewModel, geom: ChartGeometry): number {
  const count = Math.max(1, view.visibleEnd - view.visibleStart + 1)
  return geom.left + ((bucketIndex - view.visibleStart) / Math.max(1, count - 1)) * geom.width
}

function yForValue(value: number, view: ViewModel, geom: ChartGeometry): number {
  return geom.top + geom.height - (value / Math.max(1, view.yMax)) * geom.height
}

function fillBandBars(
  ctx: CanvasRenderingContext2D,
  band: DayFlowBandSeries,
  bandIndex: number,
  cumulative: number[],
  view: ViewModel,
  state: ViewState,
  geom: ChartGeometry,
): void {
  const count = Math.max(1, view.visibleEnd - view.visibleStart + 1)
  const barW = Math.max(1, geom.width / count + 0.8)
  const alpha = alphaForBand(band, bandIndex, state)
  if (alpha <= 0) return

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = band.color
  for (let i = view.visibleStart; i <= view.visibleEnd; i += 1) {
    const local = i - view.visibleStart
    const x = geom.left + (local / count) * geom.width
    const value = valueForBand(band, i, view, state)
    const lower = cumulative[i] ?? 0
    const upper = lower + value
    const y = yForValue(upper, view, geom)
    const h = Math.max(0, yForValue(lower, view, geom) - y)
    if (h > 0.3) ctx.fillRect(x, y, barW, h)
    cumulative[i] = upper
  }
  ctx.restore()
}

function drawObservedSilhouette(
  ctx: CanvasRenderingContext2D,
  view: ViewModel,
  state: ViewState,
  geom: ChartGeometry,
): void {
  if (state.scope !== "full") return
  const count = Math.max(1, view.visibleEnd - view.visibleStart + 1)
  const barW = Math.max(1, geom.width / count + 0.8)
  ctx.save()
  ctx.fillStyle = "#475569"
  ctx.globalAlpha = 0.22
  for (let i = view.visibleStart; i <= view.visibleEnd; i += 1) {
    const local = i - view.visibleStart
    const x = geom.left + (local / count) * geom.width
    const value = state.metric === "share" ? 1 : (view.observedTotal[i] ?? 0)
    const y = yForValue(value, view, geom)
    const h = geom.top + geom.height - y
    if (h > 0) ctx.fillRect(x, y, barW, h)
  }
  ctx.restore()
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, view: ViewModel, state: ViewState, geom: ChartGeometry): void {
  ctx.fillStyle = "#07101D"
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = "rgba(148, 163, 184, 0.10)"
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i += 1) {
    const y = geom.top + (geom.height / 4) * i
    ctx.beginPath()
    ctx.moveTo(geom.left, y)
    ctx.lineTo(geom.left + geom.width, y)
    ctx.stroke()
  }
  for (let i = 0; i <= 6; i += 1) {
    const x = geom.left + (geom.width / 6) * i
    ctx.beginPath()
    ctx.moveTo(x, geom.top)
    ctx.lineTo(x, geom.top + geom.height)
    ctx.stroke()
  }

  ctx.strokeStyle = "rgba(203, 213, 225, 0.16)"
  ctx.strokeRect(geom.left, geom.top, geom.width, geom.height)

  ctx.fillStyle = "rgba(203, 213, 225, 0.72)"
  ctx.font = "12px ui-sans-serif, system-ui"
  ctx.fillText(state.metric === "share" ? (view.shareBasis === "topN" ? "Top N share" : "Global share") : "Volume", 8, 17)
  ctx.fillText(isoTimeLabel(view.payload.buckets[view.visibleStart]), geom.left, height - 9)
  ctx.fillText(isoTimeLabel(view.payload.buckets[view.visibleEnd]), Math.max(geom.left, width - 58), height - 9)
}

function drawCursor(ctx: CanvasRenderingContext2D, view: ViewModel, geom: ChartGeometry): void {
  const x = xForBucket(view.selectedIndex, view, geom)
  ctx.save()
  ctx.strokeStyle = "rgba(226, 232, 240, 0.88)"
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(x, geom.top)
  ctx.lineTo(x, geom.top + geom.height)
  ctx.stroke()
  ctx.fillStyle = "rgba(15, 23, 42, 0.88)"
  ctx.fillRect(x + 6, geom.top + 8, 52, 20)
  ctx.fillStyle = "#E2E8F0"
  ctx.font = "12px ui-sans-serif, system-ui"
  ctx.fillText(isoTimeLabel(view.payload.buckets[view.selectedIndex]), x + 10, geom.top + 22)
  ctx.restore()
}

function drawLabels(ctx: CanvasRenderingContext2D, view: ViewModel, state: ViewState, geom: ChartGeometry): void {
  const selectedIndex = view.selectedIndex
  const mobile = geom.width < 620
  const labelBands = view.topBands.slice(0, mobile ? 3 : 6)
  const cumulative = new Array<number>(view.payload.buckets.length).fill(0)
  const x = xForBucket(selectedIndex, view, geom)

  ctx.save()
  for (let bandIndex = 0; bandIndex < view.visibleBands.length; bandIndex += 1) {
    const band = view.visibleBands[bandIndex]
    const value = valueForBand(band, selectedIndex, view, state)
    const lower = cumulative[selectedIndex] ?? 0
    const upper = lower + value
    cumulative[selectedIndex] = upper
    if (!labelBands.some((item) => item.streamerId === band.streamerId)) continue
    if (value / Math.max(1, view.yMax) < (mobile ? 0.08 : 0.045)) continue
    const y = (yForValue(lower, view, geom) + yForValue(upper, view, geom)) / 2
    const label = band.name.length > 18 ? `${band.name.slice(0, 17)}…` : band.name
    ctx.font = "11px ui-sans-serif, system-ui"
    const labelW = Math.min(144, ctx.measureText(label).width + 14)
    ctx.fillStyle = "rgba(7, 16, 29, 0.82)"
    ctx.fillRect(x + 8, y - 9, labelW, 18)
    ctx.fillStyle = "rgba(226, 232, 240, 0.92)"
    ctx.fillText(label, x + 14, y + 4)
  }
  ctx.restore()
}

function drawSelectedOutline(ctx: CanvasRenderingContext2D, view: ViewModel, state: ViewState, geom: ChartGeometry): void {
  if (!state.selectedStreamerId) return
  const bandIndex = view.visibleBands.findIndex((band) => band.streamerId === state.selectedStreamerId)
  if (bandIndex < 0) return
  const cumulative = new Array<number>(view.payload.buckets.length).fill(0)
  for (let i = 0; i < bandIndex; i += 1) {
    const band = view.visibleBands[i]
    for (let bucket = view.visibleStart; bucket <= view.visibleEnd; bucket += 1) {
      cumulative[bucket] += valueForBand(band, bucket, view, state)
    }
  }
  const selected = view.visibleBands[bandIndex]
  const count = Math.max(1, view.visibleEnd - view.visibleStart + 1)
  const barW = Math.max(1, geom.width / count + 0.8)

  ctx.save()
  ctx.strokeStyle = "rgba(248, 250, 252, 0.74)"
  ctx.lineWidth = 1.4
  ctx.shadowColor = selected.color
  ctx.shadowBlur = 10
  for (let i = view.visibleStart; i <= view.visibleEnd; i += 1) {
    const local = i - view.visibleStart
    const x = geom.left + (local / count) * geom.width
    const value = valueForBand(selected, i, view, state)
    const lower = cumulative[i] ?? 0
    const upper = lower + value
    const y = yForValue(upper, view, geom)
    const h = Math.max(0, yForValue(lower, view, geom) - y)
    if (h > 2) ctx.strokeRect(x, y, barW, h)
  }
  ctx.restore()
}

function drawDayFlowChart(canvas: HTMLCanvasElement, getView: () => ViewModel, getState: () => ViewState): { redraw: () => void; destroy: () => void } {
  const host: CanvasHost = createCanvasHost(canvas, { maxDpr: 2 })
  let frame = 0

  const redraw = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      host.resize()
      const { ctx, width, height } = host.get()
      const view = getView()
      const state = getState()
      const geom = chartGeometry(width, height)
      const cumulative = new Array<number>(view.payload.buckets.length).fill(0)

      ctx.clearRect(0, 0, width, height)
      drawGrid(ctx, width, height, view, state, geom)
      drawObservedSilhouette(ctx, view, state, geom)
      view.visibleBands.forEach((band, index) => fillBandBars(ctx, band, index, cumulative, view, state, geom))
      drawSelectedOutline(ctx, view, state, geom)
      drawCursor(ctx, view, geom)
      drawLabels(ctx, view, state, geom)
    })
  }

  const ro = new ResizeObserver(redraw)
  ro.observe(canvas)
  redraw()

  return {
    redraw,
    destroy: () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      host.destroy()
    },
  }
}

function pickBandFromCanvas(canvas: HTMLCanvasElement, event: PointerEvent | MouseEvent, view: ViewModel, state: ViewState): { bucketIndex: number; band: DayFlowBandSeries | null } {
  const rect = canvas.getBoundingClientRect()
  const geom = chartGeometry(rect.width, rect.height)
  const x = clamp(event.clientX - rect.left, geom.left, geom.left + geom.width)
  const y = clamp(event.clientY - rect.top, geom.top, geom.top + geom.height)
  const ratioX = (x - geom.left) / Math.max(1, geom.width)
  const bucketIndex = clamp(
    Math.round(view.visibleStart + ratioX * Math.max(1, view.visibleEnd - view.visibleStart)),
    view.visibleStart,
    view.visibleEnd,
  )
  const valueAtPointer = ((geom.top + geom.height - y) / Math.max(1, geom.height)) * view.yMax
  let acc = 0
  for (const band of view.visibleBands) {
    const value = valueForBand(band, bucketIndex, view, state)
    const next = acc + value
    if (valueAtPointer >= acc && valueAtPointer <= next) return { bucketIndex, band }
    acc = next
  }
  return { bucketIndex, band: null }
}

function focusRows(view: ViewModel, state: ViewState, bucketIndex: number): FocusRow[] {
  const rows = view.topBands
    .map((band) => {
      const curr = band.buckets[bucketIndex]
      const prev = band.buckets[Math.max(0, bucketIndex - 1)]
      const viewers = curr?.viewers ?? 0
      const share = state.scope === "topFocus"
        ? viewers / Math.max(1, view.topTotal[bucketIndex] ?? 0)
        : (curr?.share ?? 0)
      return {
        band,
        viewers,
        share,
        momentum: viewers - (prev?.viewers ?? 0),
      }
    })
    .sort((a, b) => b.viewers - a.viewers)
    .slice(0, 5)

  const maxViewers = Math.max(1, ...rows.map((row) => row.viewers))
  return rows.map((row, index) => ({
    rank: index + 1,
    band: row.band,
    viewers: row.viewers,
    share: row.share,
    momentum: row.momentum,
    gapToPrev: index === 0 ? null : rows[index - 1].viewers - row.viewers,
    gapToNext: index === rows.length - 1 ? null : row.viewers - rows[index + 1].viewers,
    barRatio: row.viewers / maxViewers,
  }))
}

function renderTimeFocus(view: ViewModel, state: ViewState): string {
  const rows = focusRows(view, state, view.selectedIndex)
  const selectedTime = isoTimeLabel(view.payload.buckets[view.selectedIndex])
  const shareNote = view.shareBasis === "topN" ? "Top N share" : "Global share"
  const strongestMomentum = [...rows].sort((a, b) => b.momentum - a.momentum)[0]
  const activityText = view.payload.activity.available ? view.payload.focusSnapshot.highestActivity : "Activity unavailable"

  return `
    <div class="vldf-focus-head">
      <div><span>Selected time</span><strong>${selectedTime} UTC</strong></div>
      <div><span>Share basis</span><strong>${shareNote}</strong></div>
    </div>
    <div class="vldf-focus-list">
      ${rows.map((row) => `
        <button type="button" class="vldf-focus-row" data-streamer-id="${escapeHtml(row.band.streamerId)}">
          <span class="vldf-focus-rank">#${row.rank}</span>
          <span class="vldf-focus-color" style="--band-color:${row.band.color}"></span>
          <span class="vldf-focus-name">${escapeHtml(row.band.name)}</span>
          <span class="vldf-focus-bar"><i style="width:${Math.round(row.barRatio * 100)}%"></i></span>
          <strong>${numberFmt.format(row.viewers)}</strong>
          <small>${pctFmt.format(row.share)}${row.gapToNext !== null && row.rank === 1 ? ` · +${numberFmt.format(row.gapToNext)} vs #2` : ""}</small>
        </button>
      `).join("")}
    </div>
    <div class="vldf-focus-meta">
      <span>Strongest momentum: <strong>${escapeHtml(strongestMomentum?.band.name ?? "N/A")}</strong></span>
      <span>Highest activity: <strong>${escapeHtml(activityText)}</strong></span>
    </div>
  `
}

function renderDetail(view: ViewModel, state: ViewState, mobile = false): string {
  const id = state.selectedStreamerId ?? view.payload.detailPanelSource.defaultStreamerId
  const detail = view.payload.detailPanelSource.streamers.find((item) => item.streamerId === id)
  if (!detail) {
    return `<h2>Selected Stream</h2><p class="muted">Select a band to inspect stream details.</p>`
  }
  const band = view.topBands.find((item) => item.streamerId === detail.streamerId)
  return `
    <div class="vldf-detail-head">
      <h2>Selected Stream</h2>
      ${band ? `<span class="vldf-detail-dot" style="--band-color:${band.color}"></span>` : ""}
    </div>
    <h3>${escapeHtml(detail.name)}</h3>
    <p class="vldf-detail-title">${escapeHtml(detail.title || "No title")}</p>
    <div class="kv vldf-detail-kv">
      <div class="kv-row"><span>Window peak viewers</span><strong>${numberFmt.format(detail.peakViewers)}</strong></div>
      <div class="kv-row"><span>Avg viewers</span><strong>${numberFmt.format(detail.avgViewers)}</strong></div>
      <div class="kv-row"><span>Viewer-minutes</span><strong>${numberFmt.format(detail.viewerMinutes)}</strong></div>
      <div class="kv-row"><span>Peak share</span><strong>${pctFmt.format(detail.peakShare)}</strong></div>
      <div class="kv-row"><span>Biggest rise time</span><strong>${isoTimeLabel(detail.biggestRiseTime)}</strong></div>
      <div class="kv-row"><span>First / Last seen</span><strong>${isoTimeLabel(detail.firstSeen)} / ${isoTimeLabel(detail.lastSeen)}</strong></div>
    </div>
    <div class="actions vldf-detail-actions">
      ${mobile ? "" : `<button type="button" class="action" data-action="toggle-dim">${state.dimOthers ? "Dim others: on" : "Dim others: off"}</button>`}
      <a class="action" href="${escapeHtml(detail.url)}" target="_blank" rel="noreferrer">Open stream</a>
      ${mobile ? `<button type="button" class="action" data-action="close-sheet">Close</button>` : ""}
    </div>
  `
}

function renderSummary(payload: DayFlowPayload): string {
  const unavailable = payload.summary.highestActivity.toLowerCase().includes("unavailable")
  return `
    <section class="summary-strip summary-strip--dayflow page-section">
      <div class="summary-item"><strong>Peak leader</strong><span>${escapeHtml(payload.summary.peakLeader)}</span></div>
      <div class="summary-item"><strong>Longest dominance</strong><span>${escapeHtml(payload.summary.longestDominance)}</span></div>
      <div class="summary-item ${unavailable ? "summary-item--quiet" : ""}"><strong>Highest activity</strong><span>${escapeHtml(payload.summary.highestActivity)}</span></div>
      <div class="summary-item"><strong>Biggest rise</strong><span>${escapeHtml(payload.summary.biggestRise)}</span></div>
    </section>
  `
}

function scopeNote(state: ViewState, view?: ViewModel): string {
  if (state.scope === "topFocus") {
    return state.metric === "share"
      ? "Top Focus excludes Others from chart scale. Share is within selected Top N, not global share."
      : "Top Focus excludes Others from chart scale to compare top streams. Use Full for observed total context."
  }
  if (view?.others) {
    return "Full includes Others for observed total context. Others is shown as a low-emphasis background silhouette."
  }
  return "Full keeps the observed total context."
}

function renderControls(state: ViewState): string {
  return `
    <form id="dayflow-controls" class="controls vldf-controls">
      <label>Range
        <select name="day">
          <option value="today" ${state.rangeMode === "today" ? "selected" : ""}>Today</option>
          <option value="rolling24h" ${state.rangeMode === "rolling24h" ? "selected" : ""}>Rolling 24h</option>
          <option value="yesterday" ${state.rangeMode === "yesterday" ? "selected" : ""}>Yesterday</option>
          <option value="date" ${state.rangeMode === "date" ? "selected" : ""}>Date</option>
        </select>
      </label>
      <label>Date
        <input name="date" type="date" value="${escapeHtml(state.selectedDate)}" />
      </label>
      <label>Top
        <select name="top">
          <option value="10" ${state.topN === 10 ? "selected" : ""}>Top 10</option>
          <option value="20" ${state.topN === 20 ? "selected" : ""}>Top 20</option>
          <option value="50" ${state.topN === 50 ? "selected" : ""}>Top 50</option>
        </select>
      </label>
      <label>Metric
        <select name="metric">
          <option value="volume" ${state.metric === "volume" ? "selected" : ""}>Volume</option>
          <option value="share" ${state.metric === "share" ? "selected" : ""}>Share</option>
        </select>
      </label>
      <label>Scope
        <select name="scope">
          <option value="full" ${state.scope === "full" ? "selected" : ""}>Full</option>
          <option value="topFocus" ${state.scope === "topFocus" ? "selected" : ""}>Top Focus</option>
        </select>
      </label>
      <label>Bucket
        <select name="bucket">
          <option value="5" ${state.bucketSize === 5 ? "selected" : ""}>5m</option>
          <option value="10" ${state.bucketSize === 10 ? "selected" : ""}>10m</option>
        </select>
      </label>
      <label>Layout
        <select name="layout">
          <option value="wide" ${state.layout === "wide" ? "selected" : ""}>Wide</option>
          <option value="split" ${state.layout === "split" ? "selected" : ""}>Split</option>
        </select>
      </label>
      <label class="vldf-checkbox"><input name="autoUpdate" type="checkbox" ${state.autoUpdate ? "checked" : ""} /> Auto update</label>
      <button class="action" type="submit">Refresh</button>
    </form>
  `
}

function renderDataNote(payload: DayFlowPayload, state: ViewState, view: ViewModel): string {
  const partialText = payload.partialNote ? ` Partial coverage: ${payload.partialNote}.` : ""
  return `
    <section class="card vldf-state-card" data-state="${payload.state}">
      <div class="vldf-state-head">
        <h2>Data State</h2>
        <span class="status-chip" data-state="${payload.state}">${escapeHtml(payload.status)}</span>
      </div>
      <p>${escapeHtml(payload.note ?? "Observed data render from API day rollup.")}</p>
      <p class="muted">${escapeHtml(payload.coverageNote)}.${escapeHtml(partialText)} ${escapeHtml(payload.activity.note)}</p>
      <p class="code-note">${escapeHtml(scopeNote(state, view))}</p>
    </section>
  `
}

function renderFrame(payload: DayFlowPayload, state: ViewState, view: ViewModel): string {
  const title = payload.rangeMode === "rolling24h" ? "Rolling 24h Day Flow" : payload.rangeMode === "yesterday" ? "Yesterday Day Flow" : payload.rangeMode === "date" ? "Selected Day Flow" : "Today Day Flow"
  return `
    ${renderSummary(payload)}
    ${renderDataNote(payload, state, view)}
    <section class="vldf-layout vldf-layout--${state.layout}">
      <section class="card vldf-main-card">
        <div class="vldf-main-head">
          <div>
            <h2>${title}</h2>
            <p>${escapeHtml(scopeNote(state, view))}</p>
          </div>
          <div class="vldf-pills">
            <span><strong>Range</strong> ${payload.isRolling ? `${isoTimeLabel(payload.windowStart)} → ${isoTimeLabel(payload.windowEnd)} UTC` : escapeHtml(payload.selectedDate)}</span>
            <span><strong>Metric</strong> ${state.metric === "share" ? "Share" : "Volume"}</span>
            <span><strong>Scope</strong> ${state.scope === "topFocus" ? "Top Focus" : "Full"}</span>
            <span><strong>Bucket</strong> ${payload.bucketSize}m</span>
            <span><strong>Updated</strong> ${isoTimeLabel(payload.lastUpdated)} UTC</span>
          </div>
        </div>
        <div class="vldf-chart-wrap">
          <div id="dayflow-loading" class="vldf-overlay" hidden>Updating…</div>
          <canvas id="dayflow-canvas" class="vldf-canvas" aria-label="ViewLoom Day Flow chart"></canvas>
        </div>
        <div class="vldf-time-wrap">
          <span>Time selection</span>
          <input id="dayflow-time" type="range" min="${view.visibleStart}" max="${view.visibleEnd}" step="1" value="${view.selectedIndex}" />
        </div>
        <section id="dayflow-focus-mobile" class="card vldf-focus-mobile"></section>
        <button id="dayflow-open-sheet" class="action vldf-open-sheet" type="button">Open detail</button>
      </section>
      <aside class="vldf-side">
        <section class="card vldf-focus-card"><h2>Time Focus</h2><div id="dayflow-focus"></div></section>
        <section class="card vldf-detail-card" id="dayflow-detail"></section>
      </aside>
    </section>
    <dialog id="dayflow-sheet" class="vldf-sheet"><section class="card" id="dayflow-detail-mobile"></section></dialog>
  `
}

function readPayloadCache(): DayFlowPayload | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DayFlowPayload>
    return parsed?.ok === true && parsed?.tool === "day-flow" ? parsed as DayFlowPayload : null
  } catch {
    return null
  }
}

function writePayloadCache(payload: DayFlowPayload): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    // ignore cache failures
  }
}

function setLoading(root: HTMLElement, loading: boolean): void {
  const overlay = root.querySelector<HTMLElement>("#dayflow-loading")
  if (overlay) overlay.hidden = !loading
}

async function fetchPayload(state: ViewState): Promise<DayFlowPayload> {
  const request = () => getDayFlowPayload({
    day: state.rangeMode,
    date: state.selectedDate,
    top: state.topN,
    mode: state.metric,
    bucket: state.bucketSize,
  })
  let payload = await request()
  const hasExplicitQuery = new URL(window.location.href).searchParams.size > 0
  if (payload.state === "empty" && state.rangeMode === "today" && !hasExplicitQuery) {
    const fallback = await getDayFlowPayload({
      day: "rolling24h",
      date: state.selectedDate,
      top: state.topN,
      mode: state.metric,
      bucket: state.bucketSize,
    })
    if (fallback.state !== "empty") {
      state.rangeMode = "rolling24h"
      payload = fallback
    }
  }
  return payload
}

function wireInteractions(
  frame: HTMLElement,
  state: ViewState,
  getView: () => ViewModel,
  redraw: () => void,
  rerenderPanels: () => void,
): void {
  const canvas = frame.querySelector<HTMLCanvasElement>("#dayflow-canvas")
  const slider = frame.querySelector<HTMLInputElement>("#dayflow-time")
  const sheet = frame.querySelector<HTMLDialogElement>("#dayflow-sheet")
  const openSheet = frame.querySelector<HTMLButtonElement>("#dayflow-open-sheet")
  if (!canvas || !slider) return

  const applyBucket = (bucketIndex: number) => {
    const view = getView()
    state.selectedBucketIndex = clamp(bucketIndex, view.visibleStart, view.visibleEnd)
    slider.value = String(state.selectedBucketIndex)
    rerenderPanels()
    redraw()
  }

  slider.addEventListener("input", () => applyBucket(Number(slider.value)))

  canvas.addEventListener("pointerdown", (event) => {
    const picked = pickBandFromCanvas(canvas, event, getView(), state)
    state.selectedBucketIndex = picked.bucketIndex
    if (picked.band) state.selectedStreamerId = picked.band.streamerId
    slider.value = String(state.selectedBucketIndex)
    rerenderPanels()
    redraw()
  })

  frame.addEventListener("click", (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const row = target.closest<HTMLElement>("[data-streamer-id]")
    if (row?.dataset.streamerId) {
      state.selectedStreamerId = row.dataset.streamerId
      rerenderPanels()
      redraw()
      return
    }
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action
    if (action === "toggle-dim") {
      state.dimOthers = !state.dimOthers
      rerenderPanels()
      redraw()
    } else if (action === "close-sheet") {
      sheet?.close()
    }
  })

  openSheet?.addEventListener("click", () => {
    rerenderPanels()
    if (sheet && !sheet.open) sheet.showModal()
  })
}

function renderPanels(frame: HTMLElement, view: ViewModel, state: ViewState): void {
  const focus = frame.querySelector<HTMLElement>("#dayflow-focus")
  const focusMobile = frame.querySelector<HTMLElement>("#dayflow-focus-mobile")
  const detail = frame.querySelector<HTMLElement>("#dayflow-detail")
  const detailMobile = frame.querySelector<HTMLElement>("#dayflow-detail-mobile")
  const focusHtml = renderTimeFocus(view, state)
  if (focus) focus.innerHTML = focusHtml
  if (focusMobile) focusMobile.innerHTML = `<h2>Time Focus</h2>${focusHtml}`
  if (detail) detail.innerHTML = renderDetail(view, state)
  if (detailMobile) detailMobile.innerHTML = renderDetail(view, state, true)
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    .vldf-controls { align-items: end; }
    .vldf-controls label { display: grid; gap: 6px; color: var(--muted); font-size: 12px; }
    .vldf-controls select, .vldf-controls input[type="date"] { min-height: 38px; border: 1px solid rgba(122,162,255,.18); border-radius: 12px; background: rgba(7,16,29,.92); color: var(--text); padding: 0 10px; }
    .vldf-checkbox { display: flex !important; align-items: center; grid-auto-flow: column; gap: 8px !important; min-height: 38px; }
    .vldf-state-card { margin: 16px 0; }
    .vldf-state-head, .vldf-main-head, .vldf-detail-head, .vldf-focus-head { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; }
    .vldf-state-head h2, .vldf-main-head h2, .vldf-focus-card h2, .vldf-detail-card h2 { margin: 0; }
    .vldf-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 360px); gap: 16px; margin-top: 16px; }
    .vldf-layout--wide { grid-template-columns: minmax(0, 1fr); }
    .vldf-layout--wide .vldf-side { grid-template-columns: minmax(0, 1fr) minmax(280px, 420px); }
    .vldf-side { display: grid; gap: 16px; align-content: start; }
    .vldf-main-head { margin-bottom: 14px; }
    .vldf-main-head p { margin: 6px 0 0; color: var(--muted); line-height: 1.6; }
    .vldf-pills { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
    .vldf-pills span { border: 1px solid rgba(122,162,255,.14); background: rgba(7,16,29,.58); border-radius: 999px; padding: 7px 10px; color: var(--muted); font-size: 12px; }
    .vldf-pills strong { color: var(--text); margin-right: 4px; }
    .vldf-chart-wrap { position: relative; min-height: 520px; border-radius: 20px; overflow: hidden; border: 1px solid rgba(122,162,255,.12); background: #07101D; }
    .vldf-canvas { width: 100%; height: 520px; display: block; cursor: crosshair; touch-action: pan-y; }
    .vldf-overlay { position: absolute; top: 12px; right: 12px; z-index: 2; padding: 8px 10px; border-radius: 999px; background: rgba(15,23,42,.86); border: 1px solid rgba(148,163,184,.22); color: var(--text); }
    .vldf-time-wrap { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: center; margin-top: 12px; color: var(--muted); }
    .vldf-time-wrap input { width: 100%; }
    .vldf-focus-head { margin-bottom: 12px; }
    .vldf-focus-head span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 4px; }
    .vldf-focus-list { display: grid; gap: 8px; }
    .vldf-focus-row { display: grid; grid-template-columns: 32px 12px minmax(0, 1fr) minmax(64px, .5fr) auto; gap: 8px; align-items: center; width: 100%; border: 1px solid rgba(122,162,255,.12); background: rgba(7,16,29,.42); color: var(--text); border-radius: 13px; padding: 9px; text-align: left; }
    .vldf-focus-row small { grid-column: 3 / -1; color: var(--muted); }
    .vldf-focus-rank { color: var(--muted); }
    .vldf-focus-color, .vldf-detail-dot { width: 10px; height: 10px; border-radius: 999px; background: var(--band-color); box-shadow: 0 0 16px var(--band-color); }
    .vldf-focus-name { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .vldf-focus-bar { height: 7px; border-radius: 999px; background: rgba(148,163,184,.16); overflow: hidden; }
    .vldf-focus-bar i { display: block; height: 100%; border-radius: inherit; background: rgba(125,211,252,.7); }
    .vldf-focus-meta { display: grid; gap: 6px; margin-top: 12px; color: var(--muted); font-size: 13px; }
    .vldf-focus-mobile, .vldf-open-sheet { display: none; }
    .vldf-detail-head { align-items: center; }
    .vldf-detail-title { color: var(--muted); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .vldf-detail-kv { margin-top: 12px; }
    .vldf-detail-actions { margin-top: 14px; }
    .vldf-sheet { width: min(94vw, 560px); border: 0; padding: 0; background: transparent; color: var(--text); }
    .vldf-sheet::backdrop { background: rgba(0, 0, 0, .58); }
    @media (max-width: 900px) {
      .vldf-layout, .vldf-layout--wide .vldf-side { grid-template-columns: 1fr; }
      .vldf-chart-wrap { min-height: 380px; }
      .vldf-canvas { height: 380px; }
      .vldf-pills { justify-content: flex-start; }
    }
    @media (max-width: 640px) {
      .vldf-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .vldf-controls .action { grid-column: 1 / -1; }
      .vldf-chart-wrap { min-height: 300px; }
      .vldf-canvas { height: 300px; }
      .vldf-side { display: none; }
      .vldf-focus-mobile, .vldf-open-sheet { display: block; margin-top: 12px; }
      .vldf-focus-row { grid-template-columns: 30px 10px minmax(0, 1fr) auto; }
      .vldf-focus-bar { grid-column: 3 / -1; }
      .vldf-time-wrap { grid-template-columns: 1fr; }
      .summary-strip--dayflow { grid-template-columns: 1fr; }
    }
  `
  document.head.appendChild(style)
}

export function renderDayFlowPage(root: HTMLElement): void {
  ensureStyles()
  const state = getInitialState()
  let payload: DayFlowPayload | null = readPayloadCache()
  let view: ViewModel | null = payload ? buildViewModel(payload, state) : null
  let renderer: { redraw: () => void; destroy: () => void } | null = null
  let autoTimer = 0

  const rerenderPanels = () => {
    const frame = root.querySelector<HTMLElement>("#dayflow-content")
    if (!frame || !view) return
    view = buildViewModel(view.payload, state)
    state.selectedBucketIndex = view.selectedIndex
    renderPanels(frame, view, state)
  }

  const redraw = () => renderer?.redraw()

  const mountChart = () => {
    const frame = root.querySelector<HTMLElement>("#dayflow-content")
    const canvas = frame?.querySelector<HTMLCanvasElement>("#dayflow-canvas")
    if (!frame || !canvas || !view) return
    renderer?.destroy()
    renderer = drawDayFlowChart(canvas, () => view as ViewModel, () => state)
    renderPanels(frame, view, state)
    wireInteractions(frame, state, () => view as ViewModel, redraw, rerenderPanels)
  }

  const renderShell = () => {
    root.innerHTML = `
      ${renderHeader("day-flow")}
      <main class="container">
        ${renderHero({
          eyebrow: "Today · Day Flow",
          title: "Read the day as a landscape",
          subtitle: "See when the observed audience was large, who owned each hour, and switch between total context and Top Focus.",
          note: "Wide is the primary layout. Split is kept as a later layout mode.",
          actions: [
            { href: "/heatmap/", label: "Open Heatmap" },
            { href: "/battle-lines/", label: "Open Rivalry Radar" },
          ],
        })}
        ${renderStatusNote({
          eyebrow: "ViewLoom mode",
          title: "Full / Top Focus are separate from Volume / Share",
          body: "Full keeps Others as observed context. Top Focus removes Others from the chart scale so top streams are easier to compare.",
          items: ["Layout: Wide / Split", "Metric: Volume / Share", "Scope: Full / Top Focus"],
        })}
        ${renderControls(state)}
        <section id="dayflow-content">${view ? renderFrame(view.payload, state, view) : `<section class="card"><p>Loading Day Flow…</p></section>`}</section>
      </main>
      ${renderFooter()}
    `
    if (view) mountChart()
  }

  const load = async (quiet = false) => {
    const content = root.querySelector<HTMLElement>("#dayflow-content")
    try {
      if (quiet && content) setLoading(content, true)
      payload = await fetchPayload(state)
      writePayloadCache(payload)
      view = buildViewModel(payload, state)
      state.selectedBucketIndex = view.selectedIndex
      updateUrl(state)
      const nextContent = root.querySelector<HTMLElement>("#dayflow-content")
      if (nextContent) nextContent.innerHTML = renderFrame(payload, state, view)
      mountChart()
    } catch (error) {
      const cached = payload ?? readPayloadCache()
      if (cached) {
        payload = cached
        view = buildViewModel(cached, state)
        const nextContent = root.querySelector<HTMLElement>("#dayflow-content")
        if (nextContent) {
          nextContent.innerHTML = `${renderFrame(cached, state, view)}<section class="card vldf-state-card"><p class="code-note">Update failed. Showing last good chart.</p></section>`
        }
        mountChart()
      } else {
        const nextContent = root.querySelector<HTMLElement>("#dayflow-content")
        if (nextContent) nextContent.innerHTML = `<section class="card"><h2>Day Flow unavailable</h2><p class="muted">${escapeHtml(error instanceof Error ? error.message : "Unknown error")}</p></section>`
      }
    } finally {
      const nextContent = root.querySelector<HTMLElement>("#dayflow-content")
      if (nextContent) setLoading(nextContent, false)
    }
  }

  const syncStateFromForm = (form: HTMLFormElement) => {
    const data = new FormData(form)
    state.rangeMode = normalizeRange(data.get("day"))
    state.selectedDate = String(data.get("date") || todayIso())
    state.topN = normalizeTop(data.get("top"))
    state.metric = normalizeMetric(data.get("metric"))
    state.scope = normalizeScope(data.get("scope"))
    state.bucketSize = normalizeBucket(data.get("bucket"))
    state.layout = normalizeLayout(data.get("layout"))
    state.autoUpdate = data.get("autoUpdate") === "on"
    window.localStorage.setItem("viewloom.dayflow.autoUpdate", String(state.autoUpdate))
  }

  root.addEventListener("submit", (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || form.id !== "dayflow-controls") return
    event.preventDefault()
    syncStateFromForm(form)
    renderShell()
    void load(true)
  })

  root.addEventListener("change", (event) => {
    const target = event.target
    const form = target instanceof Element ? target.closest<HTMLFormElement>("#dayflow-controls") : null
    if (!form) return
    syncStateFromForm(form)
    if (target instanceof HTMLSelectElement && (target.name === "scope" || target.name === "layout")) {
      if (view) {
        view = buildViewModel(view.payload, state)
        state.selectedBucketIndex = view.selectedIndex
        updateUrl(state)
        const content = root.querySelector<HTMLElement>("#dayflow-content")
        if (content) content.innerHTML = renderFrame(view.payload, state, view)
        mountChart()
      }
      return
    }
    void load(true)
  })

  const startAuto = () => {
    window.clearInterval(autoTimer)
    autoTimer = window.setInterval(() => {
      if (state.autoUpdate && state.rangeMode === "today" && document.visibilityState === "visible") {
        void load(true)
      }
    }, 60_000)
  }

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") renderer?.redraw()
  })

  renderShell()
  void load(!view)
  startAuto()
}
