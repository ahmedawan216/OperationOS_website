import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function RecruitOSCandidatesPage() {
  const { data: analyses, error } = await supabaseAdmin
    .from("resume_analyses")
    .select(
      `
        id,
        resume_id,
        job_id,
        recommendation,
        match_score,
        confidence_level,
        summary,
        created_at,
        jobs (
          id,
          title
        )
      `
    )
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Candidates fetch error:",
      error
    );
  }

  return (
    <main className="min-h-screen bg-bg px-5 pb-20 pt-28 sm:px-8">
      <div className="mx-auto max-w-wrap">

        {/* Back */}

        <Link
          href="/dashboard/agents/recruitos"
          className="mb-10 inline-flex items-center gap-2 text-[13px] text-ink-dim transition-colors hover:text-ink"
        >
          <span>←</span>
          Back to RecruitOS
        </Link>

        {/* Header */}

        <div className="mb-12">
          <p className="mb-4 font-mono text-[11px] tracking-[0.08em] text-accent">
            RECRUITOS / CANDIDATES
          </p>

          <h1 className="font-display text-[clamp(36px,5vw,64px)] font-semibold leading-[1.05] tracking-[-0.025em] text-ink">
            Candidates.
          </h1>

          <p className="mt-5 max-w-[700px] text-[15px] leading-[1.7] text-ink-dim">
            Review candidates analyzed by RecruitOS
            and understand how they match each job.
          </p>
        </div>

        {/* Candidates */}

        {!analyses?.length ? (
          <section className="rounded-xl border border-border p-8">
            <p className="font-mono text-[11px] tracking-[0.08em] text-accent">
              NO CANDIDATES YET
            </p>

            <h2 className="mt-4 font-display text-2xl font-semibold text-ink">
              Start analyzing candidates.
            </h2>

            <p className="mt-4 max-w-[600px] text-sm leading-[1.7] text-ink-dim">
              Once you upload a resume and run
              RecruitOS analysis, the candidate will
              appear here.
            </p>

            <Link
              href="/dashboard/agents/recruitos/jobs"
              className="mt-8 inline-flex rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90"
            >
              View jobs
            </Link>
          </section>
        ) : (
          <section className="space-y-4">
            {analyses.map((analysis) => {
              const job = Array.isArray(analysis.jobs)
                ? analysis.jobs[0]
                : analysis.jobs;

              const recommendationLabel =
                analysis.recommendation === "interview"
                  ? "INTERVIEW"
                  : analysis.recommendation === "maybe"
                    ? "MAYBE"
                    : "REJECT";

              const recommendationColor =
                analysis.recommendation === "interview"
                  ? "text-green-400"
                  : analysis.recommendation === "maybe"
                    ? "text-yellow-400"
                    : "text-red-400";

              return (
                <Link
                  key={analysis.id}
                  href={`/dashboard/agents/recruitos/analyze/${analysis.resume_id}?jobId=${analysis.job_id}`}
                  className="block rounded-xl border border-border p-6 transition-colors hover:border-accent/40 sm:p-8"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

                    {/* Candidate */}

                    <div>
                      <p className="font-mono text-[11px] tracking-[0.08em] text-accent">
                        CANDIDATE
                      </p>

                      <h2 className="mt-3 font-display text-xl font-semibold text-ink">
                        Resume candidate
                      </h2>

                      <p className="mt-2 text-sm text-ink-dim">
                        Analyzed for{" "}
                        {job?.title ?? "Unknown job"}
                      </p>
                    </div>

                    {/* Analysis */}

                    <div className="flex flex-wrap gap-8">

                      <div>
                        <p className="font-mono text-[10px] tracking-[0.08em] text-ink-dim">
                          MATCH
                        </p>

                        <p className="mt-2 font-display text-2xl font-semibold text-ink">
                          {analysis.match_score}/100
                        </p>
                      </div>

                      <div>
                        <p className="font-mono text-[10px] tracking-[0.08em] text-ink-dim">
                          RECOMMENDATION
                        </p>

                        <p
                          className={`mt-2 text-sm font-medium ${recommendationColor}`}
                        >
                          {recommendationLabel}
                        </p>
                      </div>

                      <div>
                        <p className="font-mono text-[10px] tracking-[0.08em] text-ink-dim">
                          CONFIDENCE
                        </p>

                        <p className="mt-2 text-sm capitalize text-ink">
                          {analysis.confidence_level}
                        </p>
                      </div>

                    </div>
                  </div>

                  {analysis.summary && (
                    <div className="mt-6 border-t border-border pt-6">
                      <p className="line-clamp-2 text-sm leading-[1.7] text-ink-dim">
                        {analysis.summary}
                      </p>
                    </div>
                  )}

                  <div className="mt-6 text-sm text-accent">
                    View analysis →
                  </div>
                </Link>
              );
            })}
          </section>
        )}

      </div>
    </main>
  );
}