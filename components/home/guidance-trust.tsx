import { Section } from "@/components/layout/section";

export function GuidanceTrust() {
  return (
    <Section className="bg-bg-secondary">
      <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
        <section aria-labelledby="guidance-heading">
          <p className="type-meta font-mono font-medium uppercase text-accent">Guidance that stays available</p>
          <h2 id="guidance-heading" className="type-h2 mt-5 font-display font-semibold text-ink">
            Help should remain useful after onboarding.
          </h2>
          <p className="mt-5 text-base leading-7 text-ink-dim">
            OperationOS products are designed to explain the first steps, clarify important concepts, and keep product-specific guidance within reach when a workflow becomes less familiar.
          </p>
        </section>

        <section aria-labelledby="trust-heading" className="border-t border-border pt-10 lg:border-l lg:border-t-0 lg:pl-16 lg:pt-0">
          <p className="type-meta font-mono font-medium uppercase text-accent">Human control</p>
          <h2 id="trust-heading" className="type-h2 mt-5 font-display font-semibold text-ink">
            Useful automation should never become a black box.
          </h2>
          <p className="mt-5 text-base leading-7 text-ink-dim">
            Important actions should stay understandable and predictable. The software can organize, assist, and accelerate, while people retain the context and authority to decide.
          </p>
        </section>
      </div>
    </Section>
  );
}
