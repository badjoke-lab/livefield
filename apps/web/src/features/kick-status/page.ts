import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"
import { renderStatusNote } from "../../shared/app-shell/status-note"
import { kickSiteConfig } from "../../shared/app-shell/site-config"
import { getKickStatusScaffoldPayload } from "../../shared/api/kick-status-api"

function renderList(items: string[]): string {
  if (items.length === 0) return "<li>No limitations reported.</li>"
  return items.map((item) => `<li>${item}</li>`).join("")
}

function renderFrame(args: {
  state: string
  collectorState: string
  coverage: string
  note: string
  lastSuccess: string | null
  knownLimitations: string[]
}): string {
  return `
    ${renderHeader("status", kickSiteConfig)}

    ${renderHero({
      eyebrow: "STATUS",
      title: "Livefield - Kick Status",
      subtitle: "Kick status page using the same shell and reading style as the data views.",
      note: "This page reports current scaffold / collector status honestly while the Kick stack keeps filling in.",
      actions: [
        { href: "/kick/heatmap/", label: "Open Heatmap" },
        { href: "/status/", label: "Open Twitch status" }
      ]
    })}

    <section class="summary-strip page-section">
      <div class="summary-item"><strong>State</strong><span>${args.state}</span></div>
      <div class="summary-item"><strong>Collector</strong><span>${args.collectorState}</span></div>
      <div class="summary-item"><strong>Coverage</strong><span>${args.coverage}</span></div>
      <div class="summary-item"><strong>Last success</strong><span>${args.lastSuccess ?? "None"}</span></div>
    </section>

    <section class="grid-2 page-section">
      <section class="card">
        <h2>Current note</h2>
        <p>${args.note}</p>
      </section>

      <section class="card">
        <h2>Known limitations</h2>
        <ul class="feature-list">
          ${renderList(args.knownLimitations)}
        </ul>
      </section>
    </section>

    ${renderStatusNote({
      eyebrow: "REFERENCE",
      title: "Cross-site status path",
      body: "Kick status is now rendered in the same design system as the rest of the site, while Twitch remains the other live reference route during this MVP stage.",
      items: [
        "Kick status stays honest about unconfigured or partial states",
        "Twitch status remains available from the footer and action link",
        "shared portal landing can replace this bridge later"
      ],
      tone: "info"
    })}

    ${renderFooter(kickSiteConfig)}
  `
}

export async function renderKickStatusPage(root: HTMLElement): Promise<void> {
  root.className = "site-shell kick-status-page"
  root.innerHTML = renderFrame({
    state: "loading",
    collectorState: "loading",
    coverage: "Loading...",
    note: "Loading Kick status...",
    lastSuccess: null,
    knownLimitations: []
  })

  try {
    const payload = await getKickStatusScaffoldPayload()
    root.innerHTML = renderFrame({
      state: payload.state,
      collectorState: payload.collectorState,
      coverage: payload.coverage,
      note: payload.note,
      lastSuccess: payload.lastSuccess,
      knownLimitations: payload.knownLimitations
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    root.innerHTML = renderFrame({
      state: "error",
      collectorState: "error",
      coverage: "Kick status request failed.",
      note: message,
      lastSuccess: null,
      knownLimitations: ["Kick status request failed."]
    })
  }
}
