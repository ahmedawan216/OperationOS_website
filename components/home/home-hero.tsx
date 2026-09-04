import { ArrowDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TrackedLink } from "@/components/home/tracked-link";

export function HomeHero() {
  return (
    <section className="relative overflow-hidden border-b border-border pt-[72px]">
      <div className="container-standard flex min-h-[calc(100svh-72px)] items-center py-20 lg:py-24">
        <div className="max-w-[860px]">
          <p className="type-meta mb-6 font-mono font-medium uppercase text-accent">
            Focused software for operational work
          </p>
          <h1 className="type-display max-w-[760px] font-display font-semibold text-ink">
            Software that makes operational work easier to run.
          </h1>
          <p className="type-body-lg mt-7 max-w-[680px] text-ink-dim">
            OperationOS builds focused products for complex, repetitive work. Each product keeps workflows clear, speeds up routine steps, and leaves important decisions with the people responsible for them.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <TrackedLink href="#products" eventName="recruitos_cta_clicked" eventProperties={{ product: "recruitos", location: "homepage", action: "explore_product" }}>
                Explore products
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </TrackedLink>
            </Button>
            <Button asChild variant="secondary">
              <a href="#approach">See how it works</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
