import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "OperationOS Blog",
  description:
    "Insights on AI recruiting, automation, AI employees, RecruitOS, and the future of work.",
};

export default function BlogPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-24">
      <h1 className="text-5xl font-bold tracking-tight">
        OperationOS Blog
      </h1>

      <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
        Articles about AI recruiting, automation, AI employees,
        RecruitOS, and the future of intelligent work.
      </p>

      <div className="mt-16 rounded-xl border p-8 transition hover:border-accent">
        <p className="text-sm text-muted-foreground">
          August 6, 2026 • 12 min read
        </p>

        <h2 className="mt-3 text-3xl font-semibold">
          AI Resume Screening: How It Works (Complete Guide for Recruiters in 2026)
        </h2>

        <p className="mt-4 text-muted-foreground">
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
    </main>
  );
}