import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"
import { createCanvasHost } from "../../shared/canvas/canvas-host"
import { getDayFlowPayload } from "../../shared/api/day-flow-api"
import type { DayFlowPayload, DayFlowBandSeries } from "../../../../../packages/shared/src/types/day-flow"

const numberFmt = new Intl.NumberFormat("en-US")
const pctFmt = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 })

type UiFilters = {
  day: "today" | "yesterday" | "date"
  date: string
  top: 10 | 20 | 50
  mode: "volume" | "share"
  bucket: 5 | 10
}

type DayFlowMountController = {
  payload: DayFlowPayload
  getSelectedBucket: () => string | null
  showNotice: (kind: "updating" | "error" | null, message?: string) => void
  destroy: () => void
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

function indexByBucket(payload: DayFlowPayload, selectedBucket: string | null): number {
  if (!selectedBucket) return Math.max(0, payload.buckets.length - 1)
  const idx = payload.buckets.indexOf(selectedBucket)
  return idx < 0 ? Math.max(0, payload.buckets.length - 1) : idx
}

function getFutureBlankStartIndex(payload: DayFlowPayload): number {
  if (!payload.timeline.futureBlankFrom) return payload.buckets.length
  const idx = payload.buckets.indexOf(payload.timeline.futureBlankFrom)
  return idx < 0 ? payload.buckets.length : idx
}

function getLatestObservedBucketIndex(payload: DayFlowPayload): number {
  const futureStart = getFutureBlankStartIndex(payload)
  for (let idx = Math.min(payload.buckets.length - 1, futureStart - 1); idx >= 0; idx -= 1) {
    if ((payload.totalViewersByBucket[idx] ?? 0) > 0) return idx
  }
  return -1
}

function resolveInitialBucketIndex(payload: DayFlowPayload, preferredBucket: string | null): number {
  if (payload.buckets.length === 0) return 0

  const latestObserved = getLatestObservedBucketIndex(payload)
  const futureStart = getFutureBlankStartIndex(payload)
  const preferred = preferredBucket ? payload.buckets.indexOf(preferredBucket) : -1

  if (preferred >= 0 && preferred < futureStart && (payload.totalViewersByBucket[preferred] ?? 0) > 0) {
    return preferred
  }
  if (latestObserved >= 0) return latestObserved

  if (payload.dateScope !== "today") {
    const nonFuture = Math.max(0, Math.min(payload.buckets.length - 1, futureStart - 1))
    return nonFuture
  }

  return Math.max(0, Math.min(payload.buckets.length - 1, futureStart - 1))
}

function renderLegend(payload: DayFlowPayload): string {
  return payload.bands
    .slice(0, 8)
    .map((band) => `<li data-streamer-id="${band.streamerId}"><span class="dayflow-dot" style="background:${band.color}"></span>${band.name}${band.isOthers ? " (Others)" : ""}</li>`)
    .join("")
}

function bandAtPosition(payload: DayFlowPayload, bucketIndex: number, yRatio: number, mode: "volume" | "share"): DayFlowBandSeries | null {
  const total = payload.totalViewersByBucket[bucketIndex] ?? 0
  let acc = 0
  for (const band of payload.bands) {
    const value = mode === "share" ? (band.buckets[bucketIndex]?.share ?? 0) : (total > 0 ? (band.buckets[bucketIndex]?.viewers ?? 0) / total : 0)
    const next = acc + value
    if (yRatio >= acc && yRatio <= next) return band
    acc = next
  }
  return null
}

function drawChart(canvas: HTMLCanvasElement, payload: DayFlowPayload, getState: () => { selectedBucket: string | null; selectedStreamerId: string | null; mode: "volume" | "share"; isolate: boolean }) {
  const host = createCanvasHost(canvas, { maxDpr: 2 })

  const draw = () => {
    const { ctx, width, height } = host.get()
    const pad = { left: 38, right: 10, top: 10, bottom: 24 }
    const chartW = Math.max(1, width - pad.left - pad.right)
    const chartH = Math.max(1, height - pad.top - pad.bottom)
    const { selectedBucket, selectedStreamerId, mode, isolate } = getState()
    const selectedIndex = indexByBucket(payload, selectedBucket)

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = "#0a1120"
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = "rgba(122,162,255,0.12)"
    ctx.strokeRect(pad.left, pad.top, chartW, chartH)

    const futureStart = getFutureBlankStartIndex(payload)
    const drawBucketCount = Math.max(1, Math.min(payload.buckets.length, futureStart))

    for (let i = 0; i < drawBucketCount; i += 1) {
      const x = pad.left + (i / Math.max(1, payload.buckets.length - 1)) * chartW
      let yOffset = 0

      for (const band of payload.bands) {
        const val = mode === "share"
          ? (band.buckets[i]?.share ?? 0)
          : ((payload.totalViewersByBucket[i] ?? 0) > 0 ? (band.buckets[i]?.viewers ?? 0) / (payload.totalViewersByBucket[i] ?? 1) : 0)
        const h = val * chartH
        const y = pad.top + chartH - yOffset - h

        ctx.fillStyle = band.color
        const isSelected = selectedStreamerId === band.streamerId
        const isDimmed = isolate && selectedStreamerId && !isSelected
        ctx.globalAlpha = isDimmed ? 0.12 : (selectedStreamerId && !isSelected ? 0.35 : 0.88)
        if (i === 0 || i === drawBucketCount - 1) {
          ctx.fillRect(x - 1.2, y, 2.4, h)
        } else {
          const nextX = pad.left + ((i + 1) / Math.max(1, payload.buckets.length - 1)) * chartW
          ctx.fillRect(x, y, Math.max(1, nextX - x + 0.6), h)
        }

        yOffset += h
      }
    }
    ctx.globalAlpha = 1

    const sx = pad.left + (selectedIndex / Math.max(1, payload.buckets.length - 1)) * chartW
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
      const total = payload.totalViewersByBucket[selectedIndex] || 1
      const ratio = mode === "share" ? bucket?.share ?? 0 : (bucket?.viewers ?? 0) / total
      if (ratio < (mobile ? 0.08 : 0.05)) continue

      let yStart = pad.top + chartH
      for (const candidate of payload.bands) {
        const cBucket = candidate.buckets[selectedIndex]
        const cRatio = mode === "share" ? cBucket?.share ?? 0 : ((payload.totalViewersByBucket[selectedIndex] ?? 0) > 0 ? (cBucket?.viewers ?? 0) / (payload.totalViewersByBucket[selectedIndex] ?? 1) : 0)
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
        const cRatio = mode === "share" ? cBucket?.share ?? 0 : ((payload.totalViewersByBucket[selectedIndex] ?? 0) > 0 ? (cBucket?.viewers ?? 0) / (payload.totalViewersByBucket[selectedIndex] ?? 1) : 0)
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
    ctx.fillText("00:00", pad.left - 4, height - 10)
    ctx.fillText("24:00", width - 42, height - 10)
    ctx.fillText(mode === "share" ? "Share" : "Volume", 8, 14)
    ctx.fillText(isoTimeLabel(payload.buckets[selectedIndex]), sx + 4, selectedLineY)

    if (payload.dateScope === "today" && futureStart < payload.buckets.length) {
      const blankStartX = pad.left + (futureStart / Math.max(1, payload.buckets.length - 1)) * chartW
      ctx.fillStyle = "rgba(8, 11, 19, 0.1)"
      ctx.fillRect(blankStartX, pad.top, pad.left + chartW - blankStartX, chartH)
      ctx.strokeStyle = "rgba(255,255,255,0.06)"
      ctx.beginPath()
      ctx.moveTo(blankStartX, pad.top)
      ctx.lineTo(blankStartX, pad.top + chartH)
      ctx.stroke()
      ctx.fillStyle = "#5d6c8f"
      ctx.font = "10px ui-sans-serif"
      ctx.fillText("Future blank", blankStartX + 6, pad.top + 14)
      ctx.fillStyle = "#b8deff"
      ctx.fillRect(blankStartX - 1, pad.top, 2, chartH)
      ctx.fillStyle = "#dff0ff"
      ctx.font = "11px ui-sans-serif"
      ctx.fillText("NOW", blankStartX + 6, pad.top + 28)
    }
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
  return `
    <section class="card dayflow-state-card ${expanded ? "dayflow-state-card--expanded" : ""}">
      <div class="dayflow-state-head">
        <h2>Data</h2>
        <div class="status-chip" data-state="${payload.state}">${payload.status}</div>
      </div>
      <p class="muted">${payload.note ?? "Live data render from API day rollup."}</p>
      <p class="dayflow-notes-inline">${payload.coverageNote}${payload.partialNote ? ` · Partial: ${payload.partialNote}` : ""} · ${payload.activity.note}</p>
    </section>
  `
}

function renderFrame(payload: DayFlowPayload): string {
  return `
    <section class="dayflow-meta-row page-section">
      ${renderSummary(payload)}
      ${renderStateNote(payload)}
    </section>
    <section class="grid-2 page-section dayflow-layout">
      <section class="card dayflow-main-card">
        <div class="dayflow-main-head dayflow-meta-strip">
          <h2>Today Landscape</h2>
          <div class="dayflow-meta-inline">
            <span><strong>Date</strong> ${payload.selectedDate}</span>
            <span><strong>Status</strong> ${payload.status}</span>
            <span><strong>Coverage</strong> ${payload.coverageNote}</span>
            <span><strong>Bucket</strong> ${payload.bucketSize}m</span>
            <span><strong>Updated</strong> ${payload.lastUpdated.slice(11, 16)} UTC</span>
          </div>
        </div>
        <div class="dayflow-canvas-wrap">
          <canvas id="dayflow-canvas" class="dayflow-canvas" aria-label="Day Flow chart"></canvas>
        </div>
        <div class="dayflow-time-wrap">
          <span class="dayflow-time-label">Time selection</span>
          <input id="dayflow-time" type="range" min="0" max="${Math.max(0, payload.buckets.length - 1)}" step="1" value="${Math.max(0, payload.buckets.length - 1)}" />
        </div>
        <div id="dayflow-focus-mobile" class="card dayflow-focus-mobile"></div>
      </section>

      <section class="dayflow-side">
        <section class="card dayflow-focus-card">
          <h2>Time Focus</h2>
          <div id="dayflow-focus" class="kv"></div>
        </section>
        <section class="card">
          <h2>Legend</h2>
          <ul class="dayflow-legend">${renderLegend(payload)}</ul>
        </section>
        <section class="card" id="dayflow-detail"></section>
      </section>
    </section>
    <dialog id="dayflow-detail-sheet" class="dayflow-sheet"><section class="card" id="dayflow-detail-mobile"></section></dialog>
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
      <div class="dayflow-mini-chart__head"><strong>Viewers trend</strong><span>${payload.selectedDate}</span></div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Selected streamer viewers mini chart">
        <polyline points="${points}" />
      </svg>
    </div>
  `
}

function renderDetailCard(payload: DayFlowPayload, streamerId: string | null, isolate: boolean): string {
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
      <div class="kv-row"><span>Today peak viewers</span><strong>${numberFmt.format(detail.peakViewers)}</strong></div>
      <div class="kv-row"><span>Avg viewers</span><strong>${numberFmt.format(detail.avgViewers)}</strong></div>
      <div class="kv-row"><span>Viewer-minutes</span><strong>${numberFmt.format(detail.viewerMinutes)}</strong></div>
      <div class="kv-row"><span>Peak share</span><strong>${pctFmt.format(detail.peakShare)}</strong></div>
      <div class="kv-row"><span>Highest activity</span><strong>${detail.highestActivity ?? "Activity unavailable"}</strong></div>
      <div class="kv-row"><span>Biggest rise time</span><strong>${isoTimeLabel(detail.biggestRiseTime)}</strong></div>
      <div class="kv-row"><span>First seen / Last seen</span><strong>${isoTimeLabel(detail.firstSeen)} / ${isoTimeLabel(detail.lastSeen)}</strong></div>
    </div>
    <div class="actions">
      <button class="action action-toggle" type="button" id="dayflow-highlight">${isolate ? "Highlight only" : "Show all"}</button>
      <a class="action" href="${detail.url}" target="_blank" rel="noreferrer">Open stream</a>
      <button class="action action-toggle" type="button" id="dayflow-isolate">${isolate ? "Dim others: on" : "Dim others: off"}</button>
    </div>
  `
}

function mountData(
  form: HTMLFormElement,
  content: HTMLElement,
  previousGood: DayFlowPayload | null,
  preferredBucket: string | null
): { promise: Promise<DayFlowMountController | null>; abort: () => void } {
  let destroyed = false
  if (!previousGood) {
    content.innerHTML = `<section class="card"><h2>Loading Day Flow…</h2></section>`
  }

  const showNotice = (kind: "updating" | "error" | null, message?: string) => {
    const existing = content.querySelector<HTMLElement>("#dayflow-transient-note")
    if (!kind) {
      existing?.remove()
      return
    }

    const text = message ?? (kind === "updating" ? "Updating data…" : "Update failed. Showing last good chart.")
    if (existing) {
      existing.dataset.kind = kind
      existing.innerHTML = `<p class="muted">${text}</p>`
      return
    }

    const note = document.createElement("section")
    note.className = "card dayflow-transient-note"
    note.id = "dayflow-transient-note"
    note.dataset.kind = kind
    note.innerHTML = `<p class="muted">${text}</p>`
    content.prepend(note)
  }

  const promise = (async () => {
    let payload: DayFlowPayload
    try {
      payload = await getDayFlowPayload(parseFilters(form))
    } catch {
      if (previousGood) {
        return null
      }

      content.innerHTML = `<section class="card"><h2>Error</h2><p>Could not load /api/day-flow. <button id="retry-dayflow">Retry</button></p></section>`
      content.querySelector("#retry-dayflow")?.addEventListener("click", () => {
        const next = mountData(form, content, previousGood, preferredBucket)
        void next.promise
      })
      return null
    }

    if (destroyed) return null
    content.innerHTML = renderFrame(payload)

    const canvas = content.querySelector<HTMLCanvasElement>("#dayflow-canvas")
    const slider = content.querySelector<HTMLInputElement>("#dayflow-time")
    const focus = content.querySelector<HTMLElement>("#dayflow-focus")
    const focusMobile = content.querySelector<HTMLElement>("#dayflow-focus-mobile")
    const detail = content.querySelector<HTMLElement>("#dayflow-detail")
    const detailMobile = content.querySelector<HTMLElement>("#dayflow-detail-mobile")
    const detailSheet = content.querySelector<HTMLDialogElement>("#dayflow-detail-sheet")
    if (!canvas || !slider || !focus || !detail || !focusMobile || !detailMobile || !detailSheet) return null

    let selectedBucket = payload.buckets[resolveInitialBucketIndex(payload, preferredBucket)] ?? null
    let selectedStreamerId = payload.detailPanelSource.defaultStreamerId
    let mode = parseFilters(form).mode
    let isolate = false

    const state = () => ({ selectedBucket, selectedStreamerId, mode, isolate })
    const renderer = drawChart(canvas, payload, state)

    const wireDetailActions = () => {
      const isolateButtons = content.querySelectorAll<HTMLButtonElement>("#dayflow-isolate")
      for (const button of isolateButtons) {
        button.addEventListener("click", () => {
          isolate = !isolate
          renderDetail()
          renderer.redraw()
        })
      }
      const highlightButtons = content.querySelectorAll<HTMLButtonElement>("#dayflow-highlight")
      for (const button of highlightButtons) {
        button.addEventListener("click", () => {
          isolate = !isolate
          renderDetail()
          renderer.redraw()
        })
      }
    }

    const renderDetail = () => {
      detail.innerHTML = renderDetailCard(payload, selectedStreamerId, isolate)
      detailMobile.innerHTML = `<h2>Selected Stream</h2>${renderDetailCard(payload, selectedStreamerId, isolate)}`
      wireDetailActions()
    }

    const refresh = () => {
      const idx = Math.max(0, Math.min(payload.buckets.length - 1, Number(slider.value)))
      selectedBucket = payload.buckets[idx] ?? selectedBucket
      slider.value = String(idx)
      renderFocus(focus, payload, idx)
      renderFocus(focusMobile, payload, idx)
      renderDetail()
      if (selectedStreamerId) {
        for (const row of content.querySelectorAll<HTMLElement>("[data-streamer-id]")) {
          row.dataset.selected = row.dataset.streamerId === selectedStreamerId ? "true" : "false"
        }
      }
      renderer.redraw()
    }

    slider.addEventListener("input", refresh)

    canvas.addEventListener("click", (event) => {
      const rect = canvas.getBoundingClientRect()
      const xRatio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
      const yRatio = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
      const bucketIndex = Math.min(payload.buckets.length - 1, Math.max(0, Math.round(xRatio * (payload.buckets.length - 1))))
      slider.value = String(bucketIndex)
      selectedBucket = payload.buckets[bucketIndex] ?? selectedBucket
      const band = bandAtPosition(payload, bucketIndex, 1 - yRatio, mode)
      selectedStreamerId = band?.streamerId ?? selectedStreamerId
      refresh()
      if (window.matchMedia("(max-width: 900px)").matches && typeof detailSheet.showModal === "function") {
        detailSheet.showModal()
      }
    })

    detailSheet.addEventListener("click", (event) => {
      const target = event.target as HTMLElement
      if (target.tagName === "DIALOG") {
        detailSheet.close()
      }
    })

    form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("select[name='mode']").forEach((field) => {
      field.addEventListener("change", () => {
        mode = parseFilters(form).mode
        renderer.redraw()
      })
    })

    slider.value = String(resolveInitialBucketIndex(payload, selectedBucket))
    refresh()

    return {
      payload,
      getSelectedBucket: () => selectedBucket,
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
      note: "Real-data path active · Today default · 5m buckets.",
      actions: [
        { href: "/heatmap/", label: "Heatmap (support)" },
        { href: "/method/", label: "Method (support)" }
      ]
    })}

    <form class="controls controls--dayflow" id="day-flow-controls">
      <div class="controls-group">
        <select name="day" aria-label="Day"><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="date">Date</option></select>
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

    ${renderStatusNote("If activity data is unavailable, Day Flow shows explicit unavailable state instead of synthetic values.")}
    ${renderFooter()}
  `

  const form = root.querySelector<HTMLFormElement>("#day-flow-controls")
  const content = root.querySelector<HTMLElement>("#day-flow-content")
  const autoUpdate = root.querySelector<HTMLInputElement>("#auto-update")
  if (!form || !content || !autoUpdate) return

  let mounted: DayFlowMountController | null = null
  let previousGood: DayFlowPayload | null = null

  const remount = async () => {
    const preferredBucket = mounted?.getSelectedBucket() ?? null
    if (mounted) {
      mounted.showNotice("updating")
    }

    const active = mountData(form, content, previousGood, preferredBucket)
    const next = await active.promise
    if (next) {
      mounted?.destroy()
      mounted = next
      previousGood = next.payload
      mounted.showNotice(null)
      return
    }

    if (mounted) {
      mounted.showNotice("error")
      return
    }

    mounted = null
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault()
    void remount()
  })

  let timer: number | null = window.setInterval(() => {
    if (autoUpdate.checked && parseFilters(form).day === "today") {
      void remount()
    }
  }, 60_000)

  autoUpdate.addEventListener("change", () => {
    if (!autoUpdate.checked && timer !== null) {
      window.clearInterval(timer)
      timer = null
      return
    }

    if (autoUpdate.checked && timer === null) {
      timer = window.setInterval(() => {
        if (parseFilters(form).day === "today") {
          void remount()
        }
      }, 60_000)
    }
  })

  void remount()
}
