import "../shared/styles/tokens.css"
import "../shared/styles/reset.css"
import "../shared/styles/layout.css"
import "../shared/styles/components.css"
import "../shared/styles/pages.css"
import { renderDayFlowPage } from "../features/day-flow/page-viewloom"

const root = document.querySelector<HTMLElement>("#app")
if (!root) throw new Error("#app not found")
renderDayFlowPage(root)
