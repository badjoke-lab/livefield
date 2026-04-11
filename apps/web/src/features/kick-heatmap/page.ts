import type { HeatmapPayload } from "../../../../../packages/shared/src/types/heatmap"
import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"
import { kickSiteConfig } from "../../shared/app-shell/site-config"
import { readAnimationEnabled, writeAnimationEnabled } from "../../shared/runtime/animation-mode"
import { readLowLoadEnabled, writeLowLoadEnabled } from "../../shared/runtime/low-load-mode"
import { getKickHeatmapScaffoldPayload } from "../../shared/api/kick-heatmap-api"
import { getActivityState } from "../heatmap/activity-state"
import { renderHeatmapDetailPanel } from "../heatmap/detail-panel"
import { mountSvgTreemapRenderer } from "../heatmap/renderer/svg-treemap"
import { renderHeatmapSummary } from "../heatmap/summary"
import { normalizeKickHeatmapPayload } from "./adapter"

type HeatmapMode = "live" | "stale" | "partial" | "empty" | "error" | "demo"

let pollTimer: number | null = null
let cleanupRenderer: (() => void) | null = null

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function getModeLabel(mode: HeatmapMode): string {
  if (mode === "demo") return "Demo data"
  if (mode === "error") return "Error state"
  if (mode === "empty") return "Empty state"
  if (mode === "stale") return "Stale data"
  if (mode === "partial") return "Partial data"
  return "Live data"
}

function getModeNote(mode: HeatmapMode, payload: HeatmapPayload, lowLoad: boolean, animationEnabled: boolean): string {
  const modeText =
    mode === "demo"
      ? "This is demo data, not a live collection feed."
      : mode === "error"
        ? "Kick heatmap payload is in an error fallback state."
        : mode === "empty"
          ? "No streams were available in the latest observed Kick window."
          : mode === "stale"
            ? "Kick data updates are delayed beyond the freshness target."
            : mode === "partial"
              ? "Coverage is partial for this frame; viewer values are shown for observed channels while activity chips remain unavailable."
              : "The current Kick payload is live for the observed window."

  return `${modeText} ${payload.note ?? ""} Low Load: ${lowLoad ? "ON" : "OFF"} / Animation: ${animationEnabled ? "ON" : "OFF"}`
}

