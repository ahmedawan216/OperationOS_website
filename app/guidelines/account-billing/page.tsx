import type { Metadata } from "next";
import Link from "next/link";

import { GuidelinesArticle } from "@/components/guidelines/guidelines-article";
import { GuidelinesCallout } from "@/components/guidelines/guidelines-callout";

export const metadata: Metadata = {
  title: "Account & Billing | Guidelines",
  description: "Understand the current RecruitOS access process and the account and billing controls available on the public OperationOS website today.",
  alternates: { canonical: "/guidelines/account-billing" },
};

export default function AccountBillingPage() {
  return (
    <GuidelinesArticle
      path="/guidelines/account-billing"
      eyebrow="Account & billing"
      title="Know what the public access process supports today."
      description="RecruitOS access is currently requested through its public waitlist. The OperationOS website does not currently present self-service account or billing controls."
    >
      <h2>Request RecruitOS access through the public flow</h2>
      <p>The current public path begins on the <Link href="/recruitos#waitlist">RecruitOS access form</Link>. It collects the details needed to request access and receive relevant updates. Submitting the form is not a checkout and does not create a paid subscription.</p>

      <h2>Self-service billing is not part of the public website</h2>
      <p>There are currently no public pricing plans, payment controls, invoices, trial controls, subscription settings, or team billing tools on this website. Do not expect to manage those functions through the current public pages.</p>
      <GuidelinesCallout label="Note">No public plan name, price, trial period, or billing schedule is established here. Commercial terms should be clear before any paid commitment is requested.</GuidelinesCallout>

      <h2>Use official OperationOS interfaces</h2>
      <p>Use the public RecruitOS access flow for access requests. Do not send passwords, payment credentials, or other sensitive account information through informal messages or unrelated forms.</p>

      <h2>Check the interface before assuming a control exists</h2>
      <p>Account and billing capabilities should be treated as available only when they are clearly presented through an official OperationOS interface. This page describes the current public experience and may be revised if supported commercial controls are introduced later.</p>
    </GuidelinesArticle>
  );
}
