import type { Metadata } from "next";

import { GuidelinesArticle } from "@/components/guidelines/guidelines-article";
import { GuidelinesCallout } from "@/components/guidelines/guidelines-callout";

export const metadata: Metadata = {
  title: "RecruitOS Guide | Guidelines",
  description: "Learn how to understand the RecruitOS candidate-review workflow, its analysis, and the decisions that remain with recruiters.",
  alternates: { canonical: "/guidelines/recruitos" },
};

export default function RecruitOSGuidelinesPage() {
  return (
    <GuidelinesArticle
      path="/guidelines/recruitos"
      eyebrow="RecruitOS"
      title="Use each candidate review to reach a considered next action."
      description="RecruitOS keeps role requirements, candidate information, analysis, and progress in one review workflow. The software organizes context and provides a recommendation; the hiring team decides what happens next."
    >
      <h2>Before you begin, know the role</h2>
      <p>A useful candidate review starts with a defined role. The requirements provide the context for evaluating a candidate&apos;s experience and skills. If the role context is incomplete or unclear, the resulting analysis should be treated with additional care.</p>

      <h2>Start with the role requirements</h2>
      <p>Role requirements describe what the hiring team is looking for. RecruitOS uses that context to keep a candidate review connected to the active job rather than producing a general assessment of the person.</p>
      <p>Review the role context before interpreting any recommendation. A result is only useful in relation to the requirements it was considered against.</p>

      <h2>Add the candidate information to the correct job</h2>
      <p>Bring the candidate&apos;s resume into the workspace for the relevant role. Keeping the candidate and job connected helps prevent requirements, review notes, and status from becoming separated.</p>
      <GuidelinesCallout label="Important">Candidate information is sensitive. Use only the information needed for the review and handle it through official product interfaces.</GuidelinesCallout>

      <h2>Read the analysis as structured context</h2>
      <p>The analysis can surface relevant experience, matching skills, gaps, concerns, and an overall recommendation. Read these parts together. A match indicator or recommendation is not a complete hiring decision on its own.</p>
      <ul>
        <li>Check whether the experience described is relevant to the role.</li>
        <li>Review matching skills and gaps against the stated requirements.</li>
        <li>Consider concerns as prompts for closer review, not automatic conclusions.</li>
        <li>Use the supporting summary to understand how the recommendation was reached.</li>
      </ul>

      <h2>Examine the recommendation before acting</h2>
      <p>Recommendation reasoning makes the result inspectable. Compare it with the underlying candidate information and the role. If the reasoning overlooks context, gives too much weight to one detail, or does not support the result, rely on recruiter judgment.</p>
      <GuidelinesCallout label="Decision">RecruitOS assists with review. It does not make the final hiring decision or autonomously reject a candidate.</GuidelinesCallout>

      <h2>Choose the next action and keep status visible</h2>
      <p>Once the review is understood, update the candidate&apos;s status and decide the next action. Visible progress helps the team know which candidates need attention without moving the decision into a disconnected tracking step.</p>

      <h2>Use human judgment whenever context is consequential</h2>
      <p>A resume and a role description cannot capture every relevant circumstance. Recruiters remain responsible for interpreting the information, checking assumptions, and deciding whether a candidate should move forward. RecruitOS supports candidate review and organization; it is not presented as a complete applicant tracking system.</p>
    </GuidelinesArticle>
  );
}
