/**
 * Single source of truth for the site's motion language, shared by:
 *  - `tailwind.config.ts` (builds the `ease-out-expo` CSS timing function)
 *  - Framer Motion components (`reveal.tsx`, `mobile-nav.tsx`)
 *
 * Previously this cubic-bezier was hand-copied as a raw array literal in
 * three separate client components. Centralizing it means the curve can
 * only ever drift in one place.
 */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/** Named durations (seconds) for Framer Motion transitions across the site. */
export const DURATIONS = {
  /** Scroll-triggered section/content reveals (`<Reveal />`). */
  reveal: 0.8,
  /** Mobile nav hamburger icon morph. */
  menuIcon: 0.3,
  /** Mobile nav middle bar fade. */
  menuIconFade: 0.2,
  /** Mobile nav dropdown panel enter/exit; also used by the feedback modal. */
  menuPanel: 0.25,
  /** Fast micro-interactions (button hover/tap), e.g. the feedback FAB. */
  micro: 0.2,
} as const;
