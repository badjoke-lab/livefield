import "../shared/styles/pages.css"
import { renderKickDayFlowPage } from "../features/kick-day-flow/page"

const root = document.querySelector<HTMLDivElement>("#app")
if (!root) throw new Error("Kick day flow root element not found")

void renderKickDayFlowPage(root)
