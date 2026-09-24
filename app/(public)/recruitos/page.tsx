import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { TrackedLink } from "@/components/analytics/tracked-link";
import { recruitosConfig } from "@/lib/site-config";
import { RecruitOSJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: { absolute: "RecruitOS by OperationOS" },
  description:
    "Meet RecruitOS, the flagship recruiting product from OperationOS. Learn how it reflects our human-control principles and explore the product.",
  alternates: { canonical: "/recruitos" },
  openGraph: {
    title: "RecruitOS by OperationOS",
    description:
      "Meet RecruitOS, the flagship recruiting product from OperationOS. Learn how it reflects our human-control principles and explore the product.",
    url: "/recruitos",
    siteName: "OperationOS",
    type: "website",
    images: [{
      url: "/images/recruitos/RecruitOS_workspace_preview.png",
      width: 1642,
      height: 1350,
      alt: "RecruitOS job workspace showing role requirements and an organized candidate pipeline",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RecruitOS by OperationOS",
    description: "Meet RecruitOS, the flagship recruiting product from OperationOS. Learn how it reflects our human-control principles and explore the product.",
    images: ["/images/recruitos/RecruitOS_workspace_preview.png"],
  },
};

export default function RecruitOSPage() {
  return (
    <>
      <RecruitOSJsonLd />
      <section className="border-b border-border pt-[72px]">
        <div className="container-wide grid min-h-[calc(100svh-72px)] items-center gap-12 py-16 sm:py-20 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16 lg:py-24">
          <div className="max-w-[650px]">
            <p className="type-meta font-mono font-medium uppercase text-accent">RecruitOS by OperationOS</p>
            <h1 className="type-h1 mt-6 font-display font-semibold text-ink">
              RecruitOS, a recruiting product by OperationOS.
            </h1>
            <p className="type-body-lg mt-6 max-w-xl text-ink-dim">
              RecruitOS is OperationOS’s flagship product: a structured recruiting workspace built around clear information and human control. Explore its workflows on the RecruitOS website.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <TrackedLink href={recruitosConfig.appUrl + "/"} eventName="recruitos_cta_clicked" eventProperties={{ product: "recruitos", location: "recruitos", action: "explore_product" }}>
                  Explore RecruitOS
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </TrackedLink>
              </Button>
              <Button asChild variant="secondary"><TrackedLink href={recruitosConfig.signInUrl} eventName="recruitos_access_clicked" eventProperties={{ product: "recruitos", source_page: "recruitos", cta_location: "hero", destination: "sign_in" }}>Sign in</TrackedLink></Button>
            </div>
            <p className="mt-5 text-sm leading-6 text-ink-faint">Software-assisted review. Hiring decisions remain with your team.</p>
          </div>
          <figure className="min-w-0">
            <div className="overflow-hidden rounded-lg border border-border-strong bg-surface shadow-lift">
              <Image
                src="/images/recruitos/RecruitOS_workspace_preview.png"
                alt="RecruitOS job workspace showing role requirements, candidates, match context, and recruiting status"
                width={1642}
                height={1350}
                sizes="(max-width: 1023px) 100vw, 58vw"
                className="h-auto w-full"
                priority
              />
            </div>
            <figcaption className="mt-3 text-sm leading-6 text-ink-faint">
              A real RecruitOS workspace with job context, candidate progress, and review actions together.
            </figcaption>
          </figure>
        </div>
      </section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
          <div>
            <p className="type-meta font-mono font-medium uppercase text-accent">Our flagship product</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">OperationOS principles, applied to recruiting.</h2>
          </div>
          <div className="space-y-5 text-base leading-7 text-ink-dim">
            <p>RecruitOS brings jobs, candidates, resume analysis, and natural-language commands into a structured workspace for recruiters and hiring teams.</p>
            <p>It puts the OperationOS principle into practice: easy to learn, fast after you&apos;ve learned it. Recruiters can inspect the supporting evidence and retain control over consequential actions.</p>
            <p><a className="font-semibold text-accent underline" href={recruitosConfig.appUrl + "/"}>Explore the RecruitOS product and workflows</a> on its dedicated website.</p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <p className="type-meta font-mono font-medium uppercase text-accent">Assistance with clear boundaries</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">RecruitOS organizes the review. Your team makes the call.</h2>
            <p className="mt-5 text-base leading-7 text-ink-dim">
              Software assistance can process repetitive review work and surface useful context. It cannot replace the judgment required to interpret a candidate&apos;s experience or make a consequential hiring decision.
            </p>
          </div>
          <dl className="divide-y divide-border border-y border-border">
            <div className="py-6 sm:grid sm:grid-cols-[170px_1fr] sm:gap-8">
              <dt className="font-semibold text-ink">RecruitOS helps</dt>
              <dd className="mt-2 text-sm leading-6 text-ink-dim sm:mt-0">Analyze role-related information, organize candidates, and explain recommendations.</dd>
            </div>
            <div className="py-6 sm:grid sm:grid-cols-[170px_1fr] sm:gap-8">
              <dt className="font-semibold text-ink">People decide</dt>
              <dd className="mt-2 text-sm leading-6 text-ink-dim sm:mt-0">How to interpret the context, whether to continue the conversation, and what happens next.</dd>
            </div>
          </dl>
        </div>
      </Section>

      <Section><h2 className="type-h2 font-display font-semibold text-ink">Explore RecruitOS workflows</h2><p className="mt-5 text-ink-dim">RecruitOS is free during early access, with no card required. Explore the product’s practical guides before creating an account.</p><nav aria-label="RecruitOS workflow guides" className="mt-6 flex flex-col gap-4 text-accent underline"><a href="https://recruitos.operationos.org/guides/resume-screening-checklist">Practical resume screening checklist</a><a href="https://recruitos.operationos.org/resume-analysis">Resume analysis against role requirements</a><a href="https://recruitos.operationos.org/compare-candidates">Candidate comparison with supporting evidence</a><a href="https://recruitos.operationos.org/guides/candidate-evaluation-template">Free candidate evaluation worksheet</a></nav></Section>
      <section className="border-t border-border">
        <div className="container-standard flex flex-col gap-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-ink-dim">RecruitOS is a focused recruiting product built by OperationOS.</p>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-6">
            <TrackedLink className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-dim underline-offset-4 hover:text-accent hover:underline" href="/pricing" eventName="recruitos_cta_clicked" eventProperties={{ product: "recruitos", location: "recruitos", action: "view_pricing" }}>
              Pricing
            </TrackedLink>
            <TrackedLink
              href={recruitosConfig.signUpUrl}
              eventName="recruitos_access_clicked"
              eventProperties={{ product: "recruitos", source_page: "recruitos", cta_location: "footer_strip", destination: "sign_up" }}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent underline-offset-4 hover:text-accent-hover hover:underline"
            >
              Create account
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </TrackedLink>
          </div>
        </div>
      </section>
    </>
  );
}
