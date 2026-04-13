export type SiteKey = "twitch" | "kick"

export type SiteNavItem = {
  href: string
  label: string
  key: string
  featured?: boolean
  external?: boolean
  mobileGroup: "primary" | "secondary"
}

export type SiteConfig = {
  key: SiteKey
  siteName: string
  brandLabel: string
  footerLabel: string
  navItems: SiteNavItem[]
}

export const twitchSiteConfig: SiteConfig = {
  key: "twitch",
  siteName: "Livefield",
  brandLabel: "Livefield",
  footerLabel: "Static shell · Cloudflare runtime",
  navItems: [
    { href: "/", label: "Home", key: "home", mobileGroup: "primary" },
    { href: "/heatmap/", label: "Heatmap", key: "heatmap", mobileGroup: "primary" },
    { href: "/day-flow/", label: "Day Flow", key: "day-flow", mobileGroup: "primary" },
    { href: "/battle-lines/", label: "Rivalry Radar", key: "battle-lines", mobileGroup: "primary" },
    { href: "/about/", label: "About", key: "about", mobileGroup: "secondary" },
    { href: "/donate/", label: "Donate", key: "donate", featured: true, mobileGroup: "secondary" },
    { href: "https://docs.google.com/forms/d/e/1FAIpQLSfaT2qkJ1ZnacV2A8HgxyszfnkJ4yW6_X5pqQamIO8XotwLOA/viewform?usp=publish-editor", label: "Contact", key: "contact", external: true, mobileGroup: "secondary" },
    { href: "/status/", label: "Status", key: "status", mobileGroup: "secondary" }
  ]
}

export const kickSiteConfig: SiteConfig = {
  key: "kick",
  siteName: "Livefield - Kick",
  brandLabel: "Livefield - Kick",
  footerLabel: "Livefield - Kick · Cloudflare runtime",
  navItems: [
    { href: "/kick/", label: "Kick Home", key: "home", mobileGroup: "primary" },
    { href: "/kick/heatmap/", label: "Heatmap", key: "heatmap", mobileGroup: "primary" },
    { href: "/kick/day-flow/", label: "Day Flow", key: "day-flow", mobileGroup: "primary" },
    { href: "/kick/battle-lines/", label: "Rivalry Radar", key: "battle-lines", mobileGroup: "primary" },
    { href: "/kick/about/", label: "About", key: "about", mobileGroup: "secondary" },
    { href: "/kick/donate/", label: "Donate", key: "donate", featured: true, mobileGroup: "secondary" },
    { href: "https://docs.google.com/forms/d/e/1FAIpQLSfaT2qkJ1ZnacV2A8HgxyszfnkJ4yW6_X5pqQamIO8XotwLOA/viewform?usp=publish-editor", label: "Contact", key: "contact", external: true, mobileGroup: "secondary" },
    { href: "/kick/status/", label: "Status", key: "status", mobileGroup: "secondary" }
  ]
}
