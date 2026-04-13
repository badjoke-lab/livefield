import "../shared/styles/tokens.css"
import "../shared/styles/reset.css"
import "../shared/styles/layout.css"
import "../shared/styles/components.css"
import "../shared/styles/pages.css"
import { renderKickBattleLinesPage } from "../features/kick-battle-lines/page"

const root = document.querySelector<HTMLElement>("#app")
if (!root) throw new Error("#app not found")
renderKickBattleLinesPage(root)
