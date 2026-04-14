import "../shared/styles/tokens.css"
import "../shared/styles/reset.css"
import "../shared/styles/layout.css"
import "../shared/styles/components.css"
import "../shared/styles/pages.css"

import { renderKickStatusPage } from "../features/kick-status/page"

const root = document.querySelector<HTMLDivElement>("#app")
if (!root) throw new Error("Kick status root element not found")

void renderKickStatusPage(root)
