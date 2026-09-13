import type { Metadata } from "next";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { TrackedLink } from "@/components/analytics/tracked-link";
import { getRecruitOSCheckoutUrl, recruitosConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "RecruitOS Pricing",
  description:
    "Compare RecruitOS Free, Standard, and Pro plans for recruiting workflows, candidate review, resume analysis, and human-reviewed actions.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "RecruitOS Pricing | OperationOS.org",
    description:
      "Compare RecruitOS Free, Standard, and Pro plans. Start free, then choose more capacity as your recruiting workload grows.",
    url: "/pricing",
    siteName: "OperationOS.org",
    type: "website",
    images: [
      {
        url: "/brand/operationos-avatar-light-1024.png",
        width: 1024,
        height: 1024,
        alt: "OperationOS H1 mark",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "RecruitOS Pricing | OperationOS.org",
    description:
      "Compare RecruitOS Free, Standard, and Pro plans for different recruiting workloads.",
    images: ["/brand/operationos-avatar-light-1024.png"],
  },
};

type Plan = {
  name: "Free" | "Standard" | "Pro";
  price: string;
  cadence: string | null;
  badge?: string;
  positioning: string;
  features: readonly string[];
  cta: string;
  emphasized?: boolean;
  ctaLocation: string;
  planKey: "free" | "standard" | "pro";
  href: string;
};

const plans: readonly Plan[] = [
  {
    name: "Free",
    price: "$0",
    cadence: "Forever",
    positioning: "Get started with RecruitOS on real recruiting work.",
    features: [
      "1 active job",
      "2 resume analyses per day",
      "Jobs, candidates, and candidate comparison",
      "Natural-language RecruitOS commands",
      "Contextual follow-ups",
      "Human-reviewed actions",
    ],
    cta: "Get started free",
    ctaLocation: "free_plan",
    planKey: "free",
    href: recruitosConfig.signUpUrl,
  },
  {
    name: "Standard",
    price: "$39",
    cadence: "/ month",
    badge: "MOST POPULAR",
    positioning: "For recruiters using RecruitOS as part of their everyday workflow.",
    features: [
      "25 active jobs",
      "Monthly resume analysis capacity for active recruiting",
      "Jobs, candidates, and candidate comparison",
      "Natural-language RecruitOS commands",
      "Contextual follow-ups",
      "Human-reviewed actions",
    ],
    cta: "Choose Standard",
    emphasized: true,
    ctaLocation: "standard_plan",
    planKey: "standard",
    href: getRecruitOSCheckoutUrl("standard"),
  },
  {
    name: "Pro",
    price: "$69",
    cadence: "/ month",
    positioning: "For recruiters working across larger candidate volumes and workloads.",
    features: [
      "100 active jobs",
      "Higher monthly resume analysis capacity",
      "Jobs, candidates, and candidate comparison",
      "Natural-language RecruitOS commands",
      "Contextual follow-ups",
      "Human-reviewed actions",
    ],
    cta: "Choose Pro",
    ctaLocation: "pro_plan",
    planKey: "pro",
    href: getRecruitOSCheckoutUrl("pro"),
  },
] as const;

const faqItems = [
  {
    question: "Is RecruitOS Free really free?",
    answer:
      "Yes. Free is $0 and is intended as a permanent way to start using RecruitOS on real recruiting work.",
  },
  {
    question: "Do I need a credit card for Free?",
    answer:
      "No. A credit card is not required to create a Free RecruitOS account.",
  },
  {
    question: "What happens when I reach the Free resume-analysis limit?",
    answer:
      "Free includes 2 resume analyses per day. Once you reach that daily limit, you can continue using the rest of RecruitOS and resume analysis becomes available again when the daily allowance resets.",
  },
  {
    question: "Can I cancel a paid plan?",
    answer:
      "Paid plans are billed monthly with no annual commitment and can be canceled anytime through Paddle billing management.",
  },
  {
    question: "What is the difference between Standard and Pro?",
    answer:
      "Standard is designed for everyday active recruiting with 25 active jobs and monthly resume analysis capacity. Pro is designed for higher-volume workloads with 100 active jobs and a larger monthly resume analysis capacity.",
  },
  {
    question: "Does RecruitOS make hiring decisions automatically?",
    answer:
      "No. RecruitOS can analyze, organize, compare, prepare, and propose actions, while consequential recruiting actions remain reviewable by the recruiter.",
  },
  {
    question: "Can I change plans later?",
    answer:
      "Yes. If you already have a paid RecruitOS subscription, plan changes are handled through Paddle billing management so a second subscription is not created.",
  },
] as const;

export default function PricingPage() {
  return (
    <>
      <section className="border-b border-border pt-[72px]">
        <div className="container-standard py-16 text-center sm:py-20 lg:py-24">
          <p className="type-meta font-mono font-medium uppercase text-accent">
            RecruitOS pricing
          </p>
          <h1 className="type-h1 mx-auto mt-6 max-w-4xl font-display font-semibold text-ink">
            Start free. Add more capacity when recruiting becomes a daily workflow.
          </h1>
          <p className="type-body-lg mx-auto mt-6 max-w-2xl text-ink-dim">
            Every plan includes the core RecruitOS experience. Choose based on the volume of recruiting work you need to manage.
          </p>
        </div>
      </section>

      <Section>
        <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={
                plan.emphasized
                  ? "flex min-h-full flex-col rounded-[12px] border border-[#0E6E6E] bg-[#0F1620] p-6 text-white sm:p-8"
                  : "flex min-h-full flex-col rounded-[12px] border border-border-strong bg-surface p-6 sm:p-8"
              }
              aria-label={`${plan.name} plan`}
            >
              <div>
                <div className="flex min-h-7 items-start justify-between gap-4">
                  <h2 className={plan.emphasized ? "type-h3 font-display font-semibold text-white" : "type-h3 font-display font-semibold text-ink"}>
                    {plan.name}
                  </h2>
                  {plan.badge ? (
                    <span className="rounded-full border border-[#0E6E6E] px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-white">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>

                <div className="mt-8 flex items-end gap-2">
                  <span className={plan.emphasized ? "font-display text-5xl font-semibold tracking-[-0.04em] text-white" : "font-display text-5xl font-semibold tracking-[-0.04em] text-ink"}>
                    {plan.price}
                  </span>
                  {plan.cadence ? (
                    <span className={plan.emphasized ? "pb-1 text-sm text-white/65" : "pb-1 text-sm text-ink-dim"}>
                      {plan.cadence}
                    </span>
                  ) : null}
                </div>

                <p className={plan.emphasized ? "mt-6 min-h-[84px] text-base leading-7 text-white/75" : "mt-6 min-h-[84px] text-base leading-7 text-ink-dim"}>
                  {plan.positioning}
                </p>
              </div>

              <div className="mt-6">
                <Button
                  asChild
                  className={
                    plan.emphasized
                      ? "w-full border-white bg-white text-[#0F1620] hover:border-white hover:bg-white/90"
                      : "w-full"
                  }
                  variant={plan.emphasized ? "secondary" : "primary"}
                >
                  <TrackedLink
                    href={plan.href}
                    eventName="recruitos_access_clicked"
                    eventProperties={{
                      product: "recruitos",
                      source_page: "pricing",
                      cta_location: plan.ctaLocation,
                      destination: plan.planKey === "free" ? "sign_up" : "checkout",
                      plan: plan.planKey,
                    }}
                  >
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </TrackedLink>
                </Button>
              </div>

              <div className={plan.emphasized ? "my-7 border-t border-white/15" : "my-7 border-t border-border"} />

              <ul className="space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature} className={plan.emphasized ? "flex gap-3 text-sm leading-6 text-white/85" : "flex gap-3 text-sm leading-6 text-ink-dim"}>
                    <Check className={plan.emphasized ? "mt-0.5 h-5 w-5 shrink-0 text-[#4FB8B0]" : "mt-0.5 h-5 w-5 shrink-0 text-accent"} aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section className="border-y border-border bg-bg-secondary">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-20">
          <div className="max-w-xl">
            <p className="type-meta font-mono font-medium uppercase text-accent">
              Human control on every plan
            </p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">
              More capacity does not mean less recruiter control.
            </h2>
          </div>
          <div className="rounded-[12px] border border-border-strong bg-surface p-6 sm:p-8">
            <div className="flex gap-4">
              <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
              <p className="text-base leading-7 text-ink-dim">
                RecruitOS can analyze, organize, compare, prepare, and propose actions across every plan. Consequential recruiting actions remain reviewable by the recruiter before they move forward.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="type-meta font-mono font-medium uppercase text-accent">
            Pricing questions
          </p>
          <h2 className="type-h2 mt-5 font-display font-semibold text-ink">
            What to know before you choose a plan.
          </h2>

          <div className="mt-10 divide-y divide-border border-y border-border">
            {faqItems.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-md text-left font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                  <span>{item.question}</span>
                  <span className="text-xl font-normal text-ink-faint transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pb-1 pt-3 text-sm leading-6 text-ink-dim">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      <section className="border-t border-border bg-ink text-white">
        <div className="container-standard flex flex-col gap-8 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
          <div className="max-w-2xl">
            <p className="type-meta font-mono font-medium uppercase text-[#9aabff]">
              Start with RecruitOS
            </p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-white">
              Use the core recruiting workflow free, then add capacity when you need it.
            </h2>
          </div>
          <Button asChild className="shrink-0 border-white bg-white text-ink hover:border-white hover:bg-white/90">
            <TrackedLink
              href={recruitosConfig.signUpUrl}
              eventName="recruitos_access_clicked"
              eventProperties={{
                product: "recruitos",
                source_page: "pricing",
                cta_location: "closing",
                destination: "sign_up",
                plan: "free",
              }}
            >
              Get started free
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </TrackedLink>
          </Button>
        </div>
      </section>
    </>
  );
}
