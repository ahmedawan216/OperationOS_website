import { Check } from "lucide-react";

import { recruitOsHighlights } from "@/lib/data";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { DashboardPreview } from "@/components/ui/dashboard-preview";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";

export function RecruitOsSection() {
  return (
    <Section id="recruitos">
      <div className="grid grid-cols-1 items-center gap-14 md:grid-cols-2 md:gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <Reveal>
          <div>
            <Eyebrow>Employee 001</Eyebrow>
            <h2 className="my-4 font-display text-[clamp(28px,3.6vw,40px)] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
              RecruitOS hires like your best recruiter, at full speed.
            </h2>
            <p className="mb-7 text-[15.5px] leading-[1.6] text-ink-dim">
              It reads every resume the way a great recruiter would — then
              tells you exactly why, so you never have to take a ranking on
              faith.
            </p>

            <ul className="mb-9 flex flex-col gap-3.5">
              {recruitOsHighlights.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                    aria-hidden="true"
                  />
                  <span className="text-[14px] leading-[1.55] text-ink-dim">
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>

            <Button asChild size="default">
              <a href="#waitlist">Get early access</a>
            </Button>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <DashboardPreview />
        </Reveal>
      </div>
    </Section>
  );
}
