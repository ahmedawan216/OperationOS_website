import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TrackedLink } from "@/components/home/tracked-link";

export function HomeHero() {
  return (
    <section className="relative overflow-hidden border-b border-border pt-[72px]">
      <div className="container-standard grid min-h-[calc(100svh-72px)] items-center gap-12 py-20 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-24">
        <div className="max-w-[780px]">
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
              <TrackedLink href="#products" eventName="hero_cta_clicked">
                Explore products
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </TrackedLink>
            </Button>
            <Button asChild variant="secondary">
              <a href="#approach">See how it works</a>
            </Button>
          </div>
        </div>

        <div className="border-l border-border pl-7 lg:pl-9">
          <p className="text-sm font-semibold text-ink">OperationOS is the company.</p>
          <p className="mt-3 text-sm leading-6 text-ink-dim">
            RecruitOS is its first public product, built for clearer candidate review and more organized hiring workflows.
          </p>
          <Link className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent underline-offset-4 hover:text-accent-hover hover:underline" href="/recruitos">
            Meet RecruitOS
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
