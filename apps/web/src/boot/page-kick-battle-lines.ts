import "../shared/styles/pages.css"
import { renderKickBattleLinesPage } from "../features/kick-battle-lines/page"

const root = document.querySelector<HTMLDivElement>("#app")
if (!root) throw new Error("Kick battle lines root element not found")

void renderKickBattleLinesPage(root)
