import Image from "next/image";
import { Section } from "@/components/layout/section";

export function ProductExperience() {
  return (
    <Section className="bg-ink text-white">
      <div className="grid items-center gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
        <div>
          <p className="type-meta font-mono font-medium uppercase text-[#9aabff]">The product experience</p>
          <h2 className="type-h2 mt-5 font-display font-semibold text-white">
            See the status. Understand the recommendation. Decide what happens next.
          </h2>
          <p className="mt-5 text-base leading-7 text-white/70">
            RecruitOS shows how a product can reduce repetitive review without hiding the information a person needs to make the final call.
          </p>
          <dl className="mt-8 space-y-5 border-l border-white/20 pl-6">
            <div><dt className="font-semibold text-white">Visible progress</dt><dd className="mt-1 text-sm leading-6 text-white/65">Status stays connected to the work instead of disappearing into a background process.</dd></div>
            <div><dt className="font-semibold text-white">Readable reasoning</dt><dd className="mt-1 text-sm leading-6 text-white/65">Recommendations include the context needed for a closer review.</dd></div>
            <div><dt className="font-semibold text-white">Human action</dt><dd className="mt-1 text-sm leading-6 text-white/65">The person using the product controls the next step.</dd></div>
          </dl>
        </div>
        <figure>
          <div className="overflow-hidden rounded-lg border border-white/15 bg-[#08090c]">
            <Image src="/images/recruitos/Candidate_analysis_2.png" alt="RecruitOS candidate analysis showing a recommendation, match score, supporting summary, skills, concerns, and reasoning" width={775} height={1230} sizes="(max-width: 1023px) 100vw, 58vw" className="h-auto w-full" />
          </div>
          <figcaption className="mt-3 text-sm text-white/60">A real RecruitOS candidate analysis with the result and supporting reasoning visible together.</figcaption>
        </figure>
      </div>
    </Section>
  );
}
