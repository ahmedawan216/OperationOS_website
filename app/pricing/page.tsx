import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing and Access",
  description:
    "Understand how RecruitOS access works today and how OperationOS presents product-specific pricing and commercial terms.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing and Access | OperationOS.org",
    description:
      "See how RecruitOS access works today and what OperationOS makes clear before any paid commitment.",
    url: "/pricing",
    siteName: "OperationOS.org",
    type: "website",
    images: [
      {
        url: "/images/og-image-v2.png",
        width: 1200,
        height: 630,
        alt: "OperationOS focused software for operational work",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing and Access | OperationOS.org",
    description:
      "See how RecruitOS access works today and what OperationOS makes clear before any paid commitment.",
    images: ["/images/og-image-v2.png"],
  },
};

const accessDetails = [
  { term: "Product", detail: "RecruitOS" },
  { term: "Current access", detail: "Requested through the waitlist" },
  { term: "Public pricing", detail: "Not currently published" },
  { term: "Self-service checkout", detail: "Not currently available" },
] as const;

const clarityPrinciples = [
  "What access includes should be understandable before a paid commitment.",
  "Important product limits and commercial terms should be presented in context.",
  "Pricing should reflect the product being used, without forcing unrelated products into one bundle.",
] as const;

export default function PricingPage() {
  return (
    <>
      <section className="border-b border-border pt-[72px]">
        <div className="container-standard grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.75fr] lg:items-end lg:gap-20 lg:py-24">
          <div className="max-w-3xl">
            <p className="type-meta font-mono font-medium uppercase text-accent">
              Pricing and access
            </p>
            <h1 className="type-h1 mt-6 font-display font-semibold text-ink">
              Understand the product and the terms before you commit.
            </h1>
          </div>
          <p className="type-body-lg max-w-xl text-ink-dim">
            OperationOS products have their own access path and pricing context. Commercial terms will be presented clearly with the product when they are available.
          </p>
        </div>
      </section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20">
          <div className="max-w-xl">
            <p className="type-meta font-mono font-medium uppercase text-accent">
              RecruitOS / An OperationOS product
            </p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">
              Start with access to the recruiting workflow.
            </h2>
            <p className="mt-5 text-base leading-7 text-ink-dim">
              RecruitOS helps recruiters and hiring teams review candidates against role requirements, understand the context behind recommendations, and keep review progress organized. Hiring decisions remain with your team.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Button asChild>
                <Link href="/recruitos#waitlist">
                  Join the RecruitOS waitlist
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="quiet">
                <Link href="/recruitos">Explore RecruitOS</Link>
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border-strong bg-surface shadow-lift">
            <div className="border-b border-border bg-surface-2 px-5 py-4 sm:px-7">
              <p className="type-meta font-mono font-medium uppercase text-ink-faint">
                Current access status
              </p>
            </div>
            <dl className="divide-y divide-border px-5 sm:px-7">
              {accessDetails.map((item) => (
                <div key={item.term} className="grid gap-2 py-5 sm:grid-cols-[150px_1fr] sm:gap-8">
                  <dt className="text-sm font-semibold text-ink">{item.term}</dt>
                  <dd className="text-sm leading-6 text-ink-dim sm:text-right">{item.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      <Section className="border-y border-border bg-bg-secondary">
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20">
          <div className="max-w-xl">
            <p className="type-meta font-mono font-medium uppercase text-accent">
              Commercial clarity
            </p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">
              The important details should be visible before payment enters the workflow.
            </h2>
            <p className="mt-5 text-base leading-7 text-ink-dim">
              RecruitOS is currently in an access stage, not a public purchasing flow. Joining the waitlist requests access and does not create a paid subscription.
            </p>
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {clarityPrinciples.map((principle) => (
              <li key={principle} className="flex gap-4 py-6 text-base leading-7 text-ink-dim">
                <Check className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                <span>{principle}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-20">
          <div className="max-w-2xl">
            <p className="type-meta font-mono font-medium uppercase text-accent">
              Product-specific by design
            </p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">
              Each product carries the pricing context that belongs to it.
            </h2>
            <p className="mt-5 text-base leading-7 text-ink-dim">
              OperationOS builds focused products for distinct operational work. Keeping pricing and access information with each product makes it easier to understand what you are evaluating today and leaves a clear structure for publicly announced products later.
            </p>
          </div>
          <aside className="border-l-2 border-accent bg-accent-soft px-6 py-6 sm:px-8" aria-labelledby="billing-guidance-title">
            <p className="type-meta font-mono font-medium uppercase text-accent">Reference</p>
            <h2 id="billing-guidance-title" className="mt-4 font-display text-xl font-semibold text-ink">
              Need the current account and billing details?
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-dim">
              The Guidelines explain what the public access process supports today and which account or billing controls are not part of the current website.
            </p>
            <Link href="/guidelines/account-billing" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent underline-offset-4 hover:text-accent-hover hover:underline">
              Read the Account &amp; Billing Guidelines
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </Section>

      <section className="border-t border-border bg-ink text-white">
        <div className="container-standard flex flex-col gap-8 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
          <div className="max-w-2xl">
            <p className="type-meta font-mono font-medium uppercase text-[#9aabff]">RecruitOS access</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-white">
              See whether RecruitOS fits your candidate-review workflow.
            </h2>
            <p className="mt-4 text-base leading-7 text-white/70">
              Explore the product, then request access through the RecruitOS waitlist when you are ready.
            </p>
          </div>
          <Button asChild className="shrink-0 border-white bg-white text-ink hover:border-white hover:bg-white/90">
            <Link href="/recruitos#waitlist">
              Join the RecruitOS waitlist
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
