# OperationOS.ai — Marketing Website

Production Next.js implementation of the approved OperationOS.ai marketing
site design (`operationos-prototype_v2.html`). Layout, hierarchy, spacing,
typography, color, and motion are preserved from the approved prototype.

## Stack

- **Next.js 15.5** — App Router, React Server Components by default
- **React 19**
- **TypeScript** — strict mode
- **Tailwind CSS 3** — design tokens mapped from the prototype's CSS variables
- **shadcn/ui** — `Button` / `Input` primitives (`components.json` configured)
- **Framer Motion** — scroll reveals and menu transitions (below the fold only — see "Motion architecture")
- **lucide-react** — iconography
- **next/font** — self-hosted Space Grotesk, Inter, and IBM Plex Mono

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build      # production build
npm run start       # serve the production build
npm run lint        # ESLint (flat config, next/core-web-vitals + next/typescript)
npm run typecheck   # tsc --noEmit
```

All four commands run clean with zero errors and zero warnings.

## Project structure

```
app/
  layout.tsx           # fonts, global metadata, JSON-LD, header/footer shell
  page.tsx              # homepage — composes all sections
  globals.css           # Tailwind layers + CSS variable design tokens
  not-found.tsx          # branded 404
  error.tsx               # root error boundary
  sitemap.ts / robots.ts  # SEO
  opengraph-image.tsx     # dynamic OG/Twitter share image (statically generated)
  apple-icon.tsx           # iOS home-screen icon (statically generated)
components/
  layout/
    header.tsx           # fixed nav, scroll-aware backdrop
    mobile-nav.tsx        # accessible slide-down mobile menu
    footer.tsx
    section.tsx            # shared outer section wrapper (padding/max-width/rhythm)
  sections/
    hero.tsx               # pure-CSS entrance — see "Motion architecture"
    how-it-works.tsx
    agent-rack.tsx
    recruit-os-section.tsx
    waitlist.tsx             # terminal-style email capture (client component)
  seo/
    json-ld.tsx              # Organization/WebSite structured data
  ui/
    button.tsx, input.tsx, label.tsx, textarea.tsx  # shadcn/ui primitives
    dialog.tsx                  # shadcn/ui Dialog, adapted for Framer Motion enter/exit
    logo.tsx, eyebrow.tsx, section-heading.tsx
    reveal.tsx                    # scroll-triggered fade/rise (Framer Motion, below the fold)
    rail.tsx                       # animated section connector (pure CSS)
    dashboard-preview.tsx           # RecruitOS mock dashboard
    feedback-widget.tsx              # global floating feedback button (bottom-right FAB)
    feedback-modal.tsx                # feedback dialog: React Hook Form + Zod
hooks/
  use-scrolled.ts
lib/
  site-config.ts          # single source of truth for name/url/title/description
  motion.ts                 # single source of truth for the ease curve + durations
  data.ts                    # all site copy/content, typed
  utils.ts                    # `cn()` classname helper
  validation.ts                # Zod schema for the feedback form
  submit-feedback.ts            # placeholder async submit function (no backend yet)
types/
  index.ts
