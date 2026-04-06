import { renderKickAboutPage } from "../features/kick-about/page"

const root = document.querySelector<HTMLDivElement>("#app")
if (!root) throw new Error("Kick about root element not found")
renderKickAboutPage(root)
