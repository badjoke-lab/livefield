import { renderKickShell } from "../kick-shell/render"
import { getKickStatusScaffoldPayload } from "../../shared/api/kick-status-api"

function renderList(items: string[]): string {
  if (items.length === 0) return "<li>No limitations reported.</li>"
  return items.map((item) => `<li>${item}</li>`).join("")
}

function renderBody(args: {
  state: string
  collectorState: string
  coverage: string
  note: string
  lastSuccess: string | null
  knownLimitations: string[]
}): string {
  return `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-label">STATUS</div>
        <h1>Kick Livefield Status</h1>
        <p>
          This is the first data-aware scaffold for the future Kick status page.
          Real collector-backed Kick status is not wired yet.
        </p>
      </div>
    </section>

    <section class="summary-strip page-section">
      <div class="summary-item"><strong>State</strong><span>${args.state}</span></div>
      <div class="summary-item"><strong>Collector</strong><span>${args.collectorState}</span></div>
      <div class="summary-item"><strong>Coverage</strong><span>${args.coverage}</span></div>
      <div class="summary-item"><strong>Last success</strong><span>${args.lastSuccess ?? "None"}</span></div>
    </section>

    <section class="card page-section">
      <h2>Current note</h2>
      <p>${args.note}</p>
    </section>

    <section class="card page-section">
      <h2>Known limitations</h2>
      <ul class="feature-list">
        ${renderList(args.knownLimitations)}
      </ul>
    </section>

    <section class="card page-section">
      <h2>Current reference</h2>
      <p>
        Today, the real end-to-end backbone exists on the Twitch side. Kick status is API-backed here, but still intentionally reports an unconfigured state.
      </p>
      <div class="actions">
        <a class="action" href="/status/">Open current Twitch status</a>
      </div>
    </section>
  `
}

export async function renderKickStatusPage(root: HTMLElement): Promise<void> {
  root.className = "site-shell kick-site"
  root.innerHTML = renderKickShell("status", renderBody({
    state: "loading",
    collectorState: "loading",
    coverage: "Loading...",
    note: "Loading Kick Status scaffold state...",
    lastSuccess: null,
    knownLimitations: []
  }))

  try {
    const payload = await getKickStatusScaffoldPayload()
    root.innerHTML = renderKickShell("status", renderBody({
      state: payload.state,
      collectorState: payload.collectorState,
      coverage: payload.coverage,
      note: payload.note,
      lastSuccess: payload.lastSuccess,
      knownLimitations: payload.knownLimitations
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    root.innerHTML = renderKickShell("status", renderBody({
      state: "error",
      collectorState: "error",
      coverage: "Kick Status scaffold request failed.",
      note: message,
      lastSuccess: null,
      knownLimitations: ["Kick Status scaffold request failed."]
    }))
  }
}