function renderReady(root: HTMLElement, payload: HeatmapPayload, mode: HeatmapMode, selectedStreamerId?: string): void {
  cleanupRenderer?.()
  cleanupRenderer = null

  const lowLoad = readLowLoadEnabled()
  const animationEnabled = readAnimationEnabled()
  const visibleCount = lowLoad ? 24 : 50
  const visibleNodes = payload.nodes.slice(0, visibleCount)
  const selected = visibleNodes.find((node) => node.streamerId === selectedStreamerId) ?? visibleNodes[0]

  if (!selected) {
    root.className = "site-shell kick-site"
    root.innerHTML =
      `${renderHeader("heatmap", kickSiteConfig)}` +
      `${renderHero({
        eyebrow: "NOW",
        title: "Kick Heatmap",
        subtitle: "Production treemap for reading Kick streams at a glance.",
        note: `Treemap area = viewers / color = limited momentum / activity = unavailable. ${getModeLabel(mode)}.`,
        actions: [
          { href: "/kick/status/", label: "Open Status" },
          { href: "/kick/day-flow/", label: "Open Day Flow" }
        ]
      })}` +
      `<div class="controls controls--heatmap controls--heatmap-pre">
        <span class="pill">Top ${visibleCount}</span>
        <span class="pill">Kick live snapshot</span>
        <span class="pill">Visible tiles: 0</span>
        <span class="pill">${getModeLabel(mode)}</span>
        <span class="pill">Updated: ${escapeHtml(payload.updatedAt)}</span>
      </div>` +
      `<section class="card page-section">
        <h2>No streams in current observed window</h2>
        <p>${escapeHtml(payload.note ?? "The API returned no Kick streams for this observed window.")}</p>
      </section>` +
      `${renderStatusNote(getModeNote(mode, payload, lowLoad, animationEnabled))}` +
      `${renderFooter(kickSiteConfig)}`
    return
  }

  const activityBreakdown = visibleNodes.reduce(
    (acc, node) => {
      const state = getActivityState(node)
      if (state === "active") acc.active += 1
      else if (state === "sampled_zero") acc.sampledZero += 1
      else if (state === "unavailable_sampled") acc.sampledUnavailable += 1
      else acc.notSampled += 1
      return acc
    },
    { active: 0, sampledZero: 0, sampledUnavailable: 0, notSampled: 0 }
  )

  root.className = "site-shell kick-site"
  root.innerHTML =
    `${renderHeader("heatmap", kickSiteConfig)}` +
    `${renderHero({
      eyebrow: "NOW",
      title: "Kick Heatmap",
      subtitle: "Production treemap for reading Kick momentum at a glance.",
      note: "Area = viewers / color = limited momentum / activity = unavailable.",
      actions: [
        { href: "/kick/status/", label: "Open Status" },
        { href: "/kick/day-flow/", label: "Open Day Flow" }
      ]
    })}` +
    `<section class="card page-section heatmap-state-note">
      ${payload.note ? `<p>${escapeHtml(payload.note)}</p>` : `<p class="muted">Snapshot status: ${getModeLabel(mode)}.</p>`}
    </section>
    <section class="card page-section heatmap-map-section">
      <h2>Now view treemap</h2>
      <p class="muted">Tile area follows viewers. Kick momentum is currently limited to the strongest observed signal and activity remains unavailable until a Kick activity path exists.</p>
      <div class="heatmap-tile-stage" id="heatmapTileStage"></div>
      <div class="heatmap-map-helper">
        <span class="pill heatmap-map-helper__hint" data-focus-status>Map focus: OFF (wheel scrolls page)</span>
        <button type="button" class="pill" data-map-focus-toggle>Focus map</button>
        <button type="button" class="pill" data-zoom-in>Zoom in</button>
        <button type="button" class="pill" data-zoom-out>Zoom out</button>
        <button type="button" class="pill" data-zoom-reset>Reset zoom</button>
      </div>
    </section>
    <div class="controls controls--heatmap controls--heatmap-post">
      <span class="pill">Top ${visibleCount}</span>
      <span class="pill">Kick live snapshot</span>
      <button type="button" class="pill" data-low-load-toggle>Low Load: ${lowLoad ? "ON" : "OFF"}</button>
      <button type="button" class="pill" data-animation-toggle>Animation: ${animationEnabled ? "ON" : "OFF"}</button>
      <span class="pill">Visible tiles: ${visibleNodes.length}</span>
      <span class="pill">${getModeLabel(mode)}</span>
      <span class="pill">Updated: ${escapeHtml(payload.updatedAt)}</span>
    </div>
    ${renderHeatmapDetailPanel(selected, false)}
    <section class="card page-section heatmap-legend-section">
      <h2>Activity sampling legend</h2>
      <p class="muted">Kick activity path is not wired yet, so tiles are expected to remain unavailable for activity in this version.</p>
      <div class="heatmap-state-legend">
        <span class="heatmap-state-chip heatmap-state-chip--active">active (${activityBreakdown.active})</span>
        <span class="heatmap-state-chip heatmap-state-chip--sampled-zero">sampled · zero (${activityBreakdown.sampledZero})</span>
        <span class="heatmap-state-chip heatmap-state-chip--sampled-unavailable">sampled · unavailable (${activityBreakdown.sampledUnavailable})</span>
        <span class="heatmap-state-chip heatmap-state-chip--not-sampled">not sampled (${activityBreakdown.notSampled})</span>
      </div>
    </section>
    ${renderHeatmapSummary(payload, false)}
    ${renderStatusNote({
      eyebrow: "LIVE COVERAGE",
      title: "How to read Kick Heatmap status",
      body: getModeNote(mode, payload, lowLoad, animationEnabled),
      items: [
        "partial = observed channels are shown but Kick activity is still unavailable",
        "momentum is currently limited to the strongest observed signal from the latest snapshot window",
        "this page reuses the Twitch heatmap skeleton while Kick-specific signals are still being filled in"
      ],
      tone: mode === "partial" || mode === "stale" ? "warning" : "info"
    })}
    ${renderFooter(kickSiteConfig)}`

  const tileStage = root.querySelector<HTMLElement>("#heatmapTileStage")
  if (!tileStage) throw new Error("tile stage not found")

  cleanupRenderer = mountSvgTreemapRenderer(
    tileStage,
    visibleNodes,
    selected.streamerId,
    (nextId) => renderReady(root, payload, mode, nextId),
    {
      zoomInButton: root.querySelector<HTMLButtonElement>("[data-zoom-in]"),
      zoomOutButton: root.querySelector<HTMLButtonElement>("[data-zoom-out]"),
      zoomResetButton: root.querySelector<HTMLButtonElement>("[data-zoom-reset]"),
      focusButton: root.querySelector<HTMLButtonElement>("[data-map-focus-toggle]"),
      focusStatus: root.querySelector<HTMLElement>("[data-focus-status]")
    }
  )

  root.querySelector<HTMLButtonElement>("[data-low-load-toggle]")?.addEventListener("click", () => {
    writeLowLoadEnabled(!readLowLoadEnabled())
    renderReady(root, payload, mode, selected.streamerId)
  })

  root.querySelector<HTMLButtonElement>("[data-animation-toggle]")?.addEventListener("click", () => {
    writeAnimationEnabled(!readAnimationEnabled())
    renderReady(root, payload, mode, selected.streamerId)
  })
}

function renderLoading(root: HTMLElement): void {
  root.className = "site-shell kick-site"
  root.innerHTML =
    `${renderHeader("heatmap", kickSiteConfig)}` +
    `${renderHero({
      eyebrow: "NOW",
      title: "Kick Heatmap",
      subtitle: "Production treemap for reading Kick streams at a glance.",
      note: "Loading live field..."
    })}` +
    `<section class="card page-section"><h2>Loading</h2><p>Loading Kick Heatmap frame...</p></section>` +
    `${renderFooter(kickSiteConfig)}`
}

function renderError(root: HTMLElement, message: string): void {
  cleanupRenderer?.()
  cleanupRenderer = null
  root.className = "site-shell kick-site"
  root.innerHTML =
    `${renderHeader("heatmap", kickSiteConfig)}` +
    `${renderHero({
      eyebrow: "NOW",
      title: "Kick Heatmap",
      subtitle: "Production treemap for reading Kick streams at a glance.",
      note: "Kick Heatmap data load failed"
    })}` +
    `<section class="card page-section"><h2>Load failed</h2><p>${escapeHtml(message)}</p></section>` +
    `${renderFooter(kickSiteConfig)}`
}

export function renderKickHeatmapPage(root: HTMLElement): void {
  renderLoading(root)

  const refresh = () => {
    void getKickHeatmapScaffoldPayload()
      .then((raw) => {
        const payload = normalizeKickHeatmapPayload(raw)
        const mode = (payload.state ?? "error") as HeatmapMode
        renderReady(root, payload, mode)
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown error"
        renderError(root, message)
      })
  }

  refresh()

  if (pollTimer !== null) clearInterval(pollTimer)
  pollTimer = setInterval(refresh, 60_000) as unknown as number
}
