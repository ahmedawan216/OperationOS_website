import type { Metadata } from "next";

import { GuidelinesArticle } from "@/components/guidelines/guidelines-article";

export const metadata: Metadata = {
  title: "Product Concepts | Guidelines",
  description: "Understand the practical concepts that shape OperationOS products, including context, status, next actions, and human decisions.",
  alternates: { canonical: "/guidelines/concepts" },
};

const concepts = [
  { term: "Focused product", meaning: "A product organized around one recognizable operational problem rather than a collection of unrelated tools.", importance: "A clear boundary makes the workflow easier to understand and keeps features tied to real work.", approach: "Begin with the job the product is designed to support, then learn the steps inside that boundary." },
  { term: "Workflow", meaning: "The connected sequence that moves work from its starting context to a useful next action.", importance: "A workflow keeps information and progress connected instead of scattering them across separate tools.", approach: "Understand where the work starts, what each step adds, and which person controls the outcome." },
  { term: "Context", meaning: "The information that gives a recommendation or action its meaning, such as a role and its requirements.", importance: "A result without context can look precise while being difficult to judge responsibly.", approach: "Check the source information and active task before relying on an output." },
  { term: "Recommendation", meaning: "A software-assisted interpretation intended to help a person review information and decide what to examine next.", importance: "Recommendations can reduce repetitive review, but they cannot carry the full responsibility for a consequential decision.", approach: "Read the supporting reasons, compare them with the source context, and use your own judgment." },
  { term: "Status and next action", meaning: "Status shows where work currently stands. The next action makes the following responsible step visible.", importance: "Together they reduce uncertainty and prevent completed analysis from becoming disconnected from action.", approach: "Keep status current and treat the next action as a prompt for a person, not an automatic outcome." },
  { term: "Human decision", meaning: "The point where a responsible person interprets context and chooses what happens next.", importance: "Operational software can assist and accelerate work while accountability remains with the people using it.", approach: "Pause when information is incomplete, review the reasoning, and make consequential choices deliberately." },
  { term: "Guidance when it becomes useful", meaning: "First-time users see enough explanation for the next step, while more detail remains available when needed.", importance: "This keeps a product easy to learn without forcing experienced users through repeated instruction.", approach: "Use the visible prompt to continue, then return to Guidelines or supporting detail when the situation is less familiar." },
] as const;

export default function ConceptsPage() {
  return (
    <GuidelinesArticle
      path="/guidelines/concepts"
      eyebrow="Concepts"
      title="Shared ideas keep different workflows understandable."
      description="OperationOS products use a small set of durable concepts to keep work clear, recommendations inspectable, and important decisions under human control."
    >
      <div className="divide-y divide-border border-y border-border">
        {concepts.map((concept) => (
          <section key={concept.term} className="py-8 first:pt-6 last:pb-6">
            <h2 className="!mt-0 !text-2xl">{concept.term}</h2>
            <dl className="mt-5 space-y-4">
              <div><dt className="font-semibold text-ink">What it means</dt><dd className="mt-1">{concept.meaning}</dd></div>
              <div><dt className="font-semibold text-ink">Why it matters</dt><dd className="mt-1">{concept.importance}</dd></div>
              <div><dt className="font-semibold text-ink">How to think about it</dt><dd className="mt-1">{concept.approach}</dd></div>
            </dl>
          </section>
        ))}
      </div>
    </GuidelinesArticle>
  );
}