```

## Feedback widget

`<FeedbackWidget>` is mounted once in `app/layout.tsx` (not `app/page.tsx`),
so it's a true global overlay that persists across every route, including
`not-found.tsx` and `error.tsx` — a per-page mount would only cover the
homepage.

- **Button**: fixed bottom-right, circular, Lucide `MessageCircle`, subtle
  accent glow that intensifies on hover, Framer Motion entrance (delayed
  scale+fade so it doesn't compete with the hero), separate fast
  `whileHover`/`whileTap` transitions so hover response doesn't inherit the
  slow entrance timing. `aria-haspopup="dialog"`, `aria-expanded`, a real
  `<button>` under the hood (keyboard-activatable for free).
- **Modal**: `components/ui/dialog.tsx` wraps Radix's Dialog primitives
  (focus trap, focus return, `Escape`/overlay-click to close, scroll lock —
  all handled by Radix) with `asChild forceMount`, letting a Framer Motion
  `motion.div` own the actual enter/exit animation via `AnimatePresence`
  instead of the default CSS `animate-in`/`animate-out` classes — matching
  the animation language used everywhere else in the app.
- **Form**: React Hook Form + `zodResolver` (`lib/validation.ts`). Name and
  email are optional; feedback is required (10–2000 characters). Inline
  errors use the `text-danger` token. Closing (`Escape`, overlay click, the
  X, or Cancel) is blocked while a submission is in flight.
- **States**: idle → submitting (spinner + disabled fields/buttons) →
  success (checkmark panel) or error (inline message, form stays filled so
  the person can retry). `lib/submit-feedback.ts` is a placeholder —
  no backend is wired up. It simulates latency via `setTimeout` and a
  ~12% random failure so the error state is actually reachable during
  development; swap its body for a real `fetch(...)` call before launch
  (the function signature won't need to change).

## Motion architecture

Two deliberately different animation strategies are used, split by whether
content is above or below the fold on load:

- **Hero (`components/sections/hero.tsx`) and `<Rail />`** use plain CSS
  `@keyframes` (defined in `tailwind.config.ts`: `fade-up`, `rail-travel`),
  with no "use client" boundary and no Framer Motion. The Hero's `<h1>` is
  almost certainly the page's LCP element — a JS/IntersectionObserver-gated
  fade would risk delaying it. Both animations also mirror how the
  originally-approved HTML prototype implemented them (pure CSS), so this
  is a closer match to the approved design, not just a performance
  optimization.
- **Everything below the fold** (`<Reveal />`, used in `how-it-works.tsx`,
  `agent-rack.tsx`, `recruit-os-section.tsx`, `waitlist.tsx`, plus the
  mobile menu) uses Framer Motion's `whileInView`, which is the right tool
  for content that's genuinely off-screen at load.

`lib/motion.ts` exports the shared `EASE_OUT_EXPO` cubic-bezier tuple and
named `DURATIONS`; `tailwind.config.ts` imports the same tuple to build its
`ease-out-expo` utility, so the CSS and JS animation curves can't drift
apart. If JavaScript never loads at all, a `<noscript>` rule in
`app/layout.tsx` forces any `.js-reveal` element back to fully visible
(Framer Motion server-renders its "hidden" state inline ahead of hydration,
so without this, content below the fold would stay invisible with no JS).

## Accessibility notes

- `--color-ink-faint` (`#4c515a`) is ~2.5:1 contrast against the background
  — below the WCAG AA minimum (4.5:1) for text. It's reserved for
  exempt/decorative use only (the logo's ".ai" suffix, non-text UI chrome).
  Anywhere that color was previously used for real text (section eyebrows,
  footer copyright, status labels, mock-dashboard sub-labels) now uses
  `ink-dim` (~6.1:1), which passes comfortably.
- The mobile menu follows the ARIA APG disclosure pattern; closing via
  Escape or a link click returns focus to the toggle button.
- All Framer Motion animations respect `prefers-reduced-motion` via
  `useReducedMotion()`; CSS animations (`fade-up`, `rail-travel`,
  `pulse-dot`) are covered by a global `prefers-reduced-motion` media query
  in `globals.css` that forces near-zero duration, and `rail-travel`/
  `pulse-dot` are also gated behind `motion-safe:` for a clear, explicit
  default.

## Notes for launch

- **Waitlist form**: `components/sections/waitlist.tsx` validates the email
  client-side and shows a success state, but is not yet wired to a backend.
  Point `handleSubmit` at a route handler (e.g. `app/api/waitlist/route.ts`)
  or your ESP/CRM's form endpoint before launch.
- **Feedback widget**: same situation — `lib/submit-feedback.ts` is a
  placeholder that simulates a request. Point it at a real endpoint (and
  remove its simulated failure rate) before launch.
- **Domain**: set the `NEXT_PUBLIC_SITE_URL` environment variable in
  production (falls back to `https://operationos.ai` — see
  `lib/site-config.ts`). This drives canonical URLs, OG/Twitter URLs,
  `sitemap.xml`, and `robots.txt` from one place.
- **OG image**: `app/opengraph-image.tsx` generates the share image at
  build time (statically) via `next/og`. Swap in a static design asset
  there if you'd rather ship a fixed image.
- **Error reporting**: `app/error.tsx` currently only `console.error`s —
  wire in real error reporting (Sentry, etc.) before launch.

## Deploying

Ready to deploy on [Vercel](https://vercel.com/new) with zero configuration
beyond optionally setting `NEXT_PUBLIC_SITE_URL`.
