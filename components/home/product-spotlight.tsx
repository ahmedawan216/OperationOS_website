import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";

import { featuredProduct } from "@/lib/homepage-data";
import { Section } from "@/components/layout/section";
import { TrackedLink } from "@/components/home/tracked-link";

export function ProductSpotlight() {
  return (
    <Section id="products" className="bg-bg-secondary">
      <div className="grid items-end gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-14">
        <div className="pb-2">
          <p className="type-meta font-mono font-medium uppercase text-accent">Available product</p>
          <p className="mt-5 font-display text-xl font-semibold text-ink">{featuredProduct.name}</p>
          <h2 className="type-h2 mt-3 font-display font-semibold text-ink">
            Recruiting work, organized around better decisions.
          </h2>
          <p className="mt-5 text-base leading-7 text-ink-dim">{featuredProduct.description}</p>
          <p className="mt-5 text-sm font-medium text-ink">For {featuredProduct.audience.toLowerCase()}.</p>
          <ul className="mt-7 space-y-3">
            {featuredProduct.outcomes.map((outcome) => (
              <li key={outcome} className="flex gap-3 text-sm leading-6 text-ink-dim">
                <Check className="mt-1 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                {outcome}
              </li>
            ))}
          </ul>
          <TrackedLink href={featuredProduct.href} eventName="recruitos_cta_clicked" className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent underline-offset-4 hover:text-accent-hover hover:underline">
            Explore RecruitOS
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </TrackedLink>
        </div>

        <figure>
          <div className="overflow-hidden rounded-lg border border-border-strong bg-[#08090c] shadow-lift">
            <Image src="/images/recruitos/RecruitOS_workspace_preview.png" alt="RecruitOS job workspace showing requirements, a candidate pipeline, match score, and recruiting status" width={1642} height={1382} sizes="(max-width: 1023px) 100vw, 62vw" className="h-auto w-full" />
          </div>
          <figcaption className="mt-3 text-sm text-ink-dim">
            A real RecruitOS job workspace with requirements, candidate status, and review actions in one place.
          </figcaption>
        </figure>
      </div>
    </Section>
  );
}
