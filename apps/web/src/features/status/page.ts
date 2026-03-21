import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"

type StatusPayload = {
  ok: boolean
  state: "live" | "stale" | "partial" | "empty" | "demo" | "error"
  source: "api" | "demo"
  lastUpdated: string
  coverageNote: string
  degradationNote: string
  knownLimitations: string[]
  collectorState: "unconfigured" | "idle" | "running" | "failing" | "error"
  freshness: {
    minutesSinceSuccess: number | null
    isFresh: boolean
    thresholdMinutes: number
  }
  collector: {
    provider: string
    lastAttemptAt: string | null
    lastSuccessAt: string | null
    lastFailureAt: string | null
    lastError: string | null
    lastLiveCount: number | null
    lastTotalViewers: number | null
  } | null
  latestSnapshot: {
    bucketMinute: string
    collectedAt: string
    liveCount: number
    totalViewers: number
    coveredPages: number
    hasMore: boolean
  } | null
}

type FeatureState = "live" | "stale" | "partial" | "empty" | "demo" | "error"
type FeatureRow = {
  endpoint: "/heatmap" | "/day-flow" | "/battle-lines"
  state: FeatureState
  mode: string
  updatedAt: string | null
  detail: string
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function formatIso(iso: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toISOString().replace(".000Z", "Z")
}

function describeFreshness(payload: StatusPayload): string {
  if (payload.freshness.minutesSinceSuccess === null) {
    return "No successful Twitch collection has been recorded yet."
  }
  if (payload.freshness.isFresh) {
    return `Fresh (${payload.freshness.minutesSinceSuccess}m since last success).`
  }
  return `Stale (${payload.freshness.minutesSinceSuccess}m since last success; target ≤ ${payload.freshness.thresholdMinutes}m).`
}

function describeStateMeaning(state: FeatureState): string {
  if (state === "live") return "Live: fresh collector success and a current snapshot are available."
  if (state === "partial") return "Partial: real payload is present, but collection coverage is incomplete for this run."
  if (state === "stale") return "Stale: real payload exists, but the latest success is older than the freshness target."
  if (state === "empty") return "Empty: API is reachable, but no rows are currently available for this view."
  if (state === "demo") return "Demo: fallback payload used when live verification is unavailable."
  return "Error: status checks failed for this endpoint."
}

function toStatusState(payload: StatusPayload): FeatureState {
  return payload.state
}

function toFeatureState(endpoint: FeatureRow["endpoint"], body: unknown, status: StatusPayload): FeatureRow {
  const base: FeatureRow = {
    endpoint,
    state: "error",
    mode: "error",
    updatedAt: null,
    detail: "Feature API response is invalid."
  }

  if (!body || typeof body !== "object") {
    return { ...base, detail: "Feature API did not return JSON object." }
  }

  const rec = body as Record<string, unknown>
  const updatedAt = typeof rec.updatedAt === "string" ? rec.updatedAt : null
  const source = typeof rec.source === "string" ? rec.source : "unknown"
  const state = typeof rec.state === "string" ? rec.state : null

  if (source === "demo" || state === "demo") {
    return {
      endpoint,
      state: "demo",
      mode: `${source}${state ? ` / ${state}` : ""}`,
      updatedAt,
      detail: "Serving demo fallback payload."
    }
  }

  if (state === "empty") {
    return {
      endpoint,
      state: "empty",
      mode: `${source}${state ? ` / ${state}` : ""}`,
      updatedAt,
      detail: "API is reachable but no Twitch data is available for this view yet."
    }
  }

  if (state === "partial") {
    return {
      endpoint,
      state: "partial",
      mode: `${source} / partial`,
      updatedAt,
      detail: "API is serving real data, but this run has incomplete coverage."
    }
  }

  if (source === "api") {
    const statusState = toStatusState(status)
    const rows = endpoint === "/heatmap" ? (Array.isArray(rec.nodes) ? rec.nodes.length : 0) : Array.isArray(rec.streams) || Array.isArray(rec.lines)
    const hasRows = typeof rows === "boolean" ? rows : rows > 0
    const derived = hasRows ? statusState : "empty"

    return {
      endpoint,
      state: derived,
      mode: `${source}${state ? ` / ${state}` : ""}`,
      updatedAt,
      detail:
        derived === "live"
          ? "Real Twitch-backed payload is active."
          : derived === "stale"
            ? "Real payload exists, but freshness is outside target."
            : derived === "partial"
              ? "Real payload exists, but coverage is partial for this run."
              : "No rows in payload."
    }
  }

  return {
    ...base,
    updatedAt,
    mode: `${source}${state ? ` / ${state}` : ""}`,
    detail: "Unable to classify feature payload mode."
  }
}

function statusChip(state: FeatureState): string {
  return `<span class="status-chip" data-state="${state}">${state.toUpperCase()}</span>`
}

function renderInitial(root: HTMLElement): void {
  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("status")}
    ${renderHero({
      eyebrow: "STATUS",
      title: "System Status",
      subtitle: "Live proof for Twitch collection and feature APIs. This page does not hide demo or missing-data fallbacks."
    })}
    <section class="card page-section">
      <h2>Live status</h2>
      <p class="code-note">Loading /api/status and feature endpoints…</p>
    </section>
    ${renderFooter()}
  `
}

function renderLoaded(root: HTMLElement, status: StatusPayload, features: FeatureRow[]): void {
  const statusState = toStatusState(status)
  const realFeatures = features.filter((f) => f.state === "live").length
  const fallbackFeatures = features.filter((f) => f.state === "demo" || f.state === "empty").length

  root.innerHTML = `
    ${renderHeader("status")}
    ${renderHero({
      eyebrow: "STATUS",
      title: "System Status",
      subtitle: "Live proof for Twitch collection and feature APIs. This page does not hide demo or missing-data fallbacks."
    })}

    <section class="card page-section">
      <h2>Collector & snapshot</h2>
      <div class="kv">
        <div class="kv-row"><span>Source mode</span><span>${statusChip(statusState)} (${escapeHtml(status.source)})</span></div>
        <div class="kv-row"><span>Last updated</span><span>${formatIso(status.lastUpdated)}</span></div>
        <div class="kv-row"><span>Collector state</span><span>${escapeHtml(status.collectorState)}</span></div>
        <div class="kv-row"><span>Latest snapshot</span><span>${formatIso(status.latestSnapshot?.collectedAt ?? null)}</span></div>
        <div class="kv-row"><span>Freshness</span><span>${escapeHtml(describeFreshness(status))}</span></div>
        <div class="kv-row"><span>Observed channels</span><span>${status.latestSnapshot?.liveCount ?? 0}</span></div>
        <div class="kv-row"><span>Covered pages</span><span>${status.latestSnapshot?.coveredPages ?? 0}${status.latestSnapshot?.hasMore ? " (has more pages)" : ""}</span></div>
        <div class="kv-row"><span>Coverage note</span><span>${escapeHtml(status.coverageNote)}</span></div>
        <div class="kv-row"><span>Degradation note</span><span>${escapeHtml(status.degradationNote)}</span></div>
        <div class="kv-row"><span>Last success</span><span>${formatIso(status.collector?.lastSuccessAt ?? null)}</span></div>
        <div class="kv-row"><span>Last failure</span><span>${formatIso(status.collector?.lastFailureAt ?? null)}</span></div>
      </div>
      ${status.collector?.lastError ? `<p class="status-warning">Last collector error: ${escapeHtml(status.collector.lastError)}</p>` : ""}
      ${status.knownLimitations.length ? `<p class="code-note">Known limitations: ${escapeHtml(status.knownLimitations.join(" | "))}</p>` : ""}
    </section>

    <section class="card page-section">
      <h2>Feature API status</h2>
      <div class="kv">
        ${features
          .map(
            (feature) => `
              <div class="kv-row kv-row--feature">
                <span>
                  <strong>${feature.endpoint}</strong><br />
                  <small>${escapeHtml(feature.detail)}</small>
                </span>
                <span>${statusChip(feature.state)}<br /><small>${escapeHtml(feature.mode)} • ${formatIso(feature.updatedAt)}</small></span>
              </div>
            `
          )
          .join("")}
      </div>
    </section>

    <section class="card page-section">
      <h2>State meanings</h2>
      <div class="kv">
        ${(["live", "partial", "stale", "empty", "demo", "error"] as FeatureState[])
          .map((state) => `<div class="kv-row"><span>${statusChip(state)}</span><span>${escapeHtml(describeStateMeaning(state))}</span></div>`)
          .join("")}
        <div class="kv-row"><span><strong>Degraded</strong></span><span>Degraded is an umbrella label for non-live states (partial, stale, empty, demo, or error).</span></div>
      </div>
    </section>

    <section class="card page-section">
      <h2>Deploy verification audit</h2>
      <div class="kv">
        <div class="kv-row"><span>What is real right now</span><span>${realFeatures > 0 ? `${realFeatures} / ${features.length} feature APIs are serving real Twitch-backed payloads.` : "None. No feature API is currently verified as real."}</span></div>
        <div class="kv-row"><span>What is fallback right now</span><span>${fallbackFeatures > 0 ? `${fallbackFeatures} / ${features.length} feature APIs are in demo or empty fallback states.` : "No demo/empty fallback detected in feature APIs."}</span></div>
        <div class="kv-row"><span>What remains deferred</span><span>If any endpoint is stale/partial/demo/empty/error, MVP real-data proof is not complete yet and should not be presented as fully live.</span></div>
      </div>
    </section>

    ${renderFooter()}
  `
}

function renderError(root: HTMLElement, message: string): void {
  root.innerHTML = `
    ${renderHeader("status")}
    ${renderHero({
      eyebrow: "STATUS",
      title: "System Status",
      subtitle: "Live proof for Twitch collection and feature APIs."
    })}
    <section class="card page-section">
      <h2>Status error</h2>
      <p class="status-warning">${escapeHtml(message)}</p>
    </section>
    ${renderFooter()}
  `
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`)
  }
  return response.json()
}

export async function renderStatusPage(root: HTMLElement): Promise<void> {
  renderInitial(root)

  try {
    const status = (await fetchJson("/api/status")) as StatusPayload
    if (!status.ok || status.state === "error") {
      throw new Error(`Status API reported error${(status as { error?: string }).error ? `: ${(status as { error?: string }).error}` : ""}`)
    }
    const featurePayloads = await Promise.allSettled([
      fetchJson("/api/heatmap"),
      fetchJson("/api/day-flow"),
      fetchJson("/api/battle-lines")
    ])

    const features: FeatureRow[] = ["/heatmap", "/day-flow", "/battle-lines"].map((endpoint, index) => {
      const result = featurePayloads[index]
      if (result.status === "rejected") {
        return {
          endpoint: endpoint as FeatureRow["endpoint"],
          state: "error",
          mode: "error",
          updatedAt: null,
          detail: `Fetch failed: ${result.reason instanceof Error ? result.reason.message : "Unknown error"}`
        }
      }
      return toFeatureState(endpoint as FeatureRow["endpoint"], result.value, status)
    })

    renderLoaded(root, status, features)
  } catch (error) {
    renderError(root, error instanceof Error ? error.message : "Unknown status page error")
  }
}
