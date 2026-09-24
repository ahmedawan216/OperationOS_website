import Link from "next/link";

import { createPageMetadata } from "@/lib/page-metadata";

export const metadata = createPageMetadata(
  "OperationOS Blog",
  "Practical articles about recruiting workflows, responsible AI-assisted review, and the products OperationOS is building.",
  "/blog",
);

export default function BlogPage() {
  return (
    <section aria-labelledby="blog-title" className="container-standard pb-24 pt-[calc(72px+4rem)] sm:pb-28 sm:pt-[calc(72px+5rem)]">
      <h1 id="blog-title" className="type-h1 font-display font-semibold text-ink">
        OperationOS Blog
      </h1>

      <p className="type-body-lg mt-6 max-w-3xl text-ink-dim">
        Practical articles about recruiting workflows, responsible AI-assisted review,
        and the products OperationOS is building.
      </p>

      <div className="mt-16 rounded-xl border p-8 transition hover:border-accent">
        <p className="text-sm text-ink-faint">
          August 6, 2026 • 12 min read
        </p>

        <h2 className="mt-3 text-3xl font-semibold">
          AI Resume Screening: How It Works (Complete Guide for Recruiters in 2026)
        </h2>

        <p className="mt-4 text-ink-dim">
          Learn how AI resume screening works, how it differs from
          traditional ATS software, and how RecruitOS helps recruiters
          evaluate candidates faster while keeping humans in control.
        </p>

        <Link
          href="/blog/ai-resume-screening"
          className="mt-6 inline-flex text-accent hover:underline"
        >
          Read article →
        </Link>
      </div>
    </section>
  );
}
