type HeroInput = {
  eyebrow: string
  title: string
  subtitle: string
  note?: string
  actions?: Array<{ href: string; label: string }>
}

export function renderHero(input: HeroInput): string {
  return `
    <section class="hero">
      <div class="hero__eyebrow">${input.eyebrow}</div>
      <h1>${input.title}</h1>
      <p>${input.subtitle}</p>
      ${input.note ? `<p class="code-note" style="margin-top:10px">${input.note}</p>` : ""}
      ${
        input.actions?.length
          ? `<div class="actions">${input.actions
              .map((action) => `<a class="action" href="${action.href}">${action.label}</a>`)
              .join("")}</div>`
          : ""
      }
    </section>
  `
}
