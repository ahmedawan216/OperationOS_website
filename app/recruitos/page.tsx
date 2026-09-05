import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { TrackedLink } from "@/components/analytics/tracked-link";
import { recruitosConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "RecruitOS | Clearer Candidate Review Workflows",
  description:
    "RecruitOS helps recruiters and hiring teams review candidates against role requirements, understand recommendations, and keep hiring work organized.",
  alternates: { canonical: "/recruitos" },
  openGraph: {
    title: "RecruitOS | Clearer Candidate Review Workflows",
    description:
      "Review candidates against role requirements, understand the context behind recommendations, and keep the next action visible.",
    url: "/recruitos",
    siteName: "OperationOS.org",
    type: "website",
    images: [{
      url: "/images/recruitos/RecruitOS_workspace_preview.png",
      width: 1642,
      height: 1382,
      alt: "RecruitOS job workspace showing role requirements and an organized candidate pipeline",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RecruitOS | Clearer Candidate Review Workflows",
    description: "Review candidates with role context, readable recommendations, and visible next actions.",
    images: ["/images/recruitos/RecruitOS_workspace_preview.png"],
  },
};

const workflowSteps = [
  { number: "01", title: "Define the role", description: "Start with the job context and requirements candidates should be reviewed against." },
  { number: "02", title: "Add a candidate", description: "Bring a resume into the workspace so the review stays connected to the active role." },
  { number: "03", title: "Review the analysis", description: "Inspect relevant experience, skills, concerns, and the reasoning behind the recommendation." },
  { number: "04", title: "Choose the next action", description: "Update the candidate status and decide what should happen next with the full context visible." },
] as const;

const workspaceCapabilities = [
  "Role requirements remain visible during review",
  "Candidates stay connected to the correct job",
  "Status and progress are available in one workspace",
] as const;

const analysisDetails = [
  "Recommendation and match context",
  "Relevant experience and supporting summary",
  "Matching skills, gaps, and concerns",
  "Reasoning available for recruiter review",
] as const;

export default function RecruitOSPage() {
  return (
    <>
      <section className="border-b border-border pt-[72px]">
        <div className="container-wide grid min-h-[calc(100svh-72px)] items-center gap-12 py-16 sm:py-20 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16 lg:py-24">
          <div className="max-w-[650px]">
            <p className="type-meta font-mono font-medium uppercase text-accent">RecruitOS by OperationOS</p>
            <h1 className="type-h1 mt-6 font-display font-semibold text-ink">
              Review candidates with the role, reasoning, and next step in view.
            </h1>
            <p className="type-body-lg mt-6 max-w-xl text-ink-dim">
              RecruitOS gives recruiters and hiring teams one focused workflow for comparing candidates with role requirements, understanding recommendations, and keeping review progress organized.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <TrackedLink href={recruitosConfig.signUpUrl} eventName="recruitos_access_clicked" eventProperties={{ product: "recruitos", source_page: "recruitos", cta_location: "hero", destination: "sign_up" }}>
                  Create account
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
                height={1382}
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
            <p className="type-meta font-mono font-medium uppercase text-accent">Candidate review needs context</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">The repetitive work should not hide the hiring decision.</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            <p className="text-base leading-7 text-ink-dim">
              Reviewing resumes against a role takes sustained attention. Requirements, candidate details, and review notes can become separated just when a recruiter needs to compare them.
            </p>
            <p className="text-base leading-7 text-ink-dim">
              RecruitOS organizes that first review into a clear workflow, helping teams process repeatable steps while preserving the context needed for a closer look.
            </p>
          </div>
        </div>
      </Section>

      <Section id="workflow" className="border-y border-border bg-bg-secondary">
        <div className="max-w-3xl">
          <p className="type-meta font-mono font-medium uppercase text-accent">A connected review workflow</p>
          <h2 className="type-h2 mt-5 font-display font-semibold text-ink">From role requirements to a considered next action.</h2>
          <p className="mt-5 text-base leading-7 text-ink-dim">
            Each step keeps the candidate connected to the job and leaves the final decision with the people responsible for hiring.
          </p>
        </div>
        <ol className="mt-12 grid border-y border-border sm:grid-cols-2 lg:grid-cols-4">
          {workflowSteps.map((step, index) => (
            <li
              key={step.number}
              className={`py-7 sm:p-7 ${index > 0 ? "border-t border-border sm:border-t-0" : ""} ${index % 2 === 1 ? "sm:border-l" : ""} ${index > 1 ? "lg:border-l" : ""}`}
            >
              <span className="font-mono text-xs font-medium text-accent">{step.number}</span>
              <h3 className="mt-5 font-display text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-ink-dim">{step.description}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
          <div>
            <p className="type-meta font-mono font-medium uppercase text-accent">One place for active review</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">Keep the role, candidate pipeline, and progress connected.</h2>
            <p className="mt-5 text-base leading-7 text-ink-dim">
              The RecruitOS workspace brings the information around candidate review into one focused view, so status and next actions do not disappear between disconnected steps.
            </p>
            <ul className="mt-8 space-y-4">
              {workspaceCapabilities.map((capability) => (
                <li key={capability} className="flex gap-3 text-sm leading-6 text-ink-dim">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                  {capability}
                </li>
              ))}
            </ul>
          </div>
          <dl className="divide-y divide-border border-y border-border">
            <div className="py-6 sm:grid sm:grid-cols-[170px_1fr] sm:gap-8">
              <dt className="font-semibold text-ink">Review context</dt>
              <dd className="mt-2 text-sm leading-6 text-ink-dim sm:mt-0">See the active role and its requirements alongside the candidate pipeline.</dd>
            </div>
            <div className="py-6 sm:grid sm:grid-cols-[170px_1fr] sm:gap-8">
              <dt className="font-semibold text-ink">Visible progress</dt>
              <dd className="mt-2 text-sm leading-6 text-ink-dim sm:mt-0">Keep candidate status connected to the work instead of tracking it in a separate step.</dd>
            </div>
            <div className="py-6 sm:grid sm:grid-cols-[170px_1fr] sm:gap-8">
              <dt className="font-semibold text-ink">Next action</dt>
              <dd className="mt-2 text-sm leading-6 text-ink-dim sm:mt-0">Return to the workspace and understand where review attention is needed next.</dd>
            </div>
          </dl>
        </div>
      </Section>

      <Section className="bg-ink text-white">
        <div className="grid items-center gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <div>
            <p className="type-meta font-mono font-medium uppercase text-[#9aabff]">Readable candidate analysis</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-white">
              A recommendation is more useful when you can examine the reasons.
            </h2>
            <p className="mt-5 text-base leading-7 text-white/70">
              RecruitOS surfaces role-related context alongside its recommendation. Recruiters can review the supporting information, question the result, and decide whether a candidate should move forward.
            </p>
            <ul className="mt-8 space-y-4 border-l border-white/20 pl-6">
              {analysisDetails.map((detail) => <li key={detail} className="text-sm leading-6 text-white/70">{detail}</li>)}
            </ul>
          </div>
          <figure className="min-w-0">
            <div className="mx-auto max-w-[775px] overflow-hidden rounded-lg border border-white/15 bg-[#08090c]">
              <Image
                src="/images/recruitos/Candidate_analysis_2.png"
                alt="RecruitOS candidate analysis showing a recommendation, match context, summary, skills, concerns, and reasoning"
                width={775}
                height={1230}
                sizes="(max-width: 1023px) 100vw, 58vw"
                className="h-auto w-full"
              />
            </div>
            <figcaption className="mt-3 text-sm leading-6 text-white/60">
              A real candidate analysis with the result and supporting context available for review.
            </figcaption>
          </figure>
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

      <Section className="border-y border-border bg-bg-secondary">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="type-meta font-mono font-medium uppercase text-accent">A focused fit</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">For teams that need a clearer candidate-review process.</h2>
            <p className="mt-5 text-base leading-7 text-ink-dim">
              RecruitOS is designed for recruiters, hiring teams, and smaller teams reviewing multiple candidates against active roles. It supports candidate review and organization without claiming to replace every part of an applicant tracking system.
            </p>
          </div>
          <div className="border-t border-border pt-10 lg:border-l lg:border-t-0 lg:pl-16 lg:pt-0">
            <p className="type-meta font-mono font-medium uppercase text-accent">Clarity that lasts</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">Understand the first step, then move faster with practice.</h2>
            <p className="mt-5 text-base leading-7 text-ink-dim">
              RecruitOS follows the OperationOS principle: easy to learn, fast after you&apos;ve learned it. The workflow keeps important context available and is designed to support guidance where unfamiliar decisions need more explanation.
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="overflow-hidden rounded-lg border border-border-strong bg-surface">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="bg-accent px-6 py-10 text-white sm:px-10 sm:py-12 lg:px-12 lg:py-14">
              <p className="type-meta font-mono font-medium uppercase text-white/70">RecruitOS is available now</p>
              <h2 className="type-h2 mt-5 font-display font-semibold text-white">Bring a clearer workflow to candidate review.</h2>
              <p className="mt-5 max-w-lg text-base leading-7 text-white/80">Create a RecruitOS account and continue in the independent product application.</p>
            </div>
            <div className="flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
              <h3 className="font-display text-2xl font-semibold text-ink">Start using RecruitOS</h3>
              <p className="mt-3 max-w-lg text-sm leading-6 text-ink-dim">New users can create an account. Returning users can sign in and continue their work.</p>
              <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row">
                <Button asChild><TrackedLink href={recruitosConfig.signUpUrl} eventName="recruitos_access_clicked" eventProperties={{ product: "recruitos", source_page: "recruitos", cta_location: "access_panel", destination: "sign_up" }}>Create account<ArrowRight className="h-4 w-4" aria-hidden="true" /></TrackedLink></Button>
                <Button asChild variant="secondary"><TrackedLink href={recruitosConfig.signInUrl} eventName="recruitos_access_clicked" eventProperties={{ product: "recruitos", source_page: "recruitos", cta_location: "access_panel", destination: "sign_in" }}>Sign in</TrackedLink></Button>
              </div>
            </div>
          </div>
        </div>
      </Section>

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
