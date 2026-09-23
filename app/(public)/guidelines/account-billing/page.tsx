import type { Metadata } from "next";
import Link from "next/link";

import { GuidelinesArticle } from "@/components/guidelines/guidelines-article";
import { GuidelinesCallout } from "@/components/guidelines/guidelines-callout";
import { TrackedLink } from "@/components/analytics/tracked-link";
import { recruitosConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Account & Billing | Guidelines",
  description: "Learn how to create or access a RecruitOS account and understand the billing information available on the OperationOS website today.",
  alternates: { canonical: "/guidelines/account-billing" },
};

export default function AccountBillingPage() {
  return (
    <GuidelinesArticle
      path="/guidelines/account-billing"
      eyebrow="Account & billing"
      title="Move from the public website into your RecruitOS account."
      description="RecruitOS is available through its independent application. The OperationOS website explains the product and provides direct create-account and sign-in paths."
    >
      <h2>Create or access your RecruitOS account</h2>
      <p>Start on the <Link href="/recruitos">RecruitOS product page</Link>, then <TrackedLink href={recruitosConfig.signUpUrl} eventName="recruitos_access_clicked" eventProperties={{ product: "recruitos", source_page: "guidelines", cta_location: "account_billing", destination: "sign_up" }}>create an account</TrackedLink> in the RecruitOS application. If you already have an account, <TrackedLink href={recruitosConfig.signInUrl} eventName="recruitos_access_clicked" eventProperties={{ product: "recruitos", source_page: "guidelines", cta_location: "account_billing", destination: "sign_in" }}>sign in</TrackedLink> to continue your work.</p>

      <h2>Self-service billing is not part of the public website</h2>
      <p>There are currently no public pricing plans, payment controls, invoices, trial controls, subscription settings, or team billing tools on this website. Do not expect to manage those functions through the current public pages.</p>
      <GuidelinesCallout label="Note">No public plan name, price, trial period, or billing schedule is established here. Commercial terms should be clear before any paid commitment is requested.</GuidelinesCallout>

      <h2>Use official OperationOS interfaces</h2>
      <p>Use the official RecruitOS create-account and sign-in pages for account access. Do not send passwords, payment credentials, or other sensitive account information through informal messages or unrelated forms.</p>

      <h2>Check the interface before assuming a control exists</h2>
      <p>Account and billing capabilities should be treated as available only when they are clearly presented through an official RecruitOS interface. This page describes the current public experience and may be revised if supported commercial controls are introduced later.</p>
    </GuidelinesArticle>
  );
}
