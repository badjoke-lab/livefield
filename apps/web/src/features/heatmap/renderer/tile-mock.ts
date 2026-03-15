import type { HeatmapNode } from "../../../../../packages/shared/src/types/heatmap"
import { readAnimationEnabled } from "../../../shared/runtime/animation-mode"
import { getActivityState } from "../activity-state"

type Rect = { x: number; y: number; w: number; h: number }

type TileCell = {
  node: HeatmapNode
  rect: Rect
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function layoutTreemap(nodes: HeatmapNode[], rect: Rect): TileCell[] {
  if (nodes.length === 0) return []
  if (nodes.length === 1) return [{ node: nodes[0], rect }]

  const total = nodes.reduce((sum, node) => sum + Math.max(node.viewers, 1), 0)
  const half = total / 2
  let running = 0
  let splitIndex = 1

  for (let i = 0; i < nodes.length; i += 1) {
    running += Math.max(nodes[i].viewers, 1)
    splitIndex = i + 1
    if (running >= half) break
  }

  const left = nodes.slice(0, splitIndex)
  const right = nodes.slice(splitIndex)
  const leftWeight = left.reduce((sum, node) => sum + Math.max(node.viewers, 1), 0)
  const ratio = leftWeight / total

  if (rect.w >= rect.h) {
    const splitW = rect.w * ratio
    return [
      ...layoutTreemap(left, { x: rect.x, y: rect.y, w: splitW, h: rect.h }),
      ...layoutTreemap(right, { x: rect.x + splitW, y: rect.y, w: rect.w - splitW, h: rect.h })
    ]
  }

  const splitH = rect.h * ratio
  return [
    ...layoutTreemap(left, { x: rect.x, y: rect.y, w: rect.w, h: splitH }),
    ...layoutTreemap(right, { x: rect.x, y: rect.y + splitH, w: rect.w, h: rect.h - splitH })
  ]
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
  return '<span class="tile-node__badge tile-node__badge--not-sampled">activity unavailable</span>'
}

export function mountTileMockRenderer(
  root: HTMLElement,
  nodes: HeatmapNode[],
  selectedId: string,
  onSelect: (nextId: string) => void
): void {
  const sorted = [...nodes].sort((a, b) => b.viewers - a.viewers)
  const cells = layoutTreemap(sorted, { x: 0, y: 0, w: 100, h: 100 })

  root.dataset.animation = readAnimationEnabled() ? "on" : "off"

  root.innerHTML = cells
    .map(({ node, rect }) => {
      const state = getActivityState(node)
      const selected = node.streamerId === selectedId
      const showMeta = rect.w > 16 && rect.h > 16
      const showTitle = rect.w > 10 && rect.h > 9
      return `<article class="tile-node ${getMomentumClass(node.momentum)} tile-node--${state} ${selected ? "tile-node--selected" : ""}" style="left:${rect.x.toFixed(3)}%;top:${rect.y.toFixed(3)}%;width:${rect.w.toFixed(3)}%;height:${rect.h.toFixed(3)};">
        <button type="button" class="tile-node__select" data-streamer-id="${escapeHtml(node.streamerId)}" aria-label="Select ${escapeHtml(node.name)} tile">
          <span class="tile-node__tone" aria-hidden="true"></span>
          ${showTitle ? `<span class="tile-node__name">${escapeHtml(node.name)}</span>` : ""}
          ${showMeta ? `<span class="tile-node__viewers">${node.viewers.toLocaleString()} viewers</span>${getActivityBadge(node)}` : ""}
        </button>
        <a class="tile-node__stream-link" href="${escapeHtml(node.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(node.name)} stream">↗</a>
      </article>`
    })
    .join("")

  root.querySelectorAll<HTMLButtonElement>("[data-streamer-id]").forEach((button) => {
    button.onclick = () => {
      const nextId = button.dataset.streamerId
      if (nextId) onSelect(nextId)
    }
  })
}
