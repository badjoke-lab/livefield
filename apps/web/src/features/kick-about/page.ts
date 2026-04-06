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

export function renderKickAboutPage(root: HTMLElement): void {
  root.className = "site-shell kick-site"
  root.innerHTML = renderKickShell("about", `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-label">ABOUT</div>
        <h1>About Kick Livefield</h1>
        <p>
          Kick Livefield is planned as a separate observation site under the broader Livefield structure.
          It will keep the same Now / Today / Rivalries split while using Kick-specific collection and limits.
        </p>
      </div>
    </section>

    <section class="grid-2 page-section">
      <section class="card">
        <h2>What stays shared</h2>
        <ul class="feature-list">
          <li>Site shell and reading model</li>
          <li>Now / Today / Rivalries role split</li>
          <li>Status honesty around stale / partial / empty</li>
        </ul>
      </section>

      <section class="card">
        <h2>What becomes Kick-specific</h2>
        <ul class="feature-list">
          <li>Collector and source limits</li>
          <li>Payload normalization</li>
          <li>Coverage notes and stream URLs</li>
        </ul>
      </section>
    </section>

    <section class="card page-section">
      <h2>Current stage</h2>
      <p>
        This page is a structural placeholder. Real Kick data pages are not wired yet.
      </p>
    </section>
  `)
}
