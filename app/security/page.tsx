import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { createPageMetadata } from "@/lib/page-metadata";

export const metadata = createPageMetadata(
  "Security and Trust",
  "Understand the security boundaries of the OperationOS public website, its data-handling approach, and how to report a concern.",
  "/security",
);

const boundaries = [
  {
    title: "Collect for a defined purpose",
    text: "Public forms ask for information tied to a specific action, such as requesting RecruitOS access or sharing website feedback.",
  },
  {
    title: "Keep privileged credentials on the server",
    text: "Privileged configuration used by the feedback storage path is kept in server-only code. Public browser code uses publishable configuration for the waitlist workflow.",
  },
  {
    title: "Validate before processing",
    text: "Public submission paths check required input and expected formats before processing. These controls reduce avoidable input errors but do not remove every security risk.",
  },
] as const;

export default function SecurityPage() {
  return (
    <>
      <section className="border-b border-border pt-[72px]">
        <div className="container-standard grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.75fr] lg:items-end lg:gap-20 lg:py-24">
          <div className="max-w-3xl">
            <p className="type-meta font-mono font-medium uppercase text-accent">Security and trust</p>
            <h1 className="type-h1 mt-6 font-display font-semibold text-ink">
              Trust starts with clear boundaries and supportable claims.
            </h1>
          </div>
          <p className="type-body-lg max-w-xl text-ink-dim">
            This page describes the current OperationOS public website. It does not extend security or certification claims beyond what is established for this website.
          </p>
        </div>
      </section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <div>
            <p className="type-meta font-mono font-medium uppercase text-accent">Website boundaries</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">Protect the paths where information enters the website.</h2>
          </div>
          <div className="divide-y divide-border border-y border-border">
            {boundaries.map((boundary) => (
              <div key={boundary.title} className="py-6 sm:grid sm:grid-cols-[180px_1fr] sm:gap-8">
                <h3 className="font-display text-lg font-semibold text-ink">{boundary.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-dim sm:mt-0">{boundary.text}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section className="border-y border-border bg-bg-secondary">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="type-meta font-mono font-medium uppercase text-accent">Operational transparency</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">Website services should be visible in the privacy explanation.</h2>
            <p className="mt-5 text-base leading-7 text-ink-dim">
              OperationOS uses service providers to host the website, process form submissions, send waitlist email, store feedback, and understand website usage. The Privacy Policy explains these activities at a practical level.
            </p>
            <Link href="/privacy" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent hover:text-accent-hover hover:underline">
              Read the Privacy Policy
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="border-t border-border pt-10 lg:border-l lg:border-t-0 lg:pl-16 lg:pt-0">
            <p className="type-meta font-mono font-medium uppercase text-accent">Human responsibility</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">Consequential recommendations require human review.</h2>
            <p className="mt-5 text-base leading-7 text-ink-dim">
              RecruitOS can organize candidate information and explain recommendation context. The people responsible for hiring review that context and decide what happens next.
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="rounded-lg border border-border-strong bg-surface px-6 py-8 shadow-lift sm:px-9 sm:py-10 lg:flex lg:items-center lg:justify-between lg:gap-16">
          <div className="max-w-2xl">
            <p className="type-meta font-mono font-medium uppercase text-accent">Report a concern</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">Send security concerns through the established contact path.</h2>
            <p className="mt-4 text-base leading-7 text-ink-dim">Include enough detail to understand the concern, but do not send passwords, credentials, or sensitive personal information by email.</p>
          </div>
          <Button asChild className="mt-7 shrink-0 lg:mt-0">
            <a href="mailto:operationos.org@gmail.com">Email OperationOS</a>
          </Button>
        </div>
        <Link href="/guidelines/privacy-security" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent hover:text-accent-hover hover:underline">
          Read practical Privacy &amp; Security Guidelines
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Section>
    </>
  );
}
