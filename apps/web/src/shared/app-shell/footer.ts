import type { SiteConfig } from "./site-config"
import { twitchSiteConfig } from "./site-config"

export function renderFooter(site: SiteConfig = twitchSiteConfig): string {
  const donate = site.navItems.find((item) => item.key === "donate")
  const status = site.navItems.find((item) => item.key === "status")
  const contact = site.navItems.find((item) => item.key === "contact")
  const crossLink = site.key === "twitch"
    ? { href: "/kick/", label: "Current Kick site" }
    : { href: "/", label: "Current Twitch site" }

  return `
    <footer class="footer-links">
      <span>${site.footerLabel}</span>
      ${donate ? `<a href="${donate.href}">Donate</a>` : ""}
      ${status ? `<a href="${status.href}">Status</a>` : ""}
      ${contact ? `<a href="${contact.href}" target="_blank" rel="noreferrer">Contact</a>` : ""}
      <a href="${crossLink.href}">${crossLink.label}</a>
    </footer>
  `
}
