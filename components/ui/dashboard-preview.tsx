import { candidateReasons, candidates } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/ui/eyebrow";

/**
 * A static mock of the RecruitOS product UI: a ranked candidate list on
 * the left, and a "why this candidate" reasoning panel on the right for
 * whichever candidate is selected. Mirrors `.mock-app` in the prototype.
 *
 * This is presentational sample data for marketing purposes, not a live
 * product view — labelled as such for screen reader users via aria-label.
 */
export function DashboardPreview() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-border bg-surface shadow-panel"
      role="img"
      aria-label="Preview of the RecruitOS dashboard, showing a ranked list of candidates for a Senior Backend Engineer role and the reasoning behind the top-ranked candidate"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-border-strong" />
        <span className="h-2 w-2 rounded-full bg-border-strong" />
        <span className="h-2 w-2 rounded-full bg-border-strong" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_1fr]">
        <ul className="border-b border-border p-2 sm:border-b-0 sm:border-r">
          {candidates.map((candidate) => (
            <li
              key={candidate.id}
              className={cn(
                "mb-0.5 flex items-center justify-between gap-2.5 rounded-lg px-3 py-[11px] transition-colors duration-200 ease-out-expo",
                candidate.selected && "bg-surface-2"
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border border-border bg-surface-2 font-mono text-[10.5px] text-ink-dim",
                    candidate.selected &&
                      "border-accent-dim bg-accent-soft text-accent"
                  )}
                  aria-hidden="true"
                >
                  {candidate.initials}
                </span>
                <div>
                  <div className="text-[12.5px] text-ink">{candidate.name}</div>
                  <div className="text-[10.5px] text-ink-dim">{candidate.role}</div>
                </div>
              </div>
              <span
                className={cn(
                  "font-mono text-[11px] text-ink-dim",
                  candidate.selected && "text-success"
                )}
              >
                {candidate.score}%
              </span>
            </li>
          ))}
        </ul>

        <div className="p-[18px]">
          <Eyebrow className="mb-3.5 text-[10px]">Why this candidate</Eyebrow>
          <dl>
            {candidateReasons.map((reason, i) => (
              <div
                key={reason.id}
                className={cn(
                  "py-2.5 text-xs leading-[1.55] text-ink-dim",
                  i !== candidateReasons.length - 1 &&
                    "border-b border-border"
                )}
              >
                <dt className="inline font-medium text-ink">{reason.label} </dt>
                <dd className="inline">{reason.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
