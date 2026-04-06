import "../shared/styles/pages.css"
import { renderKickHeatmapPage } from "../features/kick-heatmap/page"

const root = document.querySelector<HTMLDivElement>("#app")
if (!root) throw new Error("Kick heatmap root element not found")

void renderKickHeatmapPage(root)
