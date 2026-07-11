import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

/**
 * Hero is a plain server component with a pure-CSS entrance animation
 * (`animate-fade-up`, defined in tailwind.config.ts) rather than the
 * Framer Motion `<Reveal>` used below the fold.
 *
 * Two concrete reasons:
 *  1. The h1 here is almost certainly the page's LCP element. Framer
 *     Motion's `whileInView` server-renders it at `opacity: 0` and only
 *     reveals it once JS hydrates *and* an IntersectionObserver callback
 *     fires — an open-ended delay that can measurably push out LCP on
 *     slow connections/devices. A CSS animation with `animation-fill-mode:
 *     both` starts at first paint, with no JS dependency at all, and each
 *     element resolves to full opacity on a short, fixed schedule.
 *  2. It's already in the viewport on load, so "reveal on scroll" was
 *     never the right tool here regardless of performance — that's for
 *     content that's actually off-screen at load (see the other sections).
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-10 pt-[150px] text-center sm:px-8 sm:pt-[200px]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-260px] z-0 h-[560px] w-[720px] -translate-x-1/2 bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent_72%)]"
      />

      <div className="relative z-10 mx-auto max-w-[760px]">
        <Eyebrow className="mb-7 animate-fade-up [animation-delay:0ms]">
          Operating system for AI employees
        </Eyebrow>

        <h1 className="mb-[26px] animate-fade-up font-display text-[clamp(40px,7vw,80px)] font-semibold leading-[1.02] tracking-[-0.025em] text-ink [animation-delay:90ms]">
          Your company,
          <br />
          running on <span className="text-ink-dim">AI employees.</span>
        </h1>

        <p className="mx-auto mb-9 max-w-[480px] animate-fade-up text-[17.5px] text-ink-dim [animation-delay:200ms]">
          RecruitOS is the first employee online. Sales, support, and
          finance are already being trained to join.
        </p>

        <div className="flex animate-fade-up flex-col items-center gap-[18px] [animation-delay:310ms]">
          <Button asChild size="default">
            <a href="#waitlist">Join the waitlist</a>
          </Button>
          <a
            href="#ecosystem"
            className="text-[13.5px] text-ink-dim transition-colors duration-200 ease-out-expo hover:text-ink"
          >
            Meet the agents ↓
          </a>
        </div>
      </div>
    </section>
  );
}
