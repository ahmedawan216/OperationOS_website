"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

/**
 * Root error boundary. Next.js mounts this in place of the page segment
 * whenever a rendering error is thrown beneath it, keeping the rest of
 * the app (and, importantly, the header/footer chrome outside `<main>`)
 * intact rather than showing a bare browser error page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replace with real error reporting (Sentry, etc.) before launch.
    console.error(error);
  }, [error]);

  return (
    <section className="px-5 py-32 text-center sm:px-8">
      <div className="mx-auto max-w-[480px]">
        <Eyebrow className="mb-5">Something went wrong</Eyebrow>
        <h1 className="mb-4 font-display text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.025em] text-ink">
          We hit a snag loading this page.
        </h1>
        <p className="mb-9 text-[15.5px] text-ink-dim">
          Try again, or head back to the homepage if the problem persists.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button type="button" size="default" onClick={reset}>
            Try again
          </Button>
          <Button asChild variant="ghost" size="default">
            <Link href="/">Back to homepage</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
