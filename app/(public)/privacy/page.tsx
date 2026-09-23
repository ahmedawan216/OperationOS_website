import Link from "next/link";

import { LegalDocument } from "@/components/legal/legal-document";
import { createPageMetadata } from "@/lib/page-metadata";

export const metadata = createPageMetadata(
  "Privacy Policy",
  "Read the baseline OperationOS Privacy Policy for the public website, including historical access requests, feedback, contact, and analytics data handling.",
  "/privacy",
);

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Privacy Policy"
      title="How the current public website handles information."
      description="This baseline policy describes information processed through the OperationOS website, including historical RecruitOS access requests, feedback, direct email, and website analytics."
    >
      <h2>Information you choose to provide</h2>
      <p>OperationOS previously offered a public RecruitOS waitlist that collected a name and work email address to record an access request, send a confirmation, and provide relevant access or product updates. That public form is no longer active, but information already submitted may remain in historical records subject to the retention practices described below.</p>
      <p>The website feedback form collects the feedback message you submit. You may also provide a name and email address, but those two fields are optional. If you email OperationOS directly, the message and contact details supplied by your email service are received as part of that correspondence.</p>

      <h2>Information processed through website operation</h2>
      <p>The website uses PostHog, Vercel Analytics, and Vercel Speed Insights to understand page use and website performance. Depending on those services and your browser, this processing may involve page interactions, browser or device information, network information such as an IP address, and identifiers stored through browser technologies.</p>
      <p>When a landing-page URL includes standard UTM campaign parameters, the website sanitizes the supported campaign values and keeps them in session storage for the current browser session. Those values may be attached to analytics events to help OperationOS understand campaign performance. Names, email addresses, and feedback messages submitted through website forms are not intentionally included as analytics event properties.</p>
      <p>OperationOS does not describe this information as anonymous and does not promise that analytics services use no cookies or local storage. Browser controls and privacy tools may let you limit some storage or analytics behavior.</p>

      <h2>How information is used</h2>
      <ul>
        <li>Maintain and respond to historical RecruitOS access records where relevant.</li>
        <li>Store, review, and respond to website feedback or direct correspondence.</li>
        <li>Understand website usage, reliability, and performance.</li>
        <li>Protect the website, investigate misuse, and maintain its operation.</li>
      </ul>

      <h2>Service providers</h2>
      <p>OperationOS relies on service providers for parts of the website workflow. Supabase supports feedback storage and retains historical waitlist records. PostHog supports product and website analytics, and Vercel Analytics and Speed Insights support website usage and performance measurement. Providers used for earlier submissions may retain associated records according to applicable retention and service practices. These providers may process information according to their own terms and privacy practices.</p>

      <h2>How long information is kept</h2>
      <p>Information is retained only as long as reasonably necessary for the purpose for which it was collected, including operational, security, recordkeeping, and legal needs. Exact periods can vary by information type and service provider. Removal from active systems may not immediately remove information from backups or records that must be preserved for legitimate reasons.</p>

      <h2>Your choices and requests</h2>
      <p>You can choose not to submit feedback or email. You can also use browser settings or privacy controls to manage some website storage and analytics behavior. To ask about information you provided, including a historical waitlist submission, contact OperationOS at <a href="mailto:operationos.org@gmail.com">operationos.org@gmail.com</a>. A request may require enough information to identify the relevant submission and may be subject to applicable operational or legal limits.</p>

      <h2>Security</h2>
      <p>OperationOS uses technical and organizational measures intended to protect information handled through the website. No website or transmission method can guarantee complete security. Do not submit passwords, payment credentials, or unnecessary sensitive information through the feedback form or email.</p>

      <h2>Children</h2>
      <p>The public website is intended for people evaluating software for operational or recruiting work, not for children. If you believe a child has submitted personal information through the website, contact OperationOS so the situation can be reviewed.</p>

      <h2>Changes to this policy</h2>
      <p>This policy may be revised when website behavior or public product access changes. The effective date at the top of the page identifies the current published version.</p>

      <h2>Contact</h2>
      <p>Questions about this policy or the website&apos;s handling of information can be sent through the <Link href="/contact">OperationOS contact page</Link> or directly to <a href="mailto:operationos.org@gmail.com">operationos.org@gmail.com</a>.</p>
    </LegalDocument>
  );
}
