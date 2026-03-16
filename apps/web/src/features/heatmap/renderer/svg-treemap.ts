import type { HeatmapNode } from "../../../../../packages/shared/src/types/heatmap"
import { readAnimationEnabled } from "../../../shared/runtime/animation-mode"
import { getActivityState } from "../activity-state"
import { computeSquarifiedTreemap } from "./layout"
import { mountTreemapInteraction, type TreemapInteractionHandle } from "./interaction"

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function abbreviate(value: string, maxLength = 12): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(3, maxLength - 1))}…`
}

function momentumBucket(momentum: number): "rise-3" | "rise-2" | "rise-1" | "fall-3" | "fall-2" | "fall-1" | "flat" {
  if (momentum >= 0.15) return "rise-3"
  if (momentum >= 0.08) return "rise-2"
  if (momentum >= 0.03) return "rise-1"
  if (momentum <= -0.15) return "fall-3"
  if (momentum <= -0.08) return "fall-2"
  if (momentum <= -0.03) return "fall-1"
  return "flat"
}

function renderLabels(node: HeatmapNode, w: number, h: number): string {
  const area = w * h
  const nameSize = Math.max(10, Math.min(16, Math.sqrt(area) * 0.065))
  const valueSize = Math.max(9, nameSize - 2)
  const baseX = 7
  const baseY = 16

  return `<g class="treemap-node__labels" data-area="${area.toFixed(2)}">
      <text class="treemap-node__name treemap-node__name--abbr" x="${baseX}" y="${baseY}" style="font-size:${Math.max(9, nameSize - 1.5).toFixed(1)}px">${escapeHtml(abbreviate(node.name, 10))}</text>
      <text class="treemap-node__name treemap-node__name--full" x="${baseX}" y="${baseY}" style="font-size:${nameSize.toFixed(1)}px">${escapeHtml(node.name)}</text>
      <text class="treemap-node__viewers" x="${baseX}" y="${(baseY + nameSize + 4).toFixed(1)}" style="font-size:${valueSize.toFixed(1)}px">${escapeHtml(`${node.viewers.toLocaleString()} viewers`)}</text>
    </g>`
}

function renderActivityCue(node: HeatmapNode, w: number, h: number): string {
  const state = getActivityState(node)
  const cx = Math.max(10, w - 12)
  const cy = 12

  if (state === "active") {
    return `<circle class="treemap-node__marker treemap-node__marker--active" cx="${cx}" cy="${cy}" r="3.2"></circle>
      <circle class="treemap-node__pulse" cx="${cx}" cy="${cy}" r="7"></circle>`
  }

  if (state === "sampled_zero") {
    return `<circle class="treemap-node__marker treemap-node__marker--sampled-zero" cx="${cx}" cy="${cy}" r="3.2"></circle>`
  }

  if (state === "unavailable_sampled") {
    return `<rect class="treemap-node__unavailable-overlay" x="1" y="1" width="${Math.max(0, w - 2)}" height="${Math.max(0, h - 2)}" rx="4"></rect>
      <rect class="treemap-node__marker treemap-node__marker--unavailable" x="${Math.max(4, w - 18)}" y="4" width="14" height="8" rx="2"></rect>`
  }

  return `<circle class="treemap-node__marker treemap-node__marker--not-sampled" cx="${cx}" cy="${cy}" r="2.8"></circle>`
}

function renderNode(node: HeatmapNode, selectedId: string, rect: { x: number; y: number; w: number; h: number }): string {
  const selected = node.streamerId === selectedId
  const tileClass = `treemap-node treemap-node--${momentumBucket(node.momentum)} treemap-node--${getActivityState(node)}${selected ? " treemap-node--selected" : ""}`
  const rounded = Math.max(1.2, Math.min(4, Math.min(rect.w, rect.h) * 0.07))
  const area = rect.w * rect.h

  const linkSize = Math.max(10, Math.min(18, Math.min(rect.w, rect.h) * 0.2))
  const linkX = Math.max(2, rect.w - linkSize - 3)
  const linkY = 3

  return `<g class="${tileClass}" transform="translate(${rect.x.toFixed(3)} ${rect.y.toFixed(3)})" data-area="${area.toFixed(2)}">
    <rect class="treemap-node__body" data-streamer-id="${escapeHtml(node.streamerId)}" role="button" tabindex="0" aria-label="Select ${escapeHtml(node.name)} tile" width="${rect.w.toFixed(3)}" height="${rect.h.toFixed(3)}" rx="${rounded.toFixed(2)}"></rect>
    ${renderActivityCue(node, rect.w, rect.h)}
    ${renderLabels(node, rect.w, rect.h)}
    ${area > 700 ? `<a class="treemap-node__stream-link" href="${escapeHtml(node.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(node.name)} stream">
      <rect class="treemap-node__link-hit" x="${linkX.toFixed(2)}" y="${linkY.toFixed(2)}" width="${linkSize.toFixed(2)}" height="${linkSize.toFixed(2)}" rx="3"></rect>
      <text x="${(linkX + linkSize / 2).toFixed(2)}" y="${(linkY + linkSize / 2 + 4).toFixed(2)}" text-anchor="middle">↗</text>
    </a>` : ""}
  </g>`
}

function updateLabelVisibility(root: HTMLElement, zoomScale: number): void {
  const nodeGroups = root.querySelectorAll<SVGGElement>(".treemap-node")
  nodeGroups.forEach((group) => {
    const area = Number(group.dataset.area ?? "0")
    const effectiveArea = area * zoomScale * zoomScale
    const labels = group.querySelector<SVGGElement>(".treemap-node__labels")
    if (!labels) return

    const abbr = labels.querySelector<SVGTextElement>(".treemap-node__name--abbr")
    const full = labels.querySelector<SVGTextElement>(".treemap-node__name--full")
    const viewers = labels.querySelector<SVGTextElement>(".treemap-node__viewers")

    if (effectiveArea < 1700) {
      labels.style.display = "none"
      return
    }

    labels.style.display = ""

    if (effectiveArea < 5000) {
      if (abbr) abbr.style.display = ""
      if (full) full.style.display = "none"
      if (viewers) viewers.style.display = "none"
      return
    }

    if (effectiveArea < 11000) {
      if (abbr) abbr.style.display = "none"
      if (full) full.style.display = ""
      if (viewers) viewers.style.display = "none"
      return
    }

    if (abbr) abbr.style.display = "none"
    if (full) full.style.display = ""
    if (viewers) viewers.style.display = ""
  })
}

function getTreemapBounds(viewport: HTMLElement): { x: number; y: number; w: number; h: number; viewportWidth: number; viewportHeight: number } {
  const viewportWidth = Math.max(320, Math.round(viewport.clientWidth || 1000))
  const viewportHeight = Math.max(260, Math.round(viewport.clientHeight || 620))
  const pad = viewportWidth <= 760 ? 8 : 12

  return {
    x: pad,
    y: pad,
    w: Math.max(40, viewportWidth - pad * 2),
    h: Math.max(40, viewportHeight - pad * 2),
    viewportWidth,
    viewportHeight
  }
}

function renderTreemapSvg(svg: SVGSVGElement, sorted: HeatmapNode[], selectedId: string, viewport: HTMLElement): void {
  const bounds = getTreemapBounds(viewport)
  const cells = computeSquarifiedTreemap(sorted, { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h })

  svg.setAttribute("viewBox", `0 0 ${bounds.viewportWidth} ${bounds.viewportHeight}`)
  svg.setAttribute("preserveAspectRatio", "none")
  svg.innerHTML = `<defs>
      <pattern id="heatmap-unavailable-pattern" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,173,126,0.38)" stroke-width="2"></line>
      </pattern>
    </defs>
    ${cells.map(({ node, rect }) => renderNode(node, selectedId, rect)).join("")}`
}

export function mountSvgTreemapRenderer(
  root: HTMLElement,
  nodes: HeatmapNode[],
  selectedId: string,
  onSelect: (nextId: string) => void,
  controls: {
    zoomInButton?: HTMLButtonElement | null
    zoomOutButton?: HTMLButtonElement | null
    zoomResetButton?: HTMLButtonElement | null
    focusButton?: HTMLButtonElement | null
    focusStatus?: HTMLElement | null
  } = {}
): () => void {
  const sorted = [...nodes].sort((a, b) => b.viewers - a.viewers)

  root.dataset.animation = readAnimationEnabled() ? "on" : "off"
  root.innerHTML = `<div class="heatmap-tile-stage__surface"><svg class="heatmap-svg" aria-label="Live stream treemap"></svg></div>`

  const svg = root.querySelector<SVGSVGElement>(".heatmap-svg")
  const surface = root.querySelector<HTMLElement>(".heatmap-tile-stage__surface")
  if (!svg || !surface) return () => undefined

  renderTreemapSvg(svg, sorted, selectedId, root)

  const applyFocusUi = (focused: boolean) => {
    root.dataset.focused = focused ? "on" : "off"
    controls.focusButton?.setAttribute("aria-pressed", focused ? "true" : "false")
    if (controls.focusButton) controls.focusButton.textContent = focused ? "Exit map focus" : "Focus map"
    if (controls.focusStatus) {
      controls.focusStatus.textContent = focused ? "Map focus: ON (wheel zoom + drag pan, Esc to exit)" : "Map focus: OFF (wheel scrolls page)"
    }
  }

  const interaction: TreemapInteractionHandle = mountTreemapInteraction(
    root,
    surface,
    (transform) => {
      updateLabelVisibility(svg, transform.scale)
    },
    (focused) => applyFocusUi(focused)
  )
  updateLabelVisibility(svg, 1)

  const handleSvgClick = (event: Event) => {
    const target = event.target as Element | null
    const link = target?.closest("a.treemap-node__stream-link")
    if (link) {
      event.stopPropagation()
      return
    }

    const tile = target?.closest<SVGRectElement>("[data-streamer-id]")
    const nextId = tile?.dataset.streamerId
    if (nextId) onSelect(nextId)
  }

  const handleSvgKeydown = (event: KeyboardEvent) => {
    const target = event.target as Element | null
    const tile = target?.closest<SVGRectElement>("[data-streamer-id]")
    const nextId = tile?.dataset.streamerId
    if (!nextId) return

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelect(nextId)
    }
  }

  const handleStageFocus = (event: PointerEvent) => {
    const target = event.target as Element | null
    const tile = target?.closest("[data-streamer-id], a.treemap-node__stream-link")
    if (!tile) {
      interaction.focus()
    }
  }

  const handleFocusButton = () => {
    if (interaction.isFocused()) interaction.blur()
    else interaction.focus()
  }

  const handleWindowResize = () => {
    renderTreemapSvg(svg, sorted, selectedId, root)
    updateLabelVisibility(svg, 1)
  }

  svg.addEventListener("click", handleSvgClick)
  svg.addEventListener("keydown", handleSvgKeydown)
  controls.zoomInButton?.addEventListener("click", interaction.zoomIn)
  controls.zoomOutButton?.addEventListener("click", interaction.zoomOut)
  controls.zoomResetButton?.addEventListener("click", interaction.reset)
  controls.focusButton?.addEventListener("click", handleFocusButton)
  root.addEventListener("pointerdown", handleStageFocus)
  window.addEventListener("resize", handleWindowResize)

  applyFocusUi(interaction.isFocused())

  return () => {
    svg.removeEventListener("click", handleSvgClick)
    svg.removeEventListener("keydown", handleSvgKeydown)
    window.removeEventListener("resize", handleWindowResize)
    controls.zoomInButton?.removeEventListener("click", interaction.zoomIn)
    controls.zoomOutButton?.removeEventListener("click", interaction.zoomOut)
    controls.zoomResetButton?.removeEventListener("click", interaction.reset)
    controls.focusButton?.removeEventListener("click", handleFocusButton)
    root.removeEventListener("pointerdown", handleStageFocus)
    interaction.destroy()
  }
}
