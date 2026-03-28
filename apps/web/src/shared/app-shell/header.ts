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

function setMenuState(topbar: HTMLElement, open: boolean): void {
  const button = topbar.querySelector<HTMLButtonElement>('[data-topbar-menu-open]')
  const panel = topbar.querySelector<HTMLElement>('[data-topbar-menu-panel]')
  if (!button || !panel) return

  topbar.classList.toggle("topbar--menu-open", open)
  button.setAttribute("aria-expanded", open ? "true" : "false")
  panel.setAttribute("aria-hidden", open ? "false" : "true")

  if (open) {
    const closeButton = panel.querySelector<HTMLButtonElement>('[data-topbar-menu-close]')
    closeButton?.focus()
  } else {
    button.focus()
  }
}

function initializeHeaderMenu(): void {
  if (typeof window === "undefined") return
  const marker = "__livefieldHeaderMenuBound"
  if ((window as Window & Record<string, boolean>)[marker]) return
  ;(window as Window & Record<string, boolean>)[marker] = true

  document.addEventListener("click", (event) => {
    const target = event.target
    if (!(target instanceof Element)) return

    const openButton = target.closest<HTMLButtonElement>('[data-topbar-menu-open]')
    if (openButton) {
      const topbar = openButton.closest<HTMLElement>(".topbar")
      if (!topbar) return
      const isOpen = topbar.classList.contains("topbar--menu-open")
      setMenuState(topbar, !isOpen)
      return
    }

    const closeButton = target.closest<HTMLButtonElement>('[data-topbar-menu-close]')
    if (closeButton) {
      const topbar = closeButton.closest<HTMLElement>(".topbar")
      if (!topbar) return
      setMenuState(topbar, false)
      return
    }

    const overlay = target.closest<HTMLElement>('[data-topbar-menu-overlay]')
    if (overlay) {
      const topbar = overlay.closest<HTMLElement>(".topbar")
      if (!topbar) return
      setMenuState(topbar, false)
      return
    }

    const menuLink = target.closest<HTMLAnchorElement>('[data-topbar-menu-link="true"]')
    if (menuLink) {
      const topbar = menuLink.closest<HTMLElement>(".topbar")
      if (!topbar) return
      setMenuState(topbar, false)
    }
  })

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return
    const openTopbar = document.querySelector<HTMLElement>(".topbar.topbar--menu-open")
    if (!openTopbar) return
    event.preventDefault()
    setMenuState(openTopbar, false)
  })
}

initializeHeaderMenu()

export function renderHeader(active: string): string {
  const primaryItems = items.filter((item) => item.mobileGroup === "primary")
  const secondaryItems = items.filter((item) => item.mobileGroup === "secondary")

  return `
    <header class="topbar">
      <div class="topbar__brand" aria-label="Livefield">
        <img class="topbar__logo" src="/icons/lvf-mark.svg" alt="" width="18" height="18" decoding="async" />
        <span>Livefield</span>
      </div>

      <button type="button" class="topbar__menu-button" data-topbar-menu-open aria-expanded="false" aria-controls="topbar-mobile-drawer">Menu</button>

      <nav class="topbar__nav" aria-label="Primary">
        ${items.map((item) => renderLink(item, active)).join("")}
      </nav>

      <div class="topbar__menu-overlay" data-topbar-menu-overlay aria-hidden="true"></div>

      <aside id="topbar-mobile-drawer" class="topbar__menu-panel" data-topbar-menu-panel aria-hidden="true" aria-label="Mobile menu">
        <div class="topbar__menu-head">
          <strong>Menu</strong>
          <button type="button" class="topbar__menu-close" data-topbar-menu-close aria-label="Close menu">Close</button>
        </div>

        <div class="topbar__menu-section">
          <span class="topbar__menu-title">Explore</span>
          ${primaryItems.map((item) => renderLink(item, active, "topbar__menu-link").replace('<a ', '<a data-topbar-menu-link="true" ')).join("")}
        </div>

        <div class="topbar__menu-section">
          <span class="topbar__menu-title">Info</span>
          ${secondaryItems.map((item) => renderLink(item, active, "topbar__menu-link").replace('<a ', '<a data-topbar-menu-link="true" ')).join("")}
        </div>
      </aside>
    </header>
  `
}
