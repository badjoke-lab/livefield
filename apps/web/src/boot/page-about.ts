import { renderAboutPage } from "../features/about/page"

const root = document.querySelector<HTMLDivElement>("#app")

if (!root) {
  throw new Error("About root element not found")
}

renderAboutPage(root)
