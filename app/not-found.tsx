import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata: Metadata = {
  title: "Page not found",
};

/**
 * Branded 404. Next.js renders this automatically for any unmatched route
 * (and for explicit `notFound()` calls), inside the root layout — so the
 * header/footer still surround it.
 */
export default function NotFound() {
  return (
    <section className="px-5 py-32 text-center sm:px-8">
      <div className="mx-auto max-w-[480px]">
        <Eyebrow className="mb-5">404</Eyebrow>
        <h1 className="mb-4 font-display text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.025em] text-ink">
          This page hasn&rsquo;t been hired yet.
        </h1>
        <p className="mb-9 text-[15.5px] text-ink-dim">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
          Let&rsquo;s get you back to the homepage.
        </p>
        <Button asChild size="default">
          <Link href="/">Back to homepage</Link>
        </Button>
      </div>
    </section>
  );
}
