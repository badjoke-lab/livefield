import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"
import { createCanvasHost } from "../../shared/canvas/canvas-host"
import { getDayFlowPayload } from "../../shared/api/day-flow-api"
import type { DayFlowPayload, DayFlowBandSeries } from "../../../../../packages/shared/src/types/day-flow"
import {
  resolveObservedWindowState,
  resolveViewportRange,
  type ChartViewportMode
} from "../../shared/runtime/observed-window"

const numberFmt = new Intl.NumberFormat("en-US")
const pctFmt = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 })

type UiFilters = {
  day: "today" | "rolling24h" | "yesterday" | "date"
  date: string
  top: 10 | 20 | 50
  mode: "volume" | "share"
  bucket: 5 | 10
}

type DayFlowViewState = {
  rangeMode: UiFilters["day"]
  selectedDate: string
  topN: UiFilters["top"]
  valueMode: UiFilters["mode"]
  bucketSize: UiFilters["bucket"]
  selectedBucketIndex: number
  selectedStreamerId: string | null
  autoUpdateEnabled: boolean
  isolate: boolean
  viewportPreference: ChartViewportMode | null
}

type DayFlowViewport = {
  mode: ChartViewportMode
  sparseToday: boolean
  observedSinceLabel: string | null
  startIndex: number
  endIndex: number
}

type DayFlowMountController = {
  payload: DayFlowPayload
  syncViewState: () => void
  updatePayload: (nextPayload: DayFlowPayload) => void
  showNotice: (kind: "updating" | "error" | null, message?: string) => void
  destroy: () => void
}

const DAY_FLOW_CACHE_KEY = "livefield.dayflow.last-good.v1"

function isDayFlowPayloadLike(value: unknown): value is DayFlowPayload {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<DayFlowPayload>
  return candidate.ok === true
    && candidate.tool === "day-flow"
    && typeof candidate.state === "string"
    && typeof candidate.status === "string"
    && typeof candidate.lastUpdated === "string"
    && typeof candidate.coverageNote === "string"
    && typeof candidate.rangeMode === "string"
    && typeof candidate.bucketSize === "number"
    && typeof candidate.topN === "number"
    && !!candidate.summary
    && !!candidate.focusSnapshot
    && !!candidate.detailPanelSource
    && Array.isArray(candidate.bands)
    && Array.isArray(candidate.buckets)
    && Array.isArray(candidate.totalViewersByBucket)
}

