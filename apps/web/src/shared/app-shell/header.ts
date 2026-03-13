const items = [
  { href: "/", label: "Home", key: "home" },
  { href: "/heatmap/", label: "Heatmap", key: "heatmap" },
  { href: "/day-flow/", label: "Day Flow", key: "day-flow" },
  { href: "/battle-lines/", label: "Rivalry Radar", key: "battle-lines" },
  { href: "/method/", label: "Method", key: "method" },
  { href: "/about/", label: "About", key: "about" },
  { href: "/status/", label: "Status", key: "status" }
]

export function renderHeader(active: string): string {
  return `
    <header class="topbar">
      <div class="topbar__brand">Livefield</div>
      <nav class="topbar__nav">
        ${items
          .map(
            (item) =>
              `<a class="nav-link" data-active="${item.key === active}" href="${item.href}">${item.label}</a>`
          )
          .join("")}
      </nav>
    </header>
  `
}
