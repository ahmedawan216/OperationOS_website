import { operationalProblems, workflowSteps } from "@/lib/homepage-data";
import { Section } from "@/components/layout/section";

export function WorkflowSection() {
  return (
    <>
      <Section id="approach" className="border-y border-border bg-surface">
        <div className="max-w-2xl">
          <h2 className="type-h2 font-display font-semibold text-ink">
            A shorter path from setup to completed work.
          </h2>
          <p className="mt-5 text-base leading-7 text-ink-dim">
            OperationOS products are organized around a real workflow, not a collection of disconnected AI tools.
          </p>
        </div>
        <ol className="mt-12 grid border-t border-border sm:grid-cols-2 lg:grid-cols-4">
          {workflowSteps.map((step) => (
            <li key={step.number} className="border-b border-border py-7 sm:px-6 sm:first:pl-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
              <span className="font-mono text-xs font-medium text-accent">{step.number}</span>
              <h3 className="mt-7 font-display text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-ink-dim">{step.description}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:gap-20">
          <h2 className="type-h2 max-w-2xl font-display font-semibold text-ink">
            Built for work that is repetitive, structured, and still consequential.
          </h2>
          <div>
            <p className="text-base leading-7 text-ink-dim">
              The best opportunities for useful automation are not vague. They are workflows where the same careful steps happen repeatedly and people still need reliable context before acting.
            </p>
            <ul className="mt-7 divide-y divide-border border-y border-border">
              {operationalProblems.map((problem) => (
                <li key={problem} className="py-4 text-sm font-medium leading-6 text-ink">{problem}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </>
  );
}
