import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TrackedLink } from "@/components/home/tracked-link";

export function CompanyClosing() {
  return (
    <section className="section-space">
      <div className="container-standard">
        <div className="grid items-end gap-8 border-t border-border pt-12 lg:grid-cols-[1fr_auto] lg:gap-16 lg:pt-16">
          <div className="max-w-3xl">
            <p className="type-meta font-mono font-medium uppercase text-accent">OperationOS</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-ink">
              Important work deserves a clearer system.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-ink-dim">
              We build focused products that reduce routine effort while keeping context, judgment, and control close to the people doing the work.
            </p>
          </div>
          <Button asChild>
            <TrackedLink href="/recruitos" eventName="recruitos_cta_clicked" eventProperties={{ product: "recruitos", location: "homepage", action: "explore_product" }}>
              Explore RecruitOS
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </TrackedLink>
          </Button>
        </div>
      </div>
    </section>
  );
}
