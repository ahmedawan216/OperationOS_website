import { ArrowRight, Mail } from "lucide-react";

import { Section } from "@/components/layout/section";
import { createPageMetadata } from "@/lib/page-metadata";
import { TrackedLink } from "@/components/analytics/tracked-link";
import { recruitosConfig } from "@/lib/site-config";

export const metadata = createPageMetadata(
  "Contact OperationOS",
  "Contact OperationOS about product access, company questions, website feedback, privacy, or security concerns.",
  "/contact",
);

const contactTopics = [
  "Questions about OperationOS or RecruitOS",
  "RecruitOS account or product questions",
  "Website, privacy, or security concerns",
  "General company inquiries",
] as const;

export default function ContactPage() {
  return (
    <>
      <section className="border-b border-border pt-[72px]">
        <div className="container-standard grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.75fr] lg:items-end lg:gap-20 lg:py-24">
          <div className="max-w-3xl">
            <p className="type-meta font-mono font-medium uppercase text-accent">Contact OperationOS</p>
            <h1 className="type-h1 mt-6 font-display font-semibold text-ink">Send your question through one clear contact path.</h1>
          </div>
          <p className="type-body-lg max-w-xl text-ink-dim">Use the established OperationOS email for product, company, website, privacy, or security questions.</p>
        </div>
      </section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="type-meta font-mono font-medium uppercase text-accent">What to send</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">Give enough context to route the question.</h2>
            <ul className="mt-8 divide-y divide-border border-y border-border">
              {contactTopics.map((topic) => <li key={topic} className="py-4 text-sm leading-6 text-ink-dim">{topic}</li>)}
            </ul>
          </div>
          <div className="self-start rounded-lg border border-border-strong bg-surface px-6 py-8 shadow-lift sm:px-9 sm:py-10">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-accent-soft text-accent"><Mail className="h-5 w-5" aria-hidden="true" /></span>
            <h2 className="mt-6 font-display text-2xl font-semibold text-ink">Email OperationOS</h2>
            <a className="mt-4 inline-flex min-h-11 max-w-full items-center break-all text-base font-semibold text-accent underline decoration-accent-dim underline-offset-4 hover:text-accent-hover" href="mailto:operationos.org@gmail.com">operationos.org@gmail.com</a>
            <p className="mt-5 text-sm leading-6 text-ink-dim">Do not include passwords, payment credentials, or other sensitive information that is not necessary to explain your question.</p>
          </div>
        </div>
      </Section>

      <section className="border-t border-border bg-bg-secondary">
        <div className="container-standard flex flex-col gap-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-ink-dim">Ready to use RecruitOS rather than contact OperationOS?</p>
          <TrackedLink href={recruitosConfig.signUpUrl} eventName="recruitos_access_clicked" eventProperties={{ product: "recruitos", source_page: "contact", cta_location: "footer_strip", destination: "sign_up" }} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent hover:text-accent-hover hover:underline">Create account<ArrowRight className="h-4 w-4" aria-hidden="true" /></TrackedLink>
        </div>
      </section>
    </>
  );
}
