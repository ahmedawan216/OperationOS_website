import type { Metadata } from "next";

import { GuidelinesArticle } from "@/components/guidelines/guidelines-article";
import { GuidelinesCallout } from "@/components/guidelines/guidelines-callout";

export const metadata: Metadata = {
  title: "Privacy & Security | Guidelines",
  description: "Practical guidance for handling sensitive information, credentials, and software-assisted recommendations in OperationOS products.",
  alternates: { canonical: "/guidelines/privacy-security" },
};

export default function PrivacySecurityPage() {
  return (
    <GuidelinesArticle
      path="/guidelines/privacy-security"
      eyebrow="Privacy & security"
      title="Handle sensitive information with purpose and care."
      description="Use only the information a workflow needs, protect access credentials, and review software-assisted recommendations before taking consequential action."
    >
      <GuidelinesCallout label="Important">This page provides practical product-use guidance. It is not a formal privacy policy, security statement, or compliance certification.</GuidelinesCallout>

      <h2>Use only information needed for the workflow</h2>
      <p>Limit the information you provide to what is relevant for the task. More data does not automatically produce a better decision, and unnecessary information creates additional handling responsibility.</p>

      <h2>Treat candidate information as sensitive</h2>
      <p>Resumes and candidate records can contain personal and professional information. Use them only for the intended recruiting workflow, share them only with people who need them for that work, and avoid copying them into unrelated tools or messages.</p>

      <h2>Keep credentials out of shared content</h2>
      <p>Do not place passwords, access tokens, payment credentials, or private account details in candidate information, feedback, or access-request fields. Use official product interfaces and approved account channels.</p>

      <h2>Review recommendations before acting</h2>
      <p>Software-assisted analysis can organize information and surface patterns, but it may miss context or interpret it imperfectly. Review the source information and supporting reasoning before deciding what happens next.</p>
      <GuidelinesCallout label="Decision">People remain responsible for consequential decisions. A recommendation should inform judgment, not replace it.</GuidelinesCallout>

      <h2>Keep trust claims tied to verified facts</h2>
      <p>Do not infer a certification, guarantee, monitoring practice, retention rule, or data-location commitment from the product interface. OperationOS security and privacy claims should remain limited to capabilities and practices that are explicitly supported through official materials.</p>

      <h2>Pause when the safe path is unclear</h2>
      <p>If you are unsure whether information belongs in a workflow, stop before adding it. Confirm the purpose, the people who need access, and the official interface intended for the task.</p>
    </GuidelinesArticle>
  );
}
