import Link from "next/link";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { createPageMetadata } from "@/lib/page-metadata";

export const metadata = createPageMetadata(
  "About OperationOS",
  "Learn why OperationOS builds focused software products for operational workflows and how human judgment remains part of the work.",
  "/about",
);

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-border pt-[72px]">
        <div className="container-standard grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.7fr] lg:items-end lg:gap-20 lg:py-24">
          <div className="max-w-3xl">
            <p className="type-meta font-mono font-medium uppercase text-accent">About OperationOS</p>
            <h1 className="type-h1 mt-6 font-display font-semibold text-ink">
              Focused software should make important work easier to understand and run.
            </h1>
          </div>
          <p className="type-body-lg max-w-xl text-ink-dim">
            OperationOS is a software company building focused products for operational workflows where repetition, fragmented context, and unclear next actions get in the way.
          </p>
        </div>
      </section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="type-meta font-mono font-medium uppercase text-accent">Why it exists</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">Operational work deserves more than another layer of complexity.</h2>
          </div>
          <div className="space-y-6 text-base leading-7 text-ink-dim">
            <p>Many workflows become difficult because the information needed to act is separated from the step where a decision is made. Repetitive tasks then consume attention that should remain available for judgment.</p>
            <p>OperationOS builds products that organize this work into clearer systems. The goal is practical software that helps people see the context, understand the state of the workflow, and move to the next action.</p>
          </div>
        </div>
      </Section>

      <Section className="border-y border-border bg-bg-secondary">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="type-meta font-mono font-medium uppercase text-accent">A focused company model</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">Build around the workflow, not around one oversized platform.</h2>
            <p className="mt-5 text-base leading-7 text-ink-dim">Each OperationOS product can use the language, guidance, and interaction model that fits its operational problem while sharing a consistent standard for clarity.</p>
          </div>
          <div className="border-t border-border pt-10 lg:border-l lg:border-t-0 lg:pl-16 lg:pt-0">
            <p className="type-meta font-mono font-medium uppercase text-accent">Product philosophy</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">Easy to learn. Fast after you&apos;ve learned it.</h2>
            <p className="mt-5 text-base leading-7 text-ink-dim">A product should explain unfamiliar choices without slowing down experienced users. Important context should stay close to the action, and repeated work should become quicker with practice.</p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-20">
          <div>
            <p className="type-meta font-mono font-medium uppercase text-accent">Human judgment</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">Software can support a decision without pretending to own it.</h2>
          </div>
          <div>
            <p className="text-base leading-7 text-ink-dim">OperationOS products are designed to reduce repetitive effort and surface useful context. When a decision affects people or carries meaningful consequences, responsibility remains with the people doing the work.</p>
            <div className="mt-10 border-l-2 border-accent bg-accent-soft px-6 py-6 sm:px-8">
              <p className="type-meta font-mono font-medium uppercase text-accent">Current product</p>
              <h3 className="mt-4 font-display text-2xl font-semibold text-ink">RecruitOS</h3>
              <p className="mt-3 text-sm leading-6 text-ink-dim">RecruitOS is the currently announced OperationOS product. It helps hiring teams keep role requirements, candidate context, recommendation reasoning, and review progress connected.</p>
              <Button asChild className="mt-6"><Link href="/recruitos">Explore RecruitOS</Link></Button>
            </div>
          </div>
        </div>
      </Section>

      <section className="border-t border-border bg-ink text-white">
        <div className="container-standard flex flex-col gap-7 py-14 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="type-h2 max-w-2xl font-display font-semibold text-white">Have a question about OperationOS or its products?</h2>
          <Button asChild className="shrink-0 border-white bg-white text-ink hover:border-white hover:bg-white/90"><Link href="/contact">Contact OperationOS</Link></Button>
        </div>
      </section>
    </>
  );
}
