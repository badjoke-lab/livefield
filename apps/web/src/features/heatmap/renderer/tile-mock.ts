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

function getMomentumClass(momentum: number): string {
  if (momentum >= 0.15) return "tile-node--rise-3"
  if (momentum >= 0.08) return "tile-node--rise-2"
  if (momentum >= 0.03) return "tile-node--rise-1"
  if (momentum <= -0.15) return "tile-node--fall-3"
  if (momentum <= -0.08) return "tile-node--fall-2"
  if (momentum <= -0.03) return "tile-node--fall-1"
  if (Math.abs(momentum) <= 0.01) return "tile-node--flat-0"
  return "tile-node--flat-1"
}

function getActivityBadge(node: HeatmapNode): string {
  const state = getActivityState(node)
  if (state === "active") return '<span class="tile-node__badge tile-node__badge--active">activity sampled</span>'
  if (state === "sampled_zero") return '<span class="tile-node__badge tile-node__badge--sampled-zero">sampled · no activity</span>'
  if (state === "unavailable_sampled") return '<span class="tile-node__badge tile-node__badge--unavailable">sampled · unavailable</span>'
  return '<span class="tile-node__badge tile-node__badge--not-sampled">not sampled</span>'
}

function renderTile(node: HeatmapNode, selectedId: string, rect: { x: number; y: number; w: number; h: number }): string {
  const state = getActivityState(node)
  const selected = node.streamerId === selectedId
  const area = rect.w * rect.h
  const showMeta = area > 160
  const showName = area > 52
  return `<article class="tile-node ${getMomentumClass(node.momentum)} tile-node--${state} ${selected ? "tile-node--selected" : ""}" style="left:${rect.x.toFixed(3)}%;top:${rect.y.toFixed(3)}%;width:${rect.w.toFixed(3)}%;height:${rect.h.toFixed(3)}%;">
      <button type="button" class="tile-node__select" data-streamer-id="${escapeHtml(node.streamerId)}" aria-label="Select ${escapeHtml(node.name)} tile">
        <span class="tile-node__tone" aria-hidden="true"></span>
        <span class="tile-node__micro" aria-hidden="true"></span>
        ${showName ? `<span class="tile-node__name">${escapeHtml(node.name)}</span>` : ""}
        ${showMeta ? `<span class="tile-node__viewers">${node.viewers.toLocaleString()} viewers</span>${getActivityBadge(node)}` : ""}
      </button>
      <a class="tile-node__stream-link" href="${escapeHtml(node.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(node.name)} stream">↗</a>
    </article>`
}

export function mountTileMockRenderer(
  root: HTMLElement,
  nodes: HeatmapNode[],
  selectedId: string,
  onSelect: (nextId: string) => void,
  controls: { zoomInButton?: HTMLButtonElement | null; zoomOutButton?: HTMLButtonElement | null; zoomResetButton?: HTMLButtonElement | null } = {}
): () => void {
  const sorted = [...nodes].sort((a, b) => b.viewers - a.viewers)
  const cells = computeSquarifiedTreemap(sorted, { x: 0, y: 0, w: 100, h: 100 })

  root.dataset.animation = readAnimationEnabled() ? "on" : "off"
  root.innerHTML = `<div class="heatmap-tile-stage__surface">${cells.map(({ node, rect }) => renderTile(node, selectedId, rect)).join("")}</div>`

  root.querySelectorAll<HTMLButtonElement>("[data-streamer-id]").forEach((button) => {
    button.onclick = () => {
      const nextId = button.dataset.streamerId
      if (nextId) onSelect(nextId)
    }
  })

  const surface = root.querySelector<HTMLElement>(".heatmap-tile-stage__surface")
  if (!surface) return () => undefined

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
