type NavItem = {
  href: string
  label: string
  key: string
  featured?: boolean
  mobileCore?: boolean
}

const items: NavItem[] = [
  { href: "/", label: "Home", key: "home", mobileCore: true },
  { href: "/heatmap/", label: "Heatmap", key: "heatmap", mobileCore: true },
  { href: "/day-flow/", label: "Day Flow", key: "day-flow", mobileCore: true },
  { href: "/battle-lines/", label: "Rivalry Radar", key: "battle-lines", mobileCore: true },
  { href: "/method/", label: "Method", key: "method" },
  { href: "/about/", label: "About", key: "about" },
  { href: "/donate/", label: "Donate", key: "donate", featured: true },
  { href: "/status/", label: "Status", key: "status" }
]

function renderLink(item: NavItem, active: string, extraClasses: string[] = []): string {
  const classes = ["nav-link", ...extraClasses]
  if (item.featured) classes.push("nav-link--featured")
  return `<a class="${classes.join(" ")}" data-active="${item.key === active}" href="${item.href}">${item.label}</a>`
}

export function renderHeader(active: string): string {
  const coreItems = items.filter((item) => item.mobileCore)
  const overflowItems = items.filter((item) => !item.mobileCore)

  return `
    <header class="topbar">
      <div class="topbar__brand" aria-label="Livefield">
        <img class="topbar__logo" src="/icons/lvf-mark.svg" alt="" width="18" height="18" decoding="async" />
        <span>Livefield</span>
      </div>
      <nav class="topbar__nav" aria-label="Primary">
        ${coreItems.map((item) => renderLink(item, active, ["nav-link--core"])).join("")}
        ${overflowItems.map((item) => renderLink(item, active, ["nav-link--secondary"])).join("")}
        <details class="topbar__more" ${overflowItems.some((item) => item.key === active) ? "open" : ""}>
          <summary class="topbar__more-trigger" aria-label="Open more pages">More</summary>
          <div class="topbar__more-menu">
            ${overflowItems.map((item) => renderLink(item, active, ["nav-link--more"])).join("")}
          </div>
        </details>
      </nav>
    </header>
  `
}
