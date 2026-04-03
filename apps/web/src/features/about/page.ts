import { renderHeader } from "../../shared/app-shell/header"
import { renderFooter } from "../../shared/app-shell/footer"
import { renderHero } from "../../shared/app-shell/hero"

export function renderAboutPage(root: HTMLElement): void {
  root.className = "site-shell"
  root.innerHTML = `
    ${renderHeader("about")}
    ${renderHero({
      eyebrow: "ABOUT",
      title: "About Livefield",
      subtitle:
        "Livefield is an unofficial Twitch-focused observation tool built to read current distribution, daily flow, and rivalry patterns without pretending to be official coverage.",
      note:
        "This page combines the old About and Method content into one clearer explanation page.",
      actions: [
        { href: "/", label: "Back to Home" },
        { href: "/status/", label: "Open Status" }
      ]
    })}

    <section class="home-two-col page-section">
      <section class="card">
        <h2>What this is</h2>
        <p>
          Livefield visualizes Twitch activity through three perspectives:
          current distribution, daily flow, and rivalries between streams.
        </p>
      </section>

      <section class="card">
        <h2>What you can see</h2>
        <div class="home-status-list">
          <div class="home-status-row">
            <span>Heatmap</span>
            <strong>Current distribution</strong>
          </div>
          <div class="home-status-row">
            <span>Day Flow</span>
            <strong>How viewership moves</strong>
          </div>
          <div class="home-status-row">
            <span>Rivalry Radar</span>
            <strong>Overlap and competition</strong>
          </div>
        </div>
      </section>
    </section>

    <section class="home-two-col page-section">
      <section class="card">
        <h2>How to read</h2>
        <ul class="feature-list">
          <li><strong>Viewers are primary:</strong> charts are driven by viewer signals first.</li>
          <li><strong>Activity is secondary:</strong> limited chat sampling does not invalidate the view.</li>
          <li><strong>Status matters:</strong> live, partial, stale, and empty describe data coverage.</li>
        </ul>
      </section>

      <section class="card">
        <h2>Data limitations</h2>
        <p>
          This project prioritizes transparency over completeness. Partial or stale does not mean broken.
          It means observed coverage is incomplete, delayed, or limited by current collection scope.
        </p>
      </section>
    </section>

    <section class="card page-section">
      <h2>Scope</h2>
      <p>
        This is a Twitch-only MVP focused on stable observation rather than perfect coverage.
        The goal is to keep the Now / Today / Compare split readable and maintainable.
      </p>
    </section>

    ${renderFooter()}
  `
}
