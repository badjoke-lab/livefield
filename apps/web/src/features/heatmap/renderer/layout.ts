import type { HeatmapNode } from "../../../../../packages/shared/src/types/heatmap"

export type Rect = { x: number; y: number; w: number; h: number }

export type TileCell = {
  node: HeatmapNode
  rect: Rect
}

type WeightedNode = {
  node: HeatmapNode
  area: number
}

function normalizeArea(nodes: HeatmapNode[], rect: Rect): WeightedNode[] {
  const totalWeight = nodes.reduce((sum, node) => sum + Math.max(node.viewers, 1), 0)
  if (totalWeight <= 0) return []
  const totalArea = rect.w * rect.h
  return nodes.map((node) => ({
    node,
    area: (Math.max(node.viewers, 1) / totalWeight) * totalArea
  }))
}

function worstRatio(row: WeightedNode[], shortEdge: number): number {
  if (row.length === 0 || shortEdge <= 0) return Number.POSITIVE_INFINITY
  const sum = row.reduce((acc, item) => acc + item.area, 0)
  if (sum <= 0) return Number.POSITIVE_INFINITY

  let minArea = Number.POSITIVE_INFINITY
  let maxArea = 0
  for (const item of row) {
    if (item.area < minArea) minArea = item.area
    if (item.area > maxArea) maxArea = item.area
  }

  const shortSq = shortEdge * shortEdge
  return Math.max((shortSq * maxArea) / (sum * sum), (sum * sum) / (shortSq * minArea))
}

function layoutRow(row: WeightedNode[], rect: Rect): TileCell[] {
  if (row.length === 0) return []

  const rowArea = row.reduce((sum, item) => sum + item.area, 0)
  const result: TileCell[] = []

  // Squarified layout: place the row along the shorter edge of available rect.
  if (rect.w >= rect.h) {
    const rowWidth = rowArea / rect.h
    let cursorY = rect.y
    for (const item of row) {
      const itemHeight = item.area / rowWidth
      result.push({ node: item.node, rect: { x: rect.x, y: cursorY, w: rowWidth, h: itemHeight } })
      cursorY += itemHeight
    }

    const remainder = rect.y + rect.h - cursorY
    if (remainder !== 0 && result.length > 0) result[result.length - 1].rect.h += remainder
    return result
  }

  const rowHeight = rowArea / rect.w
  let cursorX = rect.x
  for (const item of row) {
    const itemWidth = item.area / rowHeight
    result.push({ node: item.node, rect: { x: cursorX, y: rect.y, w: itemWidth, h: rowHeight } })
    cursorX += itemWidth
  }

  const remainder = rect.x + rect.w - cursorX
  if (remainder !== 0 && result.length > 0) result[result.length - 1].rect.w += remainder
  return result
}

function shrinkRect(rect: Rect, usedArea: number): Rect {
  if (rect.w >= rect.h) {
    const usedWidth = usedArea / rect.h
    return { x: rect.x + usedWidth, y: rect.y, w: Math.max(0, rect.w - usedWidth), h: rect.h }
  }

  const usedHeight = usedArea / rect.w
  return { x: rect.x, y: rect.y + usedHeight, w: rect.w, h: Math.max(0, rect.h - usedHeight) }
}

export function computeSquarifiedTreemap(nodes: HeatmapNode[], bounds: Rect): TileCell[] {
  if (nodes.length === 0 || bounds.w <= 0 || bounds.h <= 0) return []

  const weighted = normalizeArea([...nodes].sort((a, b) => b.viewers - a.viewers), bounds)
  const cells: TileCell[] = []
  let available = { ...bounds }
  let queue = weighted

  while (queue.length > 0 && available.w > 0 && available.h > 0) {
    const row: WeightedNode[] = []
    const shortEdge = Math.min(available.w, available.h)
    let best = Number.POSITIVE_INFINITY

    while (queue.length > 0) {
      const next = queue[0]
      const candidate = [...row, next]
      const score = worstRatio(candidate, shortEdge)
      if (row.length === 0 || score <= best) {
        row.push(next)
        best = score
        queue = queue.slice(1)
      } else {
        break
      }
    }

    const rowCells = layoutRow(row, available)
    cells.push(...rowCells)
    const usedArea = row.reduce((sum, item) => sum + item.area, 0)
    available = shrinkRect(available, usedArea)
  }

  return cells
}
