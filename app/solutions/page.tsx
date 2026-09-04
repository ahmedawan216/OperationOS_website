import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { createPageMetadata } from "@/lib/page-metadata";

export const metadata = createPageMetadata(
  "Solutions for Operational Work",
  "See the operational patterns OperationOS products are designed around and how RecruitOS applies them to candidate review.",
  "/solutions",
);

const patterns = [
  {
    number: "01",
    title: "Keep context attached to the work.",
    description: "Requirements, source material, progress, and the next decision are more useful when they remain connected instead of scattered across tools.",
  },
  {
    number: "02",
    title: "Reduce repetition without removing judgment.",
    description: "Software can organize repeatable steps and surface relevant information while people retain responsibility for consequential decisions.",
  },
  {
    number: "03",
    title: "Make the next action easy to find.",
    description: "Clear status and visible next steps help experienced users move quickly and give newer users a dependable path through unfamiliar work.",
  },
] as const;

export default function SolutionsPage() {
  return (
    <>
      <section className="border-b border-border pt-[72px]">
        <div className="container-standard grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.7fr] lg:items-end lg:gap-20 lg:py-24">
          <div className="max-w-3xl">
            <p className="type-meta font-mono font-medium uppercase text-accent">Operational patterns</p>
            <h1 className="type-h1 mt-6 font-display font-semibold text-ink">
              Keep the work, its context, and the next decision together.
            </h1>
          </div>
          <p className="type-body-lg max-w-xl text-ink-dim">
            OperationOS designs focused products for operational work that becomes harder when information fragments, repeated steps consume attention, and the next action becomes unclear.
          </p>
        </div>
      </section>

      <Section>
        <div className="max-w-3xl">
          <p className="type-meta font-mono font-medium uppercase text-accent">Designed around the work</p>
          <h2 className="type-h2 mt-5 font-display font-semibold text-ink">
            Better operational software starts with recurring points of friction.
          </h2>
        </div>
        <ol className="mt-12 divide-y divide-border border-y border-border">
          {patterns.map((pattern) => (
            <li key={pattern.number} className="grid gap-4 py-7 sm:grid-cols-[64px_0.8fr_1.2fr] sm:items-start sm:gap-8">
              <span className="font-mono text-xs font-medium text-accent">{pattern.number}</span>
              <h3 className="font-display text-xl font-semibold text-ink">{pattern.title}</h3>
              <p className="text-sm leading-6 text-ink-dim">{pattern.description}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section className="border-y border-border bg-bg-secondary">
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20">
          <div>
            <p className="type-meta font-mono font-medium uppercase text-accent">Focused products</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">
              A specific workflow deserves a product built around its decisions.
            </h2>
          </div>
          <div className="space-y-6 text-base leading-7 text-ink-dim">
            <p>OperationOS is a company model, not one giant platform. Each product can keep its terminology, access model, guidance, and workflow close to the work it serves.</p>
            <p>This is a design direction for OperationOS products. It is not a claim that every operational pattern already has a publicly available product.</p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-20">
          <div className="max-w-xl">
            <p className="type-meta font-mono font-medium uppercase text-accent">The current example</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">
              RecruitOS keeps candidate review connected to the role.
            </h2>
            <p className="mt-5 text-base leading-7 text-ink-dim">
              RecruitOS helps hiring teams review candidates against role requirements, examine the context behind recommendations, organize progress, and decide the next action.
            </p>
            <p className="mt-4 text-sm leading-6 text-ink-faint">Software supports the review. Hiring decisions remain with the people responsible for them.</p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row">
              <Button asChild><Link href="/recruitos">Explore RecruitOS</Link></Button>
              <Button asChild variant="secondary"><Link href="/recruitos#waitlist">Request access</Link></Button>
            </div>
          </div>
          <aside className="border-l-2 border-accent bg-accent-soft px-6 py-6 sm:px-8" aria-labelledby="guidance-title">
            <p className="type-meta font-mono font-medium uppercase text-accent">Guidance</p>
            <h2 id="guidance-title" className="mt-4 font-display text-xl font-semibold text-ink">See how RecruitOS separates software assistance from human responsibility.</h2>
            <Link href="/guidelines/recruitos" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent hover:text-accent-hover hover:underline">
              Read the RecruitOS Guidelines
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </Section>
    </>
  );
}
