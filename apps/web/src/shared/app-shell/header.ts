type NavItem = {
  href: string
  label: string
  key: string
  featured?: boolean
}

const items: NavItem[] = [
  { href: "/", label: "Home", key: "home" },
  { href: "/heatmap/", label: "Heatmap", key: "heatmap" },
  { href: "/day-flow/", label: "Day Flow", key: "day-flow" },
  { href: "/battle-lines/", label: "Rivalry Radar", key: "battle-lines" },
  { href: "/method/", label: "Method", key: "method" },
  { href: "/about/", label: "About", key: "about" },
  { href: "/donate/", label: "Donate", key: "donate", featured: true },
  { href: "/status/", label: "Status", key: "status" }
]

export function renderHeader(active: string): string {
  return `
    <header class="topbar">
      <div class="topbar__brand" aria-label="Livefield">
        <img class="topbar__logo" src="/icons/lvf-mark.svg" alt="" width="20" height="20" decoding="async" />
        <span>Livefield</span>
      </div>
      <nav class="topbar__nav" aria-label="Primary">
        ${items
          .map((item) => {
            const classes = ["nav-link"]
            if (item.featured) classes.push("nav-link--featured")
            return `<a class="${classes.join(" ")}" data-active="${item.key === active}" href="${item.href}">${item.label}</a>`
          })
          .join("")}
      </nav>
    </header>
  `
}
