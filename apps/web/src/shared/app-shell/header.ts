import type { SiteConfig, SiteNavItem } from "./site-config"
import { twitchSiteConfig } from "./site-config"

function renderLink(item: SiteNavItem, active: string, options?: { menu?: boolean }): string {
  const classes = ["nav-link"]
  if (item.featured) classes.push("nav-link--featured")
  if (options?.menu) classes.push("topbar__menu-link")
  const menuAttr = options?.menu ? ' data-topbar-menu-link="true"' : ""
  return `<a${menuAttr} class="${classes.join(" ")}" data-active="${item.key === active}" href="${item.href}"${item.external ? ' target="_blank" rel="noreferrer"' : ""}>${item.label}</a>`
}

function setMenuState(shell: HTMLElement, open: boolean): void {
  const button = shell.querySelector<HTMLButtonElement>('[data-topbar-menu-open]')
  const panel = shell.querySelector<HTMLElement>('[data-topbar-menu-panel]')
  const overlay = shell.querySelector<HTMLElement>('[data-topbar-menu-overlay]')
  if (!button || !panel || !overlay) return

  shell.classList.toggle("topbar-shell--menu-open", open)
  button.setAttribute("aria-expanded", open ? "true" : "false")
  panel.setAttribute("aria-hidden", open ? "false" : "true")
  overlay.setAttribute("aria-hidden", open ? "false" : "true")
  document.body.classList.toggle("topbar-menu-lock", open)

  if (open) {
    ;(
      panel.querySelector<HTMLElement>('[data-topbar-menu-link="true"][data-active="true"]') ??
      panel.querySelector<HTMLElement>('[data-topbar-menu-close]')
    )?.focus()
  } else {
    button.focus()
  }
}

function shouldUseCompactMenu(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(max-width: 1199px)").matches
}

function closeAllHeaderMenus(): void {
  document.querySelectorAll<HTMLElement>(".topbar-shell").forEach((shell) => setMenuState(shell, false))
}

function initializeHeaderMenu(): void {
  if (typeof window === "undefined") return
  const marker = "__livefieldHeaderMenuBound"
  if ((window as Window & Record<string, boolean>)[marker]) return
  ;(window as Window & Record<string, boolean>)[marker] = true

  document.addEventListener("click", (event) => {
    const target = event.target
    if (!(target instanceof Element)) return

    if (target.closest('[data-topbar-menu-open]')) {
      const shell = target.closest<HTMLElement>(".topbar-shell")
      if (!shell) return
      if (!shouldUseCompactMenu()) {
        setMenuState(shell, false)
        return
      }
      setMenuState(shell, !shell.classList.contains("topbar-shell--menu-open"))
      return
    }

    if (target.closest('[data-topbar-menu-close], [data-topbar-menu-overlay], [data-topbar-menu-link="true"]')) {
      const shell = target.closest<HTMLElement>(".topbar-shell")
      if (!shell) return
      setMenuState(shell, false)
    }
  })

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return
    const shell = document.querySelector<HTMLElement>(".topbar-shell.topbar-shell--menu-open")
    if (!shell) return
    event.preventDefault()
    setMenuState(shell, false)
  })

  window.addEventListener("resize", () => {
    if (!shouldUseCompactMenu()) {
      closeAllHeaderMenus()
    }
  })

  closeAllHeaderMenus()
}

initializeHeaderMenu()

export function renderHeader(active: string, site: SiteConfig = twitchSiteConfig): string {
  const primaryItems = site.navItems.filter((item) => item.mobileGroup === "primary")
  const secondaryItems = site.navItems.filter((item) => item.mobileGroup === "secondary")

  return `
    <div class="topbar-shell">
      <header class="topbar">
        <div class="topbar__brand" aria-label="${site.siteName}">
          <img class="topbar__logo" src="/icons/lvf-mark.svg" alt="" width="18" height="18" decoding="async" />
          <span>${site.brandLabel}</span>
        </div>

        <nav class="topbar__nav" aria-label="Primary">
          ${site.navItems.map((item) => renderLink(item, active)).join("")}
        </nav>

        <button type="button" class="topbar__menu-button" data-topbar-menu-open aria-expanded="false" aria-controls="topbar-mobile-drawer">
          Menu
        </button>
      </header>

      <div class="topbar__menu-overlay" data-topbar-menu-overlay aria-hidden="true"></div>

      <aside
        id="topbar-mobile-drawer"
        class="topbar__menu-panel"
        data-topbar-menu-panel
        aria-hidden="true"
        aria-label="Mobile menu"
      >
        <div class="topbar__menu-head">
          <div class="topbar__menu-brand">
            <img class="topbar__logo" src="/icons/lvf-mark.svg" alt="" width="18" height="18" decoding="async" />
            <strong>${site.brandLabel}</strong>
          </div>
          <button type="button" class="topbar__menu-close" data-topbar-menu-close aria-label="Close menu">Close</button>
        </div>

        <div class="topbar__menu-section">
          <span class="topbar__menu-title">Explore</span>
          ${primaryItems.map((item) => renderLink(item, active, { menu: true })).join("")}
        </div>

        <div class="topbar__menu-section">
          <span class="topbar__menu-title">Info</span>
          ${secondaryItems.map((item) => renderLink(item, active, { menu: true })).join("")}
        </div>
      </aside>
    </div>
  `
}
