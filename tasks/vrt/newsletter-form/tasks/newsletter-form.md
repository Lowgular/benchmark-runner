# Newsletter Form

> As a marketing-site visitor, I want a clear way to subscribe to the newsletter so I can receive weekly updates.

Build a single centered marketing section containing a newsletter signup form. The section should fill the viewport vertically with content vertically and horizontally centered.

## Visual requirements

The section (top to bottom, centered):

1. **Eyebrow tag** — short uppercase text reading `Newsletter`, in the brand color, small, letter-spaced.
2. **Heading** — large bold display heading reading `Stay in the loop`.
3. **Subheading** — one-sentence description in muted neutral text, comfortable reading width:
   *"Get a short weekly digest of the best new tools, libraries, and posts — curated and delivered straight to your inbox."*
4. **Form** — email input + Subscribe button.
   - **Desktop / tablet (≥640px):** input and button **inline side-by-side**, max-width-constrained, centered.
   - **Mobile (<640px):** input and button **stacked vertically**, full-width within container.
5. **Privacy note** — small muted text below the form: *"We respect your inbox. Unsubscribe anytime."*

Background is a soft light neutral (not pure white). Subscribe button uses the brand color; input has a neutral border and placeholder `you@company.com`.

## Reference baselines

Match these at viewport sizes mobile 375×812, tablet 768×1024, desktop 1280×800 (within ≤ 2% pixel diff):

- `tests/visual/app-newsletter-form--default/mobile.png`
- `tests/visual/app-newsletter-form--default/tablet.png`
- `tests/visual/app-newsletter-form--default/desktop.png`

## Functional requirements

- Email input is `type="email"`, `required`, with an accessible label (visually hidden is fine).
- Submit handler prevents default; track the email value with a `signal()`.
- `ChangeDetectionStrategy.OnPush`.
- Standalone Angular component (no NgModule), `app-` selector prefix.
- Use only the tokens defined in `src/styles/tokens.css` (via the Tailwind utilities they generate). No hardcoded hex / `rgb` / `oklch`, no arbitrary Tailwind values like `bg-[#abc]`, no inline `style=`.
- Use semantic HTML (`<section>`, `<h2>`, `<form>`, `<label>`, `<button>`).
