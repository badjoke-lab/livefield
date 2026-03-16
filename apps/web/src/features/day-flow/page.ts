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

function indexByBucket(payload: DayFlowPayload, selectedBucket: string | null): number {
  if (!selectedBucket) return Math.max(0, payload.buckets.length - 1)
  const idx = payload.buckets.indexOf(selectedBucket)
  return idx < 0 ? Math.max(0, payload.buckets.length - 1) : idx
}

function renderLegend(payload: DayFlowPayload): string {
  return payload.bands
    .slice(0, 8)
    .map((band) => `<li><span class="dayflow-dot" style="background:${band.color}"></span>${band.name}${band.isOthers ? " (Others)" : ""}</li>`)
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

function drawChart(canvas: HTMLCanvasElement, payload: DayFlowPayload, selectedBucket: string | null, selectedStreamerId: string | null, mode: "volume" | "share") {
  const host = createCanvasHost(canvas, { maxDpr: 2 })

  const draw = () => {
    const { ctx, width, height } = host.get()
    const pad = { left: 44, right: 16, top: 20, bottom: 34 }
    const chartW = Math.max(1, width - pad.left - pad.right)
    const chartH = Math.max(1, height - pad.top - pad.bottom)

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = "#0a1120"
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = "rgba(122,162,255,0.16)"
    ctx.strokeRect(pad.left, pad.top, chartW, chartH)

    const nowCutIndex = payload.timeline.futureBlankFrom ? payload.buckets.indexOf(payload.timeline.futureBlankFrom) : payload.buckets.length - 1
    const drawBucketCount = Math.max(1, Math.min(payload.buckets.length, nowCutIndex + 1))

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
        ctx.globalAlpha = selectedStreamerId && selectedStreamerId !== band.streamerId ? 0.35 : 0.85
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

    const selectedIndex = indexByBucket(payload, selectedBucket)
    const sx = pad.left + (selectedIndex / Math.max(1, payload.buckets.length - 1)) * chartW
    ctx.strokeStyle = "rgba(255,255,255,0.8)"
    ctx.beginPath()
    ctx.moveTo(sx, pad.top)
    ctx.lineTo(sx, pad.top + chartH)
    ctx.stroke()

    ctx.fillStyle = "#c9d4f5"
    ctx.font = "12px ui-sans-serif"
    ctx.fillText("00:00", pad.left - 4, height - 10)
    ctx.fillText("24:00", width - 42, height - 10)
    ctx.fillText(mode === "share" ? "Share" : "Volume", 8, 14)

    if (payload.dateScope === "today" && nowCutIndex < payload.buckets.length - 1) {
      const blankStartX = pad.left + ((nowCutIndex + 1) / Math.max(1, payload.buckets.length - 1)) * chartW
      ctx.fillStyle = "rgba(8, 11, 19, 0.65)"
      ctx.fillRect(blankStartX, pad.top, pad.left + chartW - blankStartX, chartH)
      ctx.fillStyle = "#93a0bf"
      ctx.fillText("Future (blank)", blankStartX + 6, pad.top + 16)
    }
  }

  draw()
  return { destroy: () => host.destroy(), redraw: draw }
}

function renderSummary(payload: DayFlowPayload): string {
  return `
    <section class="summary-strip page-section">
      <div class="summary-item"><strong>Peak leader</strong><span>${payload.summary.peakLeader}</span></div>
      <div class="summary-item"><strong>Longest dominance</strong><span>${payload.summary.longestDominance}</span></div>
      <div class="summary-item"><strong>Highest activity</strong><span>${payload.summary.highestActivity}</span></div>
      <div class="summary-item"><strong>Biggest rise</strong><span>${payload.summary.biggestRise}</span></div>
    </section>
  `
}

function renderFrame(payload: DayFlowPayload): string {
  return `
    ${renderSummary(payload)}
    <section class="grid-2 page-section dayflow-layout">
      <section class="card">
        <h2>Today Landscape</h2>
        <p class="muted">Stacked bands are fixed by daily viewer-minutes ranking (Top N + Others).</p>
        <div class="kv">
          <div class="kv-row"><span>Date</span><strong>${payload.selectedDate}</strong></div>
          <div class="kv-row"><span>Status</span><strong>${payload.status}</strong></div>
          <div class="kv-row"><span>Coverage</span><strong>${payload.coverageNote}</strong></div>
          <div class="kv-row"><span>Bucket</span><strong>${payload.bucketSize}m</strong></div>
          <div class="kv-row"><span>Last Updated</span><strong>${payload.lastUpdated.slice(11, 16)} UTC</strong></div>
        </div>
        <canvas id="dayflow-canvas" class="dayflow-canvas" aria-label="Day Flow chart"></canvas>
        <input id="dayflow-time" type="range" min="0" max="${Math.max(0, payload.buckets.length - 1)}" step="1" value="${Math.max(0, payload.buckets.length - 1)}" />
      </section>

      <section class="dayflow-side">
        <section class="card">
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
        name: band.name,
        viewers: curr?.viewers ?? 0,
        share: curr?.share ?? 0,
        momentum
      }
    })
    .sort((a, b) => b.viewers - a.viewers)
    .slice(0, 5)

  const momentumLeader = [...focusItems].sort((a, b) => b.momentum - a.momentum)[0]
  target.innerHTML = `
    <div class="kv-row"><span>Selected</span><strong>${payload.buckets[bucketIndex]?.slice(11, 16) ?? "N/A"}</strong></div>
    ${focusItems.map((item, idx) => `<div class="kv-row"><span>#${idx + 1} ${item.name}</span><strong>${numberFmt.format(item.viewers)} (${pctFmt.format(item.share)})</strong></div>`).join("")}
    <div class="kv-row"><span>Strongest momentum</span><strong>${momentumLeader?.name ?? "N/A"}</strong></div>
    <div class="kv-row"><span>Highest activity</span><strong>${payload.activity.available ? "Available" : "Activity unavailable"}</strong></div>
  `
}

function renderDetail(target: HTMLElement, payload: DayFlowPayload, streamerId: string | null) {
  const id = streamerId ?? payload.detailPanelSource.defaultStreamerId
  const detail = payload.detailPanelSource.streamers.find((streamer) => streamer.streamerId === id)

  if (!detail) {
    target.innerHTML = `<h2>Detail</h2><p class="muted">Tap a band to inspect streamer details.</p>`
    return
  }

  target.innerHTML = `
    <h2>Detail Panel</h2>
    <div class="kv">
      <div class="kv-row"><span>Streamer</span><strong>${detail.name}</strong></div>
      <div class="kv-row"><span>Title</span><strong>${detail.title || "N/A"}</strong></div>
      <div class="kv-row"><span>Peak viewers</span><strong>${numberFmt.format(detail.peakViewers)}</strong></div>
      <div class="kv-row"><span>Avg viewers</span><strong>${numberFmt.format(detail.avgViewers)}</strong></div>
      <div class="kv-row"><span>Viewer-minutes</span><strong>${numberFmt.format(detail.viewerMinutes)}</strong></div>
      <div class="kv-row"><span>Peak share</span><strong>${pctFmt.format(detail.peakShare)}</strong></div>
      <div class="kv-row"><span>Highest activity</span><strong>${detail.highestActivity ?? "Activity unavailable"}</strong></div>
      <div class="kv-row"><span>Biggest rise time</span><strong>${detail.biggestRiseTime?.slice(11, 16) ?? "N/A"}</strong></div>
      <div class="kv-row"><span>First seen / Last seen</span><strong>${detail.firstSeen?.slice(11, 16) ?? "N/A"} / ${detail.lastSeen?.slice(11, 16) ?? "N/A"}</strong></div>
    </div>
    <div class="actions">
      <a class="action" href="${detail.url}" target="_blank" rel="noreferrer">Open stream</a>
      <a class="action" href="/battle-lines/">Jump to Battle Lines</a>
    </div>
  `
}

async function mountData(form: HTMLFormElement, content: HTMLElement): Promise<void> {
  content.innerHTML = `<section class="card"><h2>Loading Day Flow…</h2></section>`

  let payload: DayFlowPayload
  try {
    payload = await getDayFlowPayload(parseFilters(form))
  } catch {
    content.innerHTML = `<section class="card"><h2>Error</h2><p>Could not load /api/day-flow. <button id="retry-dayflow">Retry</button></p></section>`
    content.querySelector("#retry-dayflow")?.addEventListener("click", () => {
      void mountData(form, content)
    })
    return
  }

  content.innerHTML = renderFrame(payload)

  const canvas = content.querySelector<HTMLCanvasElement>("#dayflow-canvas")
  const slider = content.querySelector<HTMLInputElement>("#dayflow-time")
  const focus = content.querySelector<HTMLElement>("#dayflow-focus")
  const detail = content.querySelector<HTMLElement>("#dayflow-detail")
  if (!canvas || !slider || !focus || !detail) return

  let selectedBucket = payload.buckets[Math.max(0, payload.buckets.length - 1)] ?? null
  let selectedStreamerId = payload.detailPanelSource.defaultStreamerId
  let mode = parseFilters(form).mode

  const renderer = drawChart(canvas, payload, selectedBucket, selectedStreamerId, mode)

  const refresh = () => {
    const idx = Number(slider.value)
    selectedBucket = payload.buckets[idx] ?? selectedBucket
    renderFocus(focus, payload, idx)
    renderDetail(detail, payload, selectedStreamerId)
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
  })

  form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("select[name='mode']").forEach((field) => {
    field.addEventListener("change", () => {
      mode = parseFilters(form).mode
      renderer.redraw()
    })
  })

  refresh()
}

export function renderDayFlowPage(root: HTMLElement): void {
  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("day-flow")}
    ${renderHero({
      eyebrow: "TODAY",
      title: "Day Flow",
      subtitle: "Real-data Twitch day landscape (MVP).",
      note: "Default: Today · 5m · Top20 + Others · Volume. Fixed band order by daily viewer-minutes.",
      actions: [
        { href: "/heatmap/", label: "Open Heatmap" },
        { href: "/method/", label: "Open Method" }
      ]
    })}

    <form class="controls" id="day-flow-controls">
      <select name="day" aria-label="Day"><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="date">Date</option></select>
      <input type="date" name="date" aria-label="Date picker" />
      <select name="top" aria-label="Top N"><option value="10">Top 10 + Others</option><option value="20" selected>Top 20 + Others</option><option value="50">Top 50 + Others</option></select>
      <select name="mode" aria-label="Mode"><option value="volume" selected>Volume</option><option value="share">Share</option></select>
      <select name="bucket" aria-label="Bucket"><option value="5" selected>5m</option><option value="10">10m</option></select>
      <label class="pill"><input type="checkbox" id="auto-update" checked /> Auto update</label>
      <button type="submit">Refresh</button>
    </form>

    <div id="day-flow-content"></div>

    ${renderStatusNote("If activity data is unavailable, Day Flow shows explicit unavailable state instead of synthetic values.")}
    ${renderFooter()}
  `

  const form = root.querySelector<HTMLFormElement>("#day-flow-controls")
  const content = root.querySelector<HTMLElement>("#day-flow-content")
  const autoUpdate = root.querySelector<HTMLInputElement>("#auto-update")
  if (!form || !content || !autoUpdate) return

  form.addEventListener("submit", (event) => {
    event.preventDefault()
    void mountData(form, content)
  })

  let timer: number | null = window.setInterval(() => {
    if (autoUpdate.checked && parseFilters(form).day === "today") {
      void mountData(form, content)
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
          void mountData(form, content)
        }
      }, 60_000)
    }
  })

  void mountData(form, content)
}
