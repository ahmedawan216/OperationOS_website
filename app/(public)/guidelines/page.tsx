import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Guidelines",
  description: "Learn how OperationOS products are designed, how to begin, and where to find practical product and account guidance.",
  alternates: { canonical: "/guidelines" },
};

const areas = [
  { href: "/guidelines/recruitos", label: "Product guide", title: "Use the RecruitOS review workflow", description: "Understand roles, candidate analysis, recommendations, status, and the decisions that remain with recruiters." },
  { href: "/guidelines/concepts", label: "Shared concepts", title: "Recognize the ideas used across products", description: "Learn how context, status, next actions, and human judgment shape an OperationOS workflow." },
  { href: "/guidelines/account-billing", label: "Account", title: "Understand accounts and billing today", description: "See how to create or access a RecruitOS account and what billing information is not published on this website." },
  { href: "/guidelines/privacy-security", label: "Trust", title: "Handle product information carefully", description: "Follow practical principles for sensitive information, credentials, recommendations, and responsible decisions." },
] as const;

export default function GuidelinesPage() {
  return (
    <div className="min-w-0 py-12 sm:py-16 lg:py-20">
      <header className="max-w-[820px] border-b border-border pb-12">
        <p className="type-meta font-mono font-medium uppercase text-accent">OperationOS Guidelines</p>
        <h1 className="type-h1 mt-5 font-display font-semibold text-ink">Learn the workflow once. Keep the reference when you need it.</h1>
        <p className="type-body-lg mt-6 max-w-reading text-ink-dim">
          Guidelines provide lasting explanations for OperationOS products, shared concepts, product use, access, and responsible handling of information.
        </p>
      </header>

      <section aria-labelledby="learning-philosophy" className="max-w-reading py-12">
        <p className="type-meta font-mono font-medium uppercase text-accent">A reference that stays useful</p>
        <h2 id="learning-philosophy" className="type-h2 mt-5 font-display font-semibold text-ink">Enough guidance for the next step, without slowing down familiar work.</h2>
        <p className="mt-5 text-base leading-7 text-ink-dim">
          OperationOS products are designed to be easy to learn and fast after you have learned them. Guidelines support that idea with clear starting points, practical explanations, and details you can return to without repeating an onboarding flow.
        </p>
      </section>

      <section aria-labelledby="start-here" className="max-w-[820px] border-y border-border bg-bg-secondary px-5 py-8 sm:px-8 sm:py-10">
        <p className="type-meta font-mono font-medium uppercase text-accent">Start here</p>
        <h2 id="start-here" className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl">Begin with the OperationOS mental model.</h2>
        <p className="mt-4 max-w-reading text-base leading-7 text-ink-dim">Learn the difference between the company, its focused products, the public website, the product workspace, and the role these Guidelines play.</p>
        <Link href="/guidelines/getting-started" className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-accent underline-offset-4 hover:text-accent-hover hover:underline">
          Read Getting started <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      <section aria-labelledby="guideline-areas" className="max-w-[900px] py-12 sm:py-16">
        <p className="type-meta font-mono font-medium uppercase text-accent">Browse by need</p>
        <h2 id="guideline-areas" className="mt-5 font-display text-3xl font-semibold tracking-[-0.025em] text-ink">Four areas cover the product and the principles around it.</h2>
        <div className="mt-8 divide-y divide-border border-y border-border">
          {areas.map((area) => (
            <Link key={area.href} href={area.href} className="group grid gap-3 py-7 sm:grid-cols-[170px_1fr_auto] sm:items-start sm:gap-6">
              <span className="type-meta pt-1 font-mono font-medium uppercase text-ink-faint">{area.label}</span>
              <span>
                <span className="block font-display text-xl font-semibold text-ink group-hover:text-accent">{area.title}</span>
                <span className="mt-2 block text-sm leading-6 text-ink-dim">{area.description}</span>
              </span>
              <ArrowRight className="mt-1 hidden h-5 w-5 text-accent sm:block" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="orientation-aid" className="max-w-reading border-t border-border pt-10">
        <h2 id="orientation-aid" className="font-display text-2xl font-semibold text-ink">Not sure where to look?</h2>
        <p className="mt-4 text-base leading-7 text-ink-dim">Start with Getting started if OperationOS is new to you. Use the RecruitOS guide when you are preparing or reviewing candidate work. Return to Concepts when a product term needs a clearer explanation.</p>
      </section>
    </div>
  );
}
