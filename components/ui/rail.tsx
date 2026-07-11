/**
 * The signature "rail" motif from the approved design: a thin vertical
 * line between sections with a small accent dot that travels top-to-bottom
 * on a loop, fading in/out at the ends.
 *
 * This is a plain server component — no "use client", no Framer Motion.
 * The travel/fade loop is a pure CSS `@keyframes` animation (see
 * `rail-travel` in tailwind.config.ts), matching how the originally
 * approved HTML prototype implemented it. Four of these mount on the
 * homepage; running them as CSS instead of JS means zero hydration cost
 * and the animation lives on the compositor thread instead of the main
 * thread. `motion-safe:` gates it behind `prefers-reduced-motion`, and
 * without that class the dot simply stays hidden at rest (it's purely
 * decorative, so there's nothing lost for reduced-motion users).
 */
export function Rail() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[84px] w-px bg-gradient-to-b from-transparent via-border-strong to-transparent"
    >
      <div
        className="absolute left-1/2 top-0 h-[7px] w-[7px] -translate-x-1/2 rounded-full bg-accent opacity-0 shadow-[0_0_14px_2px_var(--color-accent-dim)] motion-safe:animate-rail-travel"
      />
    </div>
  );
}
