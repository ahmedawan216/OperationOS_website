import Link from "next/link";

import { LegalDocument } from "@/components/legal/legal-document";
import { createPageMetadata } from "@/lib/page-metadata";

export const metadata = createPageMetadata(
  "Terms of Use",
  "Read the baseline Terms of Use for the OperationOS public website, RecruitOS information, links, and feedback features.",
  "/terms",
);

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Terms of Use"
      title="Terms for using the current OperationOS public website."
      description="These baseline terms apply to this informational website, its links to RecruitOS, and its feedback features. They are not RecruitOS subscription or paid-product terms."
    >
      <h2>Acceptance of these terms</h2>
      <p>By accessing or using the OperationOS public website, you agree to these Terms of Use. If you do not agree, do not use the website or submit information through its forms.</p>

      <h2>Purpose of the website</h2>
      <p>This website provides information about OperationOS, RecruitOS, public Guidelines, pricing and access status, and related company topics. Website content may explain current product direction or access without representing that every described capability is available to every visitor.</p>

      <h2>RecruitOS access information</h2>
      <p>RecruitOS is available through its independent application. Links on this website may take you to RecruitOS to create an account or sign in. These website terms do not establish a trial, paid subscription, purchase, service commitment, or particular commercial terms for RecruitOS.</p>
      <p>No public self-service checkout, billing controls, or subscription management is offered through this website. If commercial terms are presented later, those terms should be reviewed in the context where the relevant product or service is offered.</p>

      <h2>Acceptable use</h2>
      <p>You may use the website for lawful informational and communication purposes. You must not attempt to:</p>
      <ul>
        <li>Disrupt, overload, damage, or interfere with the website or its supporting systems.</li>
        <li>Bypass access controls or probe systems without authorization.</li>
        <li>Submit malicious code, deceptive content, or information you are not permitted to provide.</li>
        <li>Use automated methods in a way that materially harms the website or other visitors.</li>
        <li>Misrepresent your relationship with OperationOS or misuse its names, content, or product identity.</li>
      </ul>

      <h2>Website content and intellectual property</h2>
      <p>The website&apos;s design, text, graphics, product names, and other content are owned by OperationOS or used with permission, except where otherwise indicated. You may view the public website for its intended purpose. No broader right to reproduce, distribute, modify, or commercially exploit its content is granted by these terms.</p>

      <h2>Information you submit</h2>
      <p>You are responsible for information submitted through the feedback form or email. Do not provide information that is unlawful, harmful, misleading, or that infringes another person&apos;s rights. Feedback may be used to understand and improve the website or products, without an obligation to adopt a suggestion.</p>

      <h2>Third-party services and links</h2>
      <p>The website relies on third-party services for hosting-related functions, analytics, data storage, and email delivery, and may link to third-party websites. OperationOS does not control every third-party service or external page. Their own terms and privacy practices may apply.</p>

      <h2>Availability and changes</h2>
      <p>OperationOS may change, suspend, or remove website content or public features as the website and products develop. The website may occasionally be unavailable or contain errors. No particular availability level or response time is promised by these terms.</p>

      <h2>Disclaimers</h2>
      <p>The public website and its content are provided on an as-available basis for general information. OperationOS does not promise that the website will always be uninterrupted, error-free, or suitable for a particular purpose. Product descriptions and Guidelines do not replace the professional judgment required for consequential decisions, including hiring decisions.</p>

      <h2>Limits of responsibility</h2>
      <p>To the extent permitted by applicable law, OperationOS is not responsible for indirect or consequential loss arising from use of, or inability to use, this public website. Nothing in these terms excludes responsibility that cannot lawfully be excluded.</p>

      <h2>Changes to these terms</h2>
      <p>These terms may be revised as the public website or access model changes. The effective date at the top of the page identifies the current published version. Continued use after a revision means the revised terms apply to subsequent website use.</p>

      <h2>Contact</h2>
      <p>Questions about these terms can be sent through the <Link href="/contact">OperationOS contact page</Link> or directly to <a href="mailto:operationos.org@gmail.com">operationos.org@gmail.com</a>.</p>
    </LegalDocument>
  );
}
