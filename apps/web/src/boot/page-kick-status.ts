import "../shared/styles/pages.css"
import { renderKickStatusPage } from "../features/kick-status/page"

const root = document.querySelector<HTMLDivElement>("#app")
if (!root) throw new Error("Kick status root element not found")
renderKickStatusPage(root)
