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
  if (area < 1800) return ""

  const nameSize = Math.max(11, Math.min(16, Math.sqrt(area) * 0.065))
  const valueSize = Math.max(10, nameSize - 2)
  const baseX = 8
  const baseY = 18

  const viewers = `${node.viewers.toLocaleString()} viewers`
  return `<text class="treemap-node__name" x="${baseX}" y="${baseY}" style="font-size:${nameSize.toFixed(1)}px">${escapeHtml(node.name)}</text>
      ${area > 4200 ? `<text class="treemap-node__viewers" x="${baseX}" y="${(baseY + nameSize + 4).toFixed(1)}" style="font-size:${valueSize.toFixed(1)}px">${escapeHtml(viewers)}</text>` : ""}`
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
  const rounded = Math.max(2, Math.min(6, Math.min(rect.w, rect.h) * 0.08))

  const linkSize = Math.max(12, Math.min(20, Math.min(rect.w, rect.h) * 0.22))
  const linkX = Math.max(2, rect.w - linkSize - 3)
  const linkY = 3

  return `<g class="${tileClass}" transform="translate(${rect.x.toFixed(3)} ${rect.y.toFixed(3)})">
    <rect class="treemap-node__body" data-streamer-id="${escapeHtml(node.streamerId)}" role="button" tabindex="0" aria-label="Select ${escapeHtml(node.name)} tile" width="${rect.w.toFixed(3)}" height="${rect.h.toFixed(3)}" rx="${rounded.toFixed(2)}"></rect>
    ${renderActivityCue(node, rect.w, rect.h)}
    ${renderLabels(node, rect.w, rect.h)}
    ${rect.w * rect.h > 900 ? `<a class="treemap-node__stream-link" href="${escapeHtml(node.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(node.name)} stream">
      <rect class="treemap-node__link-hit" x="${linkX.toFixed(2)}" y="${linkY.toFixed(2)}" width="${linkSize.toFixed(2)}" height="${linkSize.toFixed(2)}" rx="3"></rect>
      <text x="${(linkX + linkSize / 2).toFixed(2)}" y="${(linkY + linkSize / 2 + 4).toFixed(2)}" text-anchor="middle">↗</text>
    </a>` : ""}
  </g>`
}

export function mountSvgTreemapRenderer(
  root: HTMLElement,
  nodes: HeatmapNode[],
  selectedId: string,
  onSelect: (nextId: string) => void,
  controls: { zoomInButton?: HTMLButtonElement | null; zoomOutButton?: HTMLButtonElement | null; zoomResetButton?: HTMLButtonElement | null } = {}
): () => void {
  const sorted = [...nodes].sort((a, b) => b.viewers - a.viewers)
  const bounds = { x: 0, y: 0, w: 1000, h: 620 }
  const cells = computeSquarifiedTreemap(sorted, bounds)

  root.dataset.animation = readAnimationEnabled() ? "on" : "off"
  root.innerHTML = `<div class="heatmap-tile-stage__surface"><svg class="heatmap-svg" viewBox="0 0 ${bounds.w} ${bounds.h}" aria-label="Live stream treemap">
      <defs>
        <pattern id="heatmap-unavailable-pattern" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,173,126,0.38)" stroke-width="2"></line>
        </pattern>
      </defs>
      ${cells.map(({ node, rect }) => renderNode(node, selectedId, rect)).join("")}
    </svg></div>`

  const svg = root.querySelector<SVGSVGElement>(".heatmap-svg")
  const surface = root.querySelector<HTMLElement>(".heatmap-tile-stage__surface")
  if (!svg || !surface) return () => undefined

  svg.querySelectorAll<SVGAElement>("a.treemap-node__stream-link").forEach((a) => {
    a.addEventListener("click", (event) => event.stopPropagation())
  })

  svg.querySelectorAll<SVGRectElement>("[data-streamer-id]").forEach((element) => {
    const handleSelect = () => {
      const nextId = element.dataset.streamerId
      if (nextId) onSelect(nextId)
    }
    element.addEventListener("click", handleSelect)
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        handleSelect()
      }
    })
  })

  const interaction: TreemapInteractionHandle = mountTreemapInteraction(root, surface)
  controls.zoomInButton?.addEventListener("click", interaction.zoomIn)
  controls.zoomOutButton?.addEventListener("click", interaction.zoomOut)
  controls.zoomResetButton?.addEventListener("click", interaction.reset)

  return () => {
    controls.zoomInButton?.removeEventListener("click", interaction.zoomIn)
    controls.zoomOutButton?.removeEventListener("click", interaction.zoomOut)
    controls.zoomResetButton?.removeEventListener("click", interaction.reset)
    interaction.destroy()
  }
}