function readCachedPayload(): DayFlowPayload | null {
  try {
    const raw = window.localStorage.getItem(DAY_FLOW_CACHE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isDayFlowPayloadLike(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeCachedPayload(payload: DayFlowPayload): void {
  try {
    window.localStorage.setItem(DAY_FLOW_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // ignore storage errors
  }
}

function parseFilters(form: HTMLFormElement): UiFilters {
  const data = new FormData(form)
  return {
    day: (data.get("day") as UiFilters["day"]) ?? "today",
    date: String(data.get("date") ?? ""),
    top: Number(data.get("top") ?? 20) as UiFilters["top"],
    mode: (data.get("mode") as UiFilters["mode"]) ?? "volume",
    bucket: Number(data.get("bucket") ?? 5) as UiFilters["bucket"]
  }
}

function isoTimeLabel(iso: string | null | undefined): string {
  return iso ? iso.slice(11, 16) : "N/A"
}

function getLatestObservedBucketIndex(payload: DayFlowPayload): number {
  for (let idx = payload.buckets.length - 1; idx >= 0; idx -= 1) {
    if ((payload.totalViewersByBucket[idx] ?? 0) > 0) return idx
  }
  return -1
}

function getObservedBucketIndices(payload: DayFlowPayload): number[] {
  const indices: number[] = []
  for (let idx = 0; idx < payload.buckets.length; idx += 1) {
    if ((payload.totalViewersByBucket[idx] ?? 0) > 0) indices.push(idx)
  }
  return indices
}

function resolveDayFlowViewport(payload: DayFlowPayload, preference: ChartViewportMode | null): DayFlowViewport {
  const observedState = resolveObservedWindowState({
    dayMode: payload.rangeMode,
    bucketMinutes: payload.bucketSize,
    buckets: payload.buckets,
    observedIndices: getObservedBucketIndices(payload)
  })
  const mode = payload.rangeMode === "today" ? (preference ?? observedState.defaultMode) : "full-day"
  const range = resolveViewportRange(observedState, mode)
  return {
    mode,
    sparseToday: observedState.isSparseToday,
    observedSinceLabel: observedState.observedSinceLabel,
    startIndex: range.startIndex,
    endIndex: range.endIndex
  }
}

function resolveInitialBucketIndex(payload: DayFlowPayload, preferredBucketIndex: number | null): number {
  if (payload.buckets.length === 0) return 0

  const latestObserved = getLatestObservedBucketIndex(payload)
  const preferred = preferredBucketIndex ?? -1

  if (preferred >= 0 && preferred < payload.buckets.length && (payload.totalViewersByBucket[preferred] ?? 0) > 0) {
    return preferred
  }
  if (latestObserved >= 0) return latestObserved
  return Math.max(0, payload.buckets.length - 1)
}

function renderLegend(payload: DayFlowPayload): string {
  return payload.bands
    .slice(0, 8)
    .map((band) => `<li data-streamer-id="${band.streamerId}"><span class="dayflow-dot" style="background:${band.color}"></span>${band.name}${band.isOthers ? " (Others)" : ""}</li>`)
    .join("")
}

function bandAtPosition(payload: DayFlowPayload, bucketIndex: number, yRatio: number, mode: "volume" | "share"): DayFlowBandSeries | null {
  const maxTotal = Math.max(1, ...payload.totalViewersByBucket)
  let acc = 0
  for (const band of payload.bands) {
    const value = mode === "share" ? (band.buckets[bucketIndex]?.share ?? 0) : ((band.buckets[bucketIndex]?.viewers ?? 0) / maxTotal)
    const next = acc + value
    if (yRatio >= acc && yRatio <= next) return band
    acc = next
  }
  return null
}

function drawChart(
  canvas: HTMLCanvasElement,
  payload: DayFlowPayload,
  viewport: DayFlowViewport,
  getState: () => { selectedBucketIndex: number; selectedStreamerId: string | null; mode: "volume" | "share"; isolate: boolean }
) {
  const host = createCanvasHost(canvas, { maxDpr: 2 })

  const draw = () => {
    const { ctx, width, height } = host.get()
    const pad = { left: 38, right: 10, top: 10, bottom: 24 }
    const chartW = Math.max(1, width - pad.left - pad.right)
    const chartH = Math.max(1, height - pad.top - pad.bottom)
    const { selectedBucketIndex, selectedStreamerId, mode, isolate } = getState()
    const visibleStart = viewport.startIndex
    const visibleEnd = viewport.endIndex
    const visibleCount = Math.max(1, visibleEnd - visibleStart + 1)
    const selectedIndex = Math.max(visibleStart, Math.min(visibleEnd, selectedBucketIndex))
    const maxTotal = Math.max(1, ...payload.totalViewersByBucket)

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = "#0a1120"
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = "rgba(122,162,255,0.12)"
    ctx.strokeRect(pad.left, pad.top, chartW, chartH)

    for (let i = visibleStart; i <= visibleEnd; i += 1) {
      const localIndex = i - visibleStart
      const x = pad.left + (localIndex / Math.max(1, visibleCount - 1)) * chartW
      let yOffset = 0

      for (const band of payload.bands) {
        const val = mode === "share"
          ? (band.buckets[i]?.share ?? 0)
          : ((band.buckets[i]?.viewers ?? 0) / maxTotal)
        const h = val * chartH
        const y = pad.top + chartH - yOffset - h

        ctx.fillStyle = band.color
        const isSelected = selectedStreamerId === band.streamerId
        const isDimmed = isolate && selectedStreamerId && !isSelected
        ctx.globalAlpha = isDimmed ? 0.12 : (selectedStreamerId && !isSelected ? 0.35 : 0.88)
        if (i === visibleStart || i === visibleEnd) {
          ctx.fillRect(x - 1.2, y, 2.4, h)
        } else {
          const nextLocalIndex = Math.min(visibleCount - 1, localIndex + 1)
          const nextX = pad.left + (nextLocalIndex / Math.max(1, visibleCount - 1)) * chartW
          ctx.fillRect(x, y, Math.max(1, nextX - x + 0.6), h)
        }

        yOffset += h
      }
    }
    ctx.globalAlpha = 1

    const sx = pad.left + ((selectedIndex - visibleStart) / Math.max(1, visibleCount - 1)) * chartW
    ctx.strokeStyle = "rgba(210,228,255,0.82)"
    ctx.beginPath()
    ctx.moveTo(sx, pad.top)
    ctx.lineTo(sx, pad.top + chartH)
    ctx.stroke()

    const mobile = width <= 720
    const labels = payload.bands.filter((b) => !b.isOthers).slice(0, mobile ? 2 : 3)
    const others = payload.bands.find((b) => b.isOthers)
    if (others) labels.push(others)

    const selectedLineY = pad.top + 16
    for (const band of labels) {
      const bucket = band.buckets[selectedIndex]
      const ratio = mode === "share" ? bucket?.share ?? 0 : ((bucket?.viewers ?? 0) / maxTotal)
      if (ratio < (mobile ? 0.08 : 0.05)) continue

      let yStart = pad.top + chartH
      for (const candidate of payload.bands) {
        const cBucket = candidate.buckets[selectedIndex]
        const cRatio = mode === "share" ? cBucket?.share ?? 0 : ((cBucket?.viewers ?? 0) / maxTotal)
        yStart -= cRatio * chartH
        if (candidate.streamerId === band.streamerId) {
          const yMid = yStart + (cRatio * chartH) / 2
          if (yMid < pad.top + 12 || yMid > pad.top + chartH - 10) break
          ctx.fillStyle = "rgba(8,16,30,0.86)"
          const text = band.name
          ctx.font = "11px ui-sans-serif"
          const textW = Math.min(130, ctx.measureText(text).width + 10)
          ctx.fillRect(sx + 8, yMid - 8, textW, 16)
          ctx.fillStyle = "#dbe8ff"
          ctx.fillText(text, sx + 12, yMid + 4)
          break
        }
      }
    }

    const markerBands = payload.bands.filter((b) => !b.isOthers).slice(0, mobile ? 2 : 4)
    for (const band of markerBands) {
      const bucket = band.buckets[selectedIndex]
      if (!bucket) continue
      let yStart = pad.top + chartH
      for (const candidate of payload.bands) {
        const cBucket = candidate.buckets[selectedIndex]
        const cRatio = mode === "share" ? cBucket?.share ?? 0 : ((cBucket?.viewers ?? 0) / maxTotal)
        yStart -= cRatio * chartH
        if (candidate.streamerId !== band.streamerId) continue

        const yMid = yStart + (cRatio * chartH) / 2
        if (bucket.peak) {
          ctx.fillStyle = "#83f0b7"
          ctx.beginPath()
          ctx.arc(sx, yMid, mobile ? 3 : 4, 0, Math.PI * 2)
          ctx.fill()
        } else if (bucket.rise && cRatio > 0.05) {
          ctx.fillStyle = "#ff8fbd"
          ctx.beginPath()
          ctx.moveTo(sx, yMid - 4)
          ctx.lineTo(sx + 4, yMid + 4)
          ctx.lineTo(sx - 4, yMid + 4)
          ctx.closePath()
          ctx.fill()
        }
      }
    }

    ctx.fillStyle = "#c9d4f5"
    ctx.font = "12px ui-sans-serif"
    ctx.fillText(isoTimeLabel(payload.buckets[visibleStart]), pad.left - 4, height - 10)
    ctx.fillText(isoTimeLabel(payload.buckets[visibleEnd]), width - 42, height - 10)
    ctx.fillText(mode === "share" ? "Share" : "Volume", 8, 14)
    ctx.fillText(isoTimeLabel(payload.buckets[selectedIndex]), sx + 4, selectedLineY)

  }

  const ro = new ResizeObserver(() => {
    requestAnimationFrame(draw)
  })
  ro.observe(canvas)

  draw()
  return { destroy: () => {
    ro.disconnect()
    host.destroy()
  }, redraw: draw }
}

function renderSummary(payload: DayFlowPayload): string {
  const unavailable = payload.summary.highestActivity.toLowerCase().includes("unavailable")
  return `
    <section class="summary-strip summary-strip--dayflow page-section">
      <div class="summary-item"><strong>Peak leader</strong><span>${payload.summary.peakLeader}</span></div>
      <div class="summary-item"><strong>Longest dominance</strong><span>${payload.summary.longestDominance}</span></div>
      <div class="summary-item ${unavailable ? "summary-item--quiet" : ""}"><strong>Highest activity</strong><span>${payload.summary.highestActivity}</span></div>
      <div class="summary-item"><strong>Biggest rise</strong><span>${payload.summary.biggestRise}</span></div>
    </section>
  `
}

function renderStateNote(payload: DayFlowPayload): string {
  const expanded = payload.state === "error" || payload.state === "empty"
  const partialText = payload.partialNote ? ` · Partial coverage: ${payload.partialNote}` : ""
  return `
    <section class="card dayflow-state-card ${expanded ? "dayflow-state-card--expanded" : ""}">
      <div class="dayflow-state-head">
        <h2>Data</h2>
        <div class="status-chip" data-state="${payload.state}">${payload.status}</div>
      </div>
      <p class="muted">${payload.note ?? "Observed data render from API day rollup."}</p>
      <p class="dayflow-notes-inline">${payload.coverageNote}${partialText} · ${payload.activity.note}</p>
    </section>
  `
}

function renderFrame(payload: DayFlowPayload, viewport: DayFlowViewport): string {
  return `
    <section class="dayflow-status-rail" id="dayflow-status-slot" aria-live="polite">
      <span class="dayflow-status-indicator" id="dayflow-status-indicator" hidden></span>
    </section>
    <section class="grid-2 page-section dayflow-layout">
      <section class="card dayflow-main-card">
        <div class="dayflow-main-head dayflow-meta-strip">
          <h2 id="dayflow-title">${payload.rangeMode === "rolling24h" ? "Rolling 24h Landscape" : payload.rangeMode === "yesterday" ? "Yesterday Landscape" : payload.rangeMode === "date" ? "Selected Day Landscape" : "Today Landscape"}</h2>
          <div class="dayflow-meta-inline">
            <span id="dayflow-range-chip"><strong>Range</strong> ${payload.isRolling ? `${payload.windowStart.slice(11, 16)} → ${payload.windowEnd.slice(11, 16)} UTC` : payload.selectedDate}</span>
            <span id="dayflow-status-chip"><strong>Status</strong> ${payload.status}</span>
            <span id="dayflow-coverage-chip"><strong>Coverage</strong> ${payload.coverageNote}</span>
            <span id="dayflow-bucket-chip"><strong>Bucket</strong> ${payload.bucketSize}m</span>
            <span id="dayflow-updated-chip"><strong>Updated</strong> ${payload.lastUpdated.slice(11, 16)} UTC</span>
            ${viewport.sparseToday && viewport.observedSinceLabel ? `<span id="dayflow-observed-chip"><strong>Observed</strong> since ${viewport.observedSinceLabel} UTC</span>` : ""}
            ${payload.rangeMode === "today"
              ? `<button type="button" class="focus-chip ${viewport.mode === "observed" ? "focus-chip--active" : ""}" data-dayflow-viewport="observed">Observed window</button>
                 <button type="button" class="focus-chip ${viewport.mode === "full-day" ? "focus-chip--active" : ""}" data-dayflow-viewport="full-day">Full day</button>`
              : ""}
          </div>
        </div>
        <div class="dayflow-canvas-wrap">
          <div class="dayflow-overlay-status" id="dayflow-overlay-status" hidden></div>
          <canvas id="dayflow-canvas" class="dayflow-canvas" aria-label="Day Flow chart"></canvas>
        </div>
        <div class="dayflow-time-wrap">
          <span class="dayflow-time-label">Time selection</span>
          <input id="dayflow-time" type="range" min="${viewport.startIndex}" max="${viewport.endIndex}" step="1" value="${viewport.endIndex}" />
        </div>
        <div id="dayflow-focus-mobile" class="card dayflow-focus-mobile"></div>
        <button type="button" id="dayflow-open-sheet" class="action dayflow-open-sheet">Open detail</button>
      </section>

      <section class="dayflow-side">
        <section class="card dayflow-focus-card">
          <h2>Time Focus</h2>
          <div id="dayflow-focus" class="kv"></div>
        </section>
                <section class="card" id="dayflow-detail"></section>
      </section>
    </section>
    <dialog id="dayflow-detail-sheet" class="dayflow-sheet"><section class="card" id="dayflow-detail-mobile"></section></dialog>
  `
}

function renderBootSkeleton(): string {
  return `
    <section class="dayflow-status-rail" id="dayflow-status-slot" aria-live="polite">
      <span class="dayflow-status-indicator" id="dayflow-status-indicator">Loading initial Day Flow window…</span>
    </section>
    <section class="grid-2 page-section dayflow-layout dayflow-layout--skeleton">
      <section class="card dayflow-main-card">
        <div class="dayflow-main-head dayflow-meta-strip">
          <h2>Live 24h Landscape</h2>
        </div>
        <div class="dayflow-canvas-wrap dayflow-canvas-wrap--skeleton" aria-hidden="true"></div>
      </section>
      <section class="dayflow-side" aria-hidden="true">
        <section class="card dayflow-skeleton-card"></section>
        <section class="card dayflow-skeleton-card dayflow-skeleton-card--detail"></section>
      </section>
    </section>
  `
}

function renderFocus(target: HTMLElement, payload: DayFlowPayload, bucketIndex: number) {
  const focusItems = payload.bands
    .filter((band) => !band.isOthers)
    .map((band) => {
      const curr = band.buckets[bucketIndex]
      const prev = band.buckets[Math.max(0, bucketIndex - 1)]
      const momentum = (curr?.viewers ?? 0) - (prev?.viewers ?? 0)
      return {
        streamerId: band.streamerId,
        name: band.name,
        viewers: curr?.viewers ?? 0,
        share: curr?.share ?? 0,
        momentum,
        activity: curr?.activity
      }
    })
    .sort((a, b) => b.viewers - a.viewers)
    .slice(0, 5)

  const momentumLeader = [...focusItems].sort((a, b) => b.momentum - a.momentum)[0]
  const activityLeader = payload.activity.available
    ? [...focusItems].filter((item) => typeof item.activity === "number").sort((a, b) => (b.activity ?? 0) - (a.activity ?? 0))[0]
    : null

  target.innerHTML = `
    <div class="kv-row"><span>Selected</span><strong>${payload.buckets[bucketIndex]?.slice(11, 16) ?? "N/A"}</strong></div>
    ${focusItems.map((item, idx) => `<div class="kv-row" data-streamer-id="${item.streamerId}"><span>#${idx + 1} ${item.name}</span><strong>${numberFmt.format(item.viewers)} (${pctFmt.format(item.share)})</strong></div>`).join("")}
    <div class="kv-row"><span>Strongest momentum</span><strong>${momentumLeader?.name ?? "N/A"}</strong></div>
    <div class="kv-row"><span>Highest activity</span><strong>${activityLeader?.name ?? (payload.activity.available ? "N/A" : "Activity unavailable")}</strong></div>
  `
}

function renderMiniChart(payload: DayFlowPayload, streamerId: string): string {
  const band = payload.bands.find((item) => item.streamerId === streamerId)
  if (!band || band.buckets.length < 2) {
    return `<div class="dayflow-mini-chart dayflow-mini-chart--empty"><p class="muted">Mini chart unavailable for this selection.</p></div>`
  }

  const maxViewers = Math.max(1, ...band.buckets.map((bucket) => bucket.viewers))
  const points = band.buckets
    .map((bucket, idx) => {
      const x = (idx / Math.max(1, band.buckets.length - 1)) * 100
      const y = 100 - (bucket.viewers / maxViewers) * 100
      return `${x},${y}`
    })
    .join(" ")

  return `
    <div class="dayflow-mini-chart">
      <div class="dayflow-mini-chart__head"><strong>Viewers trend</strong><span>${payload.isRolling ? "Rolling 24h" : payload.selectedDate}</span></div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Selected streamer viewers mini chart">
        <polyline points="${points}" />
      </svg>
    </div>
  `
}

function renderDetailCard(payload: DayFlowPayload, streamerId: string | null, isolate: boolean, mobile = false): string {
  const id = streamerId ?? payload.detailPanelSource.defaultStreamerId
  const detail = payload.detailPanelSource.streamers.find((streamer) => streamer.streamerId === id)

  if (!detail) {
    return `<h2>Detail</h2><p class="muted">Tap a band to inspect streamer details.</p>`
  }

  return `
    <h2>Detail Panel</h2>
    ${renderMiniChart(payload, detail.streamerId)}
    <div class="kv">
      <div class="kv-row"><span>Streamer</span><strong>${detail.name}</strong></div>
      <div class="kv-row"><span>Title</span><strong>${detail.title || "N/A"}</strong></div>
      <div class="kv-row"><span>Window peak viewers</span><strong>${numberFmt.format(detail.peakViewers)}</strong></div>
      <div class="kv-row"><span>Avg viewers</span><strong>${numberFmt.format(detail.avgViewers)}</strong></div>
      <div class="kv-row"><span>Viewer-minutes</span><strong>${numberFmt.format(detail.viewerMinutes)}</strong></div>
      <div class="kv-row"><span>Peak share</span><strong>${pctFmt.format(detail.peakShare)}</strong></div>
      <div class="kv-row"><span>Biggest rise time</span><strong>${isoTimeLabel(detail.biggestRiseTime)}</strong></div>
      <div class="kv-row"><span>First seen / Last seen</span><strong>${isoTimeLabel(detail.firstSeen)} / ${isoTimeLabel(detail.lastSeen)}</strong></div>
    </div>
    <div class="actions">
      ${mobile ? "" : `<button class="action action-toggle" type="button" id="dayflow-highlight">${isolate ? "Highlight only" : "Show all"}</button>`}
      <a class="action" href="${detail.url}" target="_blank" rel="noreferrer">Open stream</a>
      ${mobile ? "" : `<button class="action action-toggle" type="button" id="dayflow-isolate">${isolate ? "Dim others: on" : "Dim others: off"}</button>`}
    </div>
  `
}

function mountData(
  form: HTMLFormElement,
  content: HTMLElement,
  viewState: DayFlowViewState,
  previousGood: DayFlowPayload | null,
  onViewportChange: () => void,
  skipFetch = false
): { promise: Promise<DayFlowMountController | null>; abort: () => void } {
  let destroyed = false
  if (!previousGood) {
    content.innerHTML = renderBootSkeleton()
  }

  const showNotice = (kind: "updating" | "error" | null, message?: string) => {
    const inline = content.querySelector<HTMLElement>("#dayflow-status-indicator")
    const overlay = content.querySelector<HTMLElement>("#dayflow-overlay-status")
    if (!inline || !overlay) return
    if (!kind) {
      inline.hidden = true
      inline.removeAttribute("data-kind")
      inline.textContent = ""
      overlay.hidden = true
      overlay.removeAttribute("data-kind")
      overlay.textContent = ""
      return
    }

    const text = message ?? (kind === "updating" ? "Updating data…" : "Update failed. Showing last good chart.")
    inline.hidden = false
    inline.dataset.kind = kind
    inline.textContent = text
    overlay.hidden = false
    overlay.dataset.kind = kind
    overlay.textContent = kind === "updating" ? "Updating…" : "Refresh failed"
  }

  const promise = (async () => {
    let payload: DayFlowPayload
    try {
      if (skipFetch && previousGood) {
        payload = previousGood
      } else {
        payload = await getDayFlowPayload({
          day: viewState.rangeMode,
          date: viewState.selectedDate,
          top: viewState.topN,
          mode: viewState.valueMode,
          bucket: viewState.bucketSize
        })
      }
    } catch {
      if (previousGood) {
        return null
      }

      const inline = content.querySelector<HTMLElement>("#dayflow-status-indicator")
      if (inline) {
        inline.hidden = false
        inline.dataset.kind = "error"
        inline.innerHTML = `Initial load failed. <button type="button" id="retry-dayflow" class="action dayflow-inline-retry">Retry</button>`
      }
      content.querySelector<HTMLButtonElement>("#retry-dayflow")?.addEventListener("click", () => {
        const next = mountData(form, content, viewState, previousGood, onViewportChange)
        void next.promise
      })
      return null
    }

    if (destroyed) return null
    writeCachedPayload(payload)
    let viewport = resolveDayFlowViewport(payload, viewState.viewportPreference)
    content.innerHTML = renderFrame(payload, viewport)

    const canvas = content.querySelector<HTMLCanvasElement>("#dayflow-canvas")
    const slider = content.querySelector<HTMLInputElement>("#dayflow-time")
    const focus = content.querySelector<HTMLElement>("#dayflow-focus")
    const focusMobile = content.querySelector<HTMLElement>("#dayflow-focus-mobile")
    const detail = content.querySelector<HTMLElement>("#dayflow-detail")
    const detailMobile = content.querySelector<HTMLElement>("#dayflow-detail-mobile")
    const detailSheet = content.querySelector<HTMLDialogElement>("#dayflow-detail-sheet")
    const openSheetButton = content.querySelector<HTMLButtonElement>("#dayflow-open-sheet")
    if (!canvas || !slider || !focus || !detail || !focusMobile || !detailMobile || !detailSheet) return null

    viewState.selectedBucketIndex = Math.max(
      viewport.startIndex,
      Math.min(viewport.endIndex, resolveInitialBucketIndex(payload, viewState.selectedBucketIndex))
    )
    if (!payload.detailPanelSource.streamers.some((s) => s.streamerId === viewState.selectedStreamerId)) {
      viewState.selectedStreamerId = payload.detailPanelSource.defaultStreamerId
    }

    const state = () => ({ selectedBucketIndex: viewState.selectedBucketIndex, selectedStreamerId: viewState.selectedStreamerId, mode: viewState.valueMode, isolate: viewState.isolate })
    let renderer = drawChart(canvas, payload, viewport, state)

    const wireDetailActions = () => {
      const isolateButtons = content.querySelectorAll<HTMLButtonElement>("#dayflow-isolate")
      for (const button of isolateButtons) {
        button.addEventListener("click", () => {
          viewState.isolate = !viewState.isolate
          renderDetail()
          renderer.redraw()
        })
      }
      const highlightButtons = content.querySelectorAll<HTMLButtonElement>("#dayflow-highlight")
      for (const button of highlightButtons) {
        button.addEventListener("click", () => {
          viewState.isolate = !viewState.isolate
          renderDetail()
          renderer.redraw()
        })
      }
    }

    const renderDetail = () => {
      detail.innerHTML = renderDetailCard(payload, viewState.selectedStreamerId, viewState.isolate)
      detailMobile.innerHTML = `<h2 class="dayflow-sheet-title">Selected Stream</h2>${renderDetailCard(payload, viewState.selectedStreamerId, viewState.isolate, true)}<button type="button" class="action dayflow-close-sheet" id="dayflow-close-sheet">Close</button>`
      wireDetailActions()
    }

    const syncViewState = () => {
      const idx = Math.max(viewport.startIndex, Math.min(viewport.endIndex, Number(slider.value)))
      viewState.selectedBucketIndex = idx
      slider.value = String(idx)
      renderFocus(focus, payload, idx)
      renderFocus(focusMobile, payload, idx)
      renderDetail()
      if (viewState.selectedStreamerId) {
        for (const row of content.querySelectorAll<HTMLElement>("[data-streamer-id]")) {
          row.dataset.selected = row.dataset.streamerId === viewState.selectedStreamerId ? "true" : "false"
        }
      }
      renderer.redraw()
    }

    slider.addEventListener("input", syncViewState)

    canvas.addEventListener("click", (event) => {
      const rect = canvas.getBoundingClientRect()
      const xRatio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
      const yRatio = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
      const bucketIndex = Math.max(
        viewport.startIndex,
        Math.min(
          viewport.endIndex,
          viewport.startIndex + Math.round(xRatio * Math.max(1, viewport.endIndex - viewport.startIndex))
        )
      )
      slider.value = String(bucketIndex)
      viewState.selectedBucketIndex = bucketIndex
      const band = bandAtPosition(payload, bucketIndex, 1 - yRatio, viewState.valueMode)
      viewState.selectedStreamerId = band?.streamerId ?? viewState.selectedStreamerId
      syncViewState()
      if (window.matchMedia("(max-width: 900px)").matches && typeof detailSheet.showModal === "function" && !detailSheet.open) {
        detailSheet.showModal()
      }
    })

    openSheetButton?.addEventListener("click", () => {
      if (typeof detailSheet.showModal === "function" && !detailSheet.open) detailSheet.showModal()
    })

    detailMobile.addEventListener("click", (event) => {
      const t = event.target as HTMLElement
      if (t.id === "dayflow-close-sheet") detailSheet.close()
    })

    detailSheet.addEventListener("click", (event) => {
      const target = event.target as HTMLElement
      if (target.tagName === "DIALOG") {
        detailSheet.close()
      }
    })

    slider.min = String(viewport.startIndex)
    slider.max = String(viewport.endIndex)
    slider.value = String(Math.max(viewport.startIndex, Math.min(viewport.endIndex, resolveInitialBucketIndex(payload, viewState.selectedBucketIndex))))
    syncViewState()

      content.querySelectorAll<HTMLButtonElement>("[data-dayflow-viewport]").forEach((button) => {
        button.addEventListener("click", () => {
          const mode = button.dataset.dayflowViewport
          if (mode !== "observed" && mode !== "full-day") return
          viewState.viewportPreference = mode
          onViewportChange()
        })
      })

    const updatePayload = (nextPayload: DayFlowPayload) => {
      payload = nextPayload
      viewport = resolveDayFlowViewport(payload, viewState.viewportPreference)
      if (!payload.detailPanelSource.streamers.some((s) => s.streamerId === viewState.selectedStreamerId)) {
        viewState.selectedStreamerId = payload.detailPanelSource.defaultStreamerId
      }

      content.querySelector<HTMLElement>("#dayflow-title")!.textContent =
        payload.rangeMode === "rolling24h" ? "Rolling 24h Landscape"
          : payload.rangeMode === "yesterday" ? "Yesterday Landscape"
          : payload.rangeMode === "date" ? "Selected Day Landscape"
          : "Today Landscape"
      content.querySelector<HTMLElement>("#dayflow-range-chip")!.innerHTML =
        `<strong>Range</strong> ${payload.isRolling ? `${payload.windowStart.slice(11, 16)} → ${payload.windowEnd.slice(11, 16)} UTC` : payload.selectedDate}`
      content.querySelector<HTMLElement>("#dayflow-status-chip")!.innerHTML =
        `<strong>Status</strong> ${payload.status}`
      content.querySelector<HTMLElement>("#dayflow-coverage-chip")!.innerHTML =
        `<strong>Coverage</strong> ${payload.coverageNote}`
      content.querySelector<HTMLElement>("#dayflow-bucket-chip")!.innerHTML =
        `<strong>Bucket</strong> ${payload.bucketSize}m`
      content.querySelector<HTMLElement>("#dayflow-updated-chip")!.innerHTML =
        `<strong>Updated</strong> ${payload.lastUpdated.slice(11, 16)} UTC`
      const observedChip = content.querySelector<HTMLElement>("#dayflow-observed-chip")
      if (observedChip) {
        observedChip.innerHTML = `<strong>Observed</strong> since ${viewport.observedSinceLabel ?? "N/A"} UTC`
      }

      slider.min = String(viewport.startIndex)
      slider.max = String(viewport.endIndex)
      viewState.selectedBucketIndex = Math.max(
        viewport.startIndex,
        Math.min(viewport.endIndex, resolveInitialBucketIndex(payload, viewState.selectedBucketIndex))
      )
      slider.value = String(viewState.selectedBucketIndex)

      renderer.destroy()
      renderer = drawChart(canvas, payload, viewport, state)

      syncViewState()
    }

    return {
      payload,
      syncViewState,
      updatePayload,
      showNotice,
      destroy: () => {
        renderer.destroy()
      }
    }
  })()

  return {
    promise,
    abort: () => {
      destroyed = true
    }
  }
}

export function renderDayFlowPage(root: HTMLElement): void {
  root.className = "site-shell dayflow-page"
  root.innerHTML = `
    ${renderHeader("day-flow")}
    ${renderHero({
      eyebrow: "TODAY",
      title: "Day Flow",
      subtitle: "Read today’s ownership landscape, hour by hour.",
      note: "Today uses the live hot path; yesterday/date use rollup history. Sparse today may default to observed-window mode.",
      actions: [
        { href: "/heatmap/", label: "Heatmap (support)" },

      ]
    })}

    <form class="controls controls--dayflow" id="day-flow-controls">
      <div class="controls-group">
        <select name="day" aria-label="Day"><option value="today">Today</option><option value="rolling24h">Rolling 24h</option><option value="yesterday">Yesterday</option><option value="date">Date</option></select>
        <input type="date" name="date" aria-label="Date picker" />
      </div>
      <div class="controls-group">
        <select name="top" aria-label="Top N"><option value="10">Top 10 + Others</option><option value="20" selected>Top 20 + Others</option><option value="50">Top 50 + Others</option></select>
        <select name="mode" aria-label="Mode"><option value="volume" selected>Volume</option><option value="share">Share</option></select>
        <select name="bucket" aria-label="Bucket"><option value="5" selected>5m</option><option value="10">10m</option></select>
      </div>
      <div class="controls-group controls-group--secondary">
        <label class="pill"><input type="checkbox" id="auto-update" checked /> Auto update</label>
        <button type="submit" class="action">Refresh</button>
      </div>
    </form>

    <div id="day-flow-content"></div>

    ${renderStatusNote({
      eyebrow: "LIVE COVERAGE",
      title: "What partial means in Day Flow",
      body: "Today and Rolling 24h show the observed window from current collection, not a synthetic full-day fill.",
      items: [
        "partial = observed channels/pages only, not complete site-wide coverage",
        "coverage grows as the collector sees more pages in the current window",
        "activity unavailable is expected in the current MVP feed"
      ],
      tone: "info"
    })}
    ${renderFooter()}
  `

  const form = root.querySelector<HTMLFormElement>("#day-flow-controls")
  const content = root.querySelector<HTMLElement>("#day-flow-content")
  const autoUpdate = root.querySelector<HTMLInputElement>("#auto-update")
  if (!form || !content || !autoUpdate) return

  let mounted: DayFlowMountController | null = null
  let previousGood: DayFlowPayload | null = readCachedPayload()
  let activeMountAbort: (() => void) | null = null
  let activeFetchController: AbortController | null = null
  let requestSeq = 0
  const initial = parseFilters(form)
  const viewState: DayFlowViewState = {
    rangeMode: initial.day,
    selectedDate: initial.date,
    topN: initial.top,
    valueMode: initial.mode,
    bucketSize: initial.bucket,
    selectedBucketIndex: 0,
    selectedStreamerId: null,
    autoUpdateEnabled: autoUpdate.checked,
    isolate: false,
    viewportPreference: null
  }

  const syncControlsToViewState = () => {
    const filters = parseFilters(form)
    viewState.rangeMode = filters.day
    viewState.selectedDate = filters.date
    viewState.topN = filters.top
    viewState.valueMode = filters.mode
    viewState.bucketSize = filters.bucket
  }

  const syncDateInputState = () => {
    const dateInput = form.querySelector<HTMLInputElement>('input[name="date"]')
    if (!dateInput) return
    const dateMode = viewState.rangeMode === "date"
    dateInput.disabled = !dateMode
    dateInput.hidden = !dateMode
    dateInput.style.display = dateMode ? "inline-flex" : "none"
  }
  syncDateInputState()

  const remount = async () => {
    syncControlsToViewState()
    syncDateInputState()
    const requestId = ++requestSeq

    if (!mounted) {
      if (activeMountAbort) {
        activeMountAbort()
        activeMountAbort = null
      }

      const active = mountData(form, content, viewState, previousGood, () => {
        void remount()
      })
      activeMountAbort = active.abort
      const next = await active.promise

      if (requestId !== requestSeq) return
      activeMountAbort = null

      if (next) {
        mounted = next
        previousGood = next.payload
      }
      return
    }

    if (activeFetchController) {
      activeFetchController.abort()
      activeFetchController = null
    }

    const controller = new AbortController()
    activeFetchController = controller

    mounted.showNotice("updating")
    try {
      const nextPayload = await getDayFlowPayload({
        day: viewState.rangeMode,
        date: viewState.selectedDate,
        top: viewState.topN,
        mode: viewState.valueMode,
        bucket: viewState.bucketSize,
        signal: controller.signal
      })

      if (controller.signal.aborted || requestId !== requestSeq) return

      mounted.updatePayload(nextPayload)
      previousGood = nextPayload
      writeCachedPayload(nextPayload)
      mounted.showNotice(null)
    } catch (error) {
      if (controller.signal.aborted || requestId !== requestSeq) return
      mounted.showNotice("error")
    } finally {
      if (activeFetchController === controller) {
        activeFetchController = null
      }
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault()
    void remount()
  })

  const attachControlListeners = (selector: string) => {
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(selector).forEach((field) => {
      field.addEventListener("change", () => {
        syncControlsToViewState()
        syncDateInputState()
        void remount()
      })
    })
  }

  attachControlListeners("select[name='day']")
  attachControlListeners("input[name='date']")
  attachControlListeners("select[name='top']")
  attachControlListeners("select[name='mode']")
  attachControlListeners("select[name='bucket']")

  let timer: number | null = window.setInterval(() => {
    if (document.hidden) return
    if (viewState.autoUpdateEnabled && ["today", "rolling24h"].includes(parseFilters(form).day)) {
      void remount()
    }
  }, 60_000)

  autoUpdate.addEventListener("change", () => {
    viewState.autoUpdateEnabled = autoUpdate.checked
    if (!viewState.autoUpdateEnabled && timer !== null) {
      window.clearInterval(timer)
      timer = null
      return
    }

    if (viewState.autoUpdateEnabled && timer === null) {
      timer = window.setInterval(() => {
        if (document.hidden) return
        if (["today", "rolling24h"].includes(parseFilters(form).day)) {
          void remount()
        }
      }, 60_000)
    }
  })

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return
    if (viewState.autoUpdateEnabled && ["today", "rolling24h"].includes(parseFilters(form).day)) {
      void remount()
    }
  })

  void remount()
}
