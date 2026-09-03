import { productPrinciples } from "@/lib/homepage-data";
import { Section } from "@/components/layout/section";

export function ProductPhilosophy() {
  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <p className="type-meta font-mono font-medium uppercase text-accent">Our product standard</p>
          <h2 className="type-h2 mt-5 font-display font-semibold text-ink">
            Easy to learn. Fast after you&apos;ve learned it.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-ink-dim">
            Good operational software should support the first task without slowing down the hundredth. We design for both moments.
          </p>
        </div>
        <dl className="divide-y divide-border border-y border-border">
          {productPrinciples.map((principle) => (
            <div key={principle.title} className="grid gap-2 py-6 sm:grid-cols-[220px_1fr] sm:gap-8">
              <dt className="font-display text-lg font-semibold text-ink">{principle.title}</dt>
              <dd className="text-sm leading-6 text-ink-dim">{principle.description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}
