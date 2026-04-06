import { renderKickHomePage } from "../features/kick-home/page"

const root = document.querySelector<HTMLDivElement>("#app")
if (!root) throw new Error("Kick home root element not found")
renderKickHomePage(root)
