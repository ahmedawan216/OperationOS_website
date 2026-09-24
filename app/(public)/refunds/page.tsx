import Link from "next/link";

import { LegalDocument } from "@/components/legal/legal-document";
import { createPageMetadata } from "@/lib/page-metadata";

export const metadata = createPageMetadata(
  "Refund Policy",
  "Read the OperationOS refund policy for monthly RecruitOS subscriptions, cancellations, billing issues, and refund requests.",
  "/refunds",
);

export default function RefundsPage() {
  return (
    <LegalDocument
      eyebrow="Refund Policy"
      title="Refunds and cancellations for RecruitOS subscriptions."
      description="This policy explains how subscription cancellations, billing issues, and refund requests are handled for RecruitOS, an OperationOS product."
      effectiveDate="September 13, 2026"
      showReviewNotice={false}
    >
      <h2>Scope of this policy</h2>
      <p>This Refund Policy applies to paid RecruitOS subscriptions offered by OperationOS and purchased through Paddle. It does not apply to the RecruitOS Free plan because that plan has no subscription charge. If a separate written agreement expressly provides different refund terms, that agreement controls to the extent of any conflict.</p>

      <h2>Subscription billing</h2>
      <p>RecruitOS currently offers the following plans:</p>
      <ul>
        <li>RecruitOS Free at $0.</li>
        <li>RecruitOS Standard at $39 per month.</li>
        <li>RecruitOS Pro at $69 per month.</li>
      </ul>
      <p>Standard and Pro subscriptions are billed monthly. RecruitOS does not currently offer annual plans, a free trial, account credits, usage-based charges, or metered billing. Each paid subscription renews monthly unless it is canceled before the next renewal charge. Taxes may be added where required.</p>

      <h2>Cancellation</h2>
      <p>You may cancel a paid RecruitOS subscription at any time through the Paddle Customer Portal linked in your transaction confirmation email, through <a href="https://paddle.net">Paddle.net</a>, or by contacting OperationOS for assistance. Cancellation stops future renewals. After cancellation, paid access continues through the end of the billing period that has already been paid.</p>
      <p>Canceling a subscription does not automatically refund a charge already processed. To avoid a new renewal charge, cancel before the next billing date shown in your subscription or purchase information.</p>

      <h2>Refunds</h2>
      <p>Subscription charges are generally non-refundable once a billing period begins. Refund requests are reviewed individually. A refund may be considered in circumstances such as duplicate billing, an accidental charge reported promptly, or a material service issue that substantially prevented use of the paid service.</p>
      <p>Submitting a request does not guarantee approval. The review may consider the timing and circumstances of the charge, account activity, the nature and duration of any service issue, prior refunds, and information reasonably needed to prevent fraud or abuse. Nothing in this policy limits any refund, cancellation, or other right that cannot be excluded under applicable consumer law.</p>

      <h2>Duplicate or accidental charges</h2>
      <p>If you believe you were charged more than once for the same subscription period or that a charge was made accidentally, contact OperationOS promptly. Include the account email, transaction or receipt reference, charge date, and amount. Do not send full payment card details. Confirmed duplicate charges and eligible accidental charges may be refunded following review.</p>

      <h2>Technical or service issues</h2>
      <p>If a material technical or service issue substantially prevents you from using a paid RecruitOS subscription, contact OperationOS while the issue is occurring or as soon as reasonably possible. Provide enough detail to identify the account, affected feature, timing, and impact. OperationOS may first attempt to diagnose or resolve the issue. A refund may be considered when the issue is verified and a refund is appropriate in the circumstances, but temporary interruptions, third-party outages, device or network problems, and issues outside OperationOS&apos;s reasonable control do not automatically qualify.</p>

      <h2>How to request a refund</h2>
      <p>Submit a request through the <Link href="/contact">OperationOS contact page</Link>, email <a href="mailto:operationos.org@gmail.com">operationos.org@gmail.com</a>, use the support link in your Paddle receipt or billing page, or visit <a href="https://paddle.net">Paddle.net</a>. When contacting OperationOS by email, use the subject line &quot;Refund request&quot; and include:</p>
      <ul>
        <li>The email address associated with the RecruitOS subscription.</li>
        <li>The Paddle transaction or receipt reference, if available.</li>
        <li>The date and amount of the charge.</li>
        <li>A concise explanation of the reason for the request.</li>
      </ul>
      <p>OperationOS or Paddle may ask for additional information reasonably needed to locate the transaction, review the request, or protect the account. Please do not include passwords or full payment card details.</p>

      <h2>Payment processing and Paddle</h2>
      <p>Paddle processes payments for paid RecruitOS subscriptions as Merchant of Record. Paddle handles billing communications, taxes, receipts, payment methods, and refunds. OperationOS may review the product-related circumstances of a request and, where appropriate, ask Paddle to issue a refund. Eligibility and processing remain subject to the <a href="https://www.paddle.com/legal/buyer-terms">Paddle Buyer Terms</a>, <a href="https://www.paddle.com/legal/refund-policy">Paddle Refund Policy</a>, the rules of the original payment method, and applicable law.</p>
      <p>If a refund is approved, Paddle will process it using the original payment method where possible. The time required for the funds to appear may also depend on the payment network and the customer&apos;s financial institution. OperationOS cannot guarantee a specific date on which the funds will appear.</p>

      <h2>Policy updates</h2>
      <p>OperationOS may revise this policy as RecruitOS, its billing practices, or legal requirements change. The effective date at the top of this page identifies the current published version. Changes apply prospectively unless applicable law requires otherwise.</p>

      <h2>Contact</h2>
      <p>Questions about cancellations, billing, or refunds can be sent through the <Link href="/contact">OperationOS contact page</Link> or directly to <a href="mailto:operationos.org@gmail.com">operationos.org@gmail.com</a>.</p>
    </LegalDocument>
  );
}
