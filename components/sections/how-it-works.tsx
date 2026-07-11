import { pidPrinciples } from "@/lib/data";
import { Section } from "@/components/layout/section";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";

/**
 * "How the OS works" — the operating-system section of the site. Explains
 * the three standing constraints (the OS's core features) that every
 * agent on the platform runs under, regardless of function.
 */
export function HowItWorks() {
  return (
    <Section id="how">
      <Reveal>
        <SectionHeading
          eyebrow="How the OS works"
          title="Every employee runs by the same rules."
          description="Whether it’s screening resumes today or closing the books next year, every agent on OperationOS answers to three constraints."
        />
      </Reveal>

      <Reveal>
        <dl className="grid grid-cols-1 border-t border-border md:grid-cols-3">
          {pidPrinciples.map((principle) => (
            <div
              key={principle.id}
              className="border-b border-border px-6 py-[34px] last:border-b-0 md:border-b-0 md:border-r md:px-[30px] md:last:border-r-0"
            >
              <dt>
                <span className="mb-4 block font-mono text-[11px] tracking-[0.08em] text-accent">
                  {principle.id}
                </span>
                <span className="mb-2.5 block font-display text-[17px] font-semibold text-ink">
                  {principle.title}
                </span>
              </dt>
              <dd className="text-[13.5px] leading-[1.6] text-ink-dim">
                {principle.description}
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </Section>
  );
}
