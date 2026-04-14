import "../shared/styles/tokens.css"
import "../shared/styles/reset.css"
import "../shared/styles/layout.css"
import "../shared/styles/components.css"
import "../shared/styles/pages.css"

import { renderKickAboutPage } from "../features/kick-about/page"

const root = document.querySelector<HTMLDivElement>("#app")
if (!root) throw new Error("Kick about root element not found")
renderKickAboutPage(root)
