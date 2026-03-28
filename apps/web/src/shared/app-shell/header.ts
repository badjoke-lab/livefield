type NavItem = {
  href: string
  label: string
  key: string
  featured?: boolean
  mobileGroup: "primary" | "secondary"
}

const items: NavItem[] = [
  { href: "/", label: "Home", key: "home", mobileGroup: "primary" },
  { href: "/heatmap/", label: "Heatmap", key: "heatmap", mobileGroup: "primary" },
  { href: "/day-flow/", label: "Day Flow", key: "day-flow", mobileGroup: "primary" },
  { href: "/battle-lines/", label: "Rivalry Radar", key: "battle-lines", mobileGroup: "primary" },
  { href: "/method/", label: "Method", key: "method", mobileGroup: "secondary" },
  { href: "/about/", label: "About", key: "about", mobileGroup: "secondary" },
  { href: "/donate/", label: "Donate", key: "donate", featured: true, mobileGroup: "secondary" },
  { href: "/status/", label: "Status", key: "status", mobileGroup: "secondary" }
]

function renderLink(item: NavItem, active: string, extraClass = ""): string {
  const classes = ["nav-link"]
  if (item.featured) classes.push("nav-link--featured")
  if (extraClass) classes.push(extraClass)
  return `<a class="${classes.join(" ")}" data-active="${item.key === active}" href="${item.href}">${item.label}</a>`
}

export function renderHeader(active: string): string {
  const primaryItems = items.filter((item) => item.mobileGroup === "primary")
  const secondaryItems = items.filter((item) => item.mobileGroup === "secondary")

  return `
    <header class="topbar">
      <div class="topbar__brand" aria-label="Livefield">
        <img class="topbar__logo" src="/icons/lvf-mark.svg" alt="" width="18" height="18" decoding="async" />
        <span>Livefield</span>
      </div>

      <label class="topbar__menu-button" for="topbar-menu-toggle" aria-label="Open menu">Menu</label>

      <nav class="topbar__nav" aria-label="Primary">
        ${items.map((item) => renderLink(item, active)).join("")}
      </nav>

      <input id="topbar-menu-toggle" class="topbar__menu-toggle" type="checkbox" aria-hidden="true" />
      <label class="topbar__menu-overlay" for="topbar-menu-toggle" aria-hidden="true"></label>

      <aside class="topbar__menu-panel" aria-label="Mobile menu">
        <div class="topbar__menu-head">
          <strong>Menu</strong>
          <label class="topbar__menu-close" for="topbar-menu-toggle" aria-label="Close menu">Close</label>
        </div>

        <div class="topbar__menu-section">
          <span class="topbar__menu-title">Explore</span>
          ${primaryItems.map((item) => renderLink(item, active, "topbar__menu-link")).join("")}
        </div>

        <div class="topbar__menu-section">
          <span class="topbar__menu-title">Info</span>
          ${secondaryItems.map((item) => renderLink(item, active, "topbar__menu-link")).join("")}
        </div>
      </aside>
    </header>
  `
}
