function renderKickShell(active: "home" | "about" | "status", body: string): string {
  const nav = [
    { href: "/kick/", label: "Kick Home", key: "home" },
    { href: "/kick/about/", label: "About", key: "about" },
    { href: "/kick/status/", label: "Status", key: "status" },
    { href: "/donate/", label: "Donate", key: "donate", external: false },
    { href: "https://docs.google.com/forms/d/e/1FAIpQLSfaT2qkJ1ZnacV2A8HgxyszfnkJ4yW6_X5pqQamIO8XotwLOA/viewform?usp=publish-editor", label: "Contact", key: "contact", external: true }
  ]

  const navHtml = nav.map((item) => {
    const attrs = item.external ? ' target="_blank" rel="noreferrer"' : ""
    const isActive = item.key === active
    return `<a class="kick-nav__link" data-active="${isActive}" href="${item.href}"${attrs}>${item.label}</a>`
  }).join("")

  return `
    <div class="kick-shell">
      <header class="kick-topbar">
        <a class="kick-brand" href="/kick/">
          <img class="kick-brand__logo" src="/icons/lvf-mark.svg" alt="" width="18" height="18" decoding="async" />
          <span>Kick Livefield</span>
        </a>
        <nav class="kick-nav" aria-label="Kick site navigation">
          ${navHtml}
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
          <a href="https://docs.google.com/forms/d/e/1FAIpQLSfaT2qkJ1ZnacV2A8HgxyszfnkJ4yW6_X5pqQamIO8XotwLOA/viewform?usp=publish-editor" target="_blank" rel="noreferrer">Contact</a>
          <a href="/">Current Twitch site</a>
        </div>
      </footer>
    </div>
  `
}

export function renderKickStatusPage(root: HTMLElement): void {
  root.className = "site-shell kick-site"
  root.innerHTML = renderKickShell("status", `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-label">STATUS</div>
        <h1>Kick Livefield Status</h1>
        <p>
          This is the initial status shell for the future Kick site.
          Real collector-backed Kick status is not wired yet.
        </p>
      </div>
    </section>

    <section class="summary-strip page-section">
      <div class="summary-item"><strong>Collector</strong><span>Not wired</span></div>
      <div class="summary-item"><strong>API</strong><span>Not wired</span></div>
      <div class="summary-item"><strong>Coverage</strong><span>Not available yet</span></div>
      <div class="summary-item"><strong>Mode</strong><span>Shell only</span></div>
    </section>

    <section class="card page-section">
      <h2>What this means</h2>
      <p>
        Twitch currently has the real data backbone. Kick status will become meaningful only after the separate Kick collector and site payloads are connected.
      </p>
    </section>

    <section class="card page-section">
      <h2>Current reference</h2>
      <p>
        Today, the real end-to-end backbone exists on the Twitch side. Kick status is intentionally honest as a shell and does not pretend to be live yet.
      </p>
      <div class="actions">
        <a class="action" href="/status/">Open current Twitch status</a>
      </div>
    </section>
  `)
}
