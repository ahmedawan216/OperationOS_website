import { agentSlots } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Section } from "@/components/layout/section";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";

/**
 * The "ecosystem" section — a rack of 8 agent slots. RecruitOS is live
 * today; the rest are shown as training, establishing OperationOS as a
 * platform rather than a single point product.
 */
export function AgentRack() {
  return (
    <Section id="ecosystem">
      <Reveal>
        <SectionHeading
          eyebrow="The ecosystem"
          title="One employee is live. Seven more are training."
          description="RecruitOS is the first agent running on the OS. Every function below is next."
        />
      </Reveal>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {agentSlots.map((slot, i) => (
          <Reveal
            key={slot.id}
            delay={Math.min(i, 4) * 0.06}
            as="li"
            className={cn(
              "flex h-full flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-5 transition-colors duration-300 ease-out-expo",
              slot.status === "online" && "border-accent-dim bg-accent-soft"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10.5px] text-ink-dim">
                {slot.id}
              </span>
              <span
                className={cn(
                  "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em]",
                  slot.status === "online" ? "text-success" : "text-ink-dim"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    slot.status === "online"
                      ? "motion-safe:animate-pulse-dot bg-success"
                      : "bg-ink-dim"
                  )}
                />
                {slot.status === "online" ? "Online" : "Training"}
              </span>
            </div>
            <div>
              <div className="mb-1 font-display text-[14.5px] font-semibold text-ink">
                {slot.name}
              </div>
              <p className="text-[12px] leading-[1.5] text-ink-dim">
                {slot.role}
              </p>
            </div>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
