export type KickShellActiveKey = "home" | "about" | "status"

type KickNavItem = {
  href: string
  label: string
  key: "home" | "about" | "status" | "donate" | "contact"
  external?: boolean
}

const CONTACT_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfaT2qkJ1ZnacV2A8HgxyszfnkJ4yW6_X5pqQamIO8XotwLOA/viewform?usp=publish-editor"

const navItems: KickNavItem[] = [
  { href: "/kick/", label: "Kick Home", key: "home" },
  { href: "/kick/about/", label: "About", key: "about" },
  { href: "/kick/status/", label: "Status", key: "status" },
  { href: "/donate/", label: "Donate", key: "donate" },
  { href: CONTACT_URL, label: "Contact", key: "contact", external: true }
]

function renderNav(active: KickShellActiveKey): string {
  return navItems
    .map((item) => {
      const attrs = item.external ? ' target="_blank" rel="noreferrer"' : ""
      const isActive = item.key === active
      return `<a class="kick-nav__link" data-active="${isActive}" href="${item.href}"${attrs}>${item.label}</a>`
    })
    .join("")
}

export function renderKickShell(active: KickShellActiveKey, body: string): string {
  return `
    <div class="kick-shell">
      <header class="kick-topbar">
        <a class="kick-brand" href="/kick/">
          <img class="kick-brand__logo" src="/icons/lvf-mark.svg" alt="" width="18" height="18" decoding="async" />
          <span>Kick Livefield</span>
        </a>
        <nav class="kick-nav" aria-label="Kick site navigation">
          ${renderNav(active)}
        </nav>
      </header>

      <main class="kick-main">
        ${body}
      </main>

      <footer class="kick-footer">
        <div class="kick-footer__links">
          <a href="/kick/">Kick Home</a>
          <a href="/kick/about/">About</a>
          <a href="/kick/status/">Status</a>
          <a href="/donate/">Donate</a>
          <a href="${CONTACT_URL}" target="_blank" rel="noreferrer">Contact</a>
          <a href="/">Current Twitch site</a>
        </div>
      </footer>
    </div>
  `
}
