import "../shared/styles/tokens.css"
import "../shared/styles/reset.css"
import "../shared/styles/layout.css"
import "../shared/styles/components.css"
import "../shared/styles/pages.css"

import { renderKickDonatePage } from "../features/kick-donate/page"

const root = document.querySelector<HTMLDivElement>("#app")
if (!root) throw new Error("Kick donate root element not found")
renderKickDonatePage(root)
