import type { Metadata } from "next";

import { GuidelinesArticle } from "@/components/guidelines/guidelines-article";
import { GuidelinesCallout } from "@/components/guidelines/guidelines-callout";

export const metadata: Metadata = {
  title: "Getting Started | Guidelines",
  description: "Understand the OperationOS product model, learning philosophy, and path from product discovery to everyday use.",
  alternates: { canonical: "/guidelines/getting-started" },
};

export default function GettingStartedPage() {
  return (
    <GuidelinesArticle
      path="/guidelines/getting-started"
      eyebrow="Getting started"
      title="Know where each part of OperationOS fits before you begin."
      description="OperationOS is the company. It builds focused products for specific operational workflows, and RecruitOS is its first publicly available product."
    >
      <h2>One company, focused products, and a shared reference</h2>
      <p><strong>OperationOS</strong> designs and builds software products for structured, repetitive work where context and judgment still matter. Each product focuses on a particular workflow instead of combining unrelated tools into one large system.</p>
      <p><strong>RecruitOS</strong> is the first publicly available OperationOS product. It supports candidate review by keeping the role, candidate information, analysis, and next action connected.</p>
      <p><strong>Guidelines</strong> explain how the products are intended to work and define ideas that apply across the system. They are a shared reference, not a separate product.</p>

      <h2>Discovery and work happen in different places</h2>
      <p>The public OperationOS website introduces the company, explains RecruitOS, and links to the independent RecruitOS application. Product work takes place in RecruitOS, not on the OperationOS marketing website.</p>
      <GuidelinesCallout label="Note">Create an account or sign in at RecruitOS to use the product. The OperationOS website does not present a general account dashboard.</GuidelinesCallout>

      <h2>Learn the path, then move through it quickly</h2>
      <p>The product philosophy is simple: <strong>easy to learn, fast after you have learned it.</strong> A first-time user should see enough explanation to understand the next step. An experienced user should be able to work without repeatedly clearing beginner guidance.</p>
      <ol>
        <li><strong>Discover:</strong> understand what OperationOS builds.</li>
        <li><strong>Understand:</strong> identify the workflow a product supports.</li>
        <li><strong>Explore a product:</strong> review its purpose, boundaries, and public experience.</li>
        <li><strong>Learn the workflow:</strong> understand the steps and information involved.</li>
        <li><strong>Create an account or sign in:</strong> continue from OperationOS to the RecruitOS application.</li>
        <li><strong>Use the product:</strong> complete the real work inside its application.</li>
        <li><strong>Return to Guidelines:</strong> revisit explanations when a step or concept becomes unfamiliar.</li>
      </ol>

      <h2>Choose the next reference based on your task</h2>
      <p>Continue to the RecruitOS guide for the candidate-review workflow. Use Concepts for definitions shared across OperationOS products. Account & billing and Privacy & security explain the current public boundaries around access and responsible product use.</p>
    </GuidelinesArticle>
  );
}
