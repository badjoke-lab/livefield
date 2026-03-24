export type StatusNoteConfig = {
  eyebrow?: string
  title?: string
  body: string
  items?: string[]
  tone?: "info" | "warning"
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function renderStatusNote(input: string | StatusNoteConfig): string {
  if (typeof input === "string") {
    return `<div class="status-note">${escapeHtml(input)}</div>`
  }

  const eyebrow = input.eyebrow ? `<div class="status-note__eyebrow">${escapeHtml(input.eyebrow)}</div>` : ""
  const title = input.title ? `<h2 class="status-note__title">${escapeHtml(input.title)}</h2>` : ""
  const items = input.items?.length
    ? `<ul class="status-note__list">${input.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : ""

  return `
    <section class="status-note status-note--rich status-note--${input.tone ?? "info"}">
      ${eyebrow}
      ${title}
      <p class="status-note__body">${escapeHtml(input.body)}</p>
      ${items}
    </section>
  `
}
