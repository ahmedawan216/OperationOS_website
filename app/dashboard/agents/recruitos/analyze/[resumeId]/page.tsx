import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

type PageProps = {
  params: Promise<{
    resumeId: string;
  }>;
  searchParams: Promise<{
    jobId?: string;
  }>;
};

export default async function RecruitOSAnalysisResultPage({
  params,
  searchParams,
}: PageProps) {
  const { resumeId } = await params;
  const { jobId } = await searchParams;

  if (!jobId) {
    return (
      <main className="min-h-screen bg-bg px-5 pb-20 pt-28 sm:px-8">
        <div className="mx-auto max-w-wrap">
          <Link
            href="/dashboard/agents/recruitos/jobs"
            className="mb-10 inline-flex items-center gap-2 text-[13px] text-ink-dim transition-colors hover:text-ink"
          >
            <span>←</span>
            Back to Jobs
          </Link>

          <div className="rounded-xl border border-border p-6 sm:p-8">
            <h1 className="font-display text-xl font-semibold text-ink">
              Job not specified
            </h1>

            <p className="mt-3 text-sm text-ink-dim">
              This analysis does not have a job associated
              with it.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // Fetch analysis
  // --------------------------------------------------

  const {
    data: analysis,
    error: analysisError,
  } = await supabaseAdmin
    .from("resume_analyses")
    .select("*")
    .eq("resume_id", resumeId)
    .eq("job_id", jobId)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  // --------------------------------------------------
  // Fetch job
  // --------------------------------------------------

  const {
    data: job,
    error: jobError,
  } = await supabaseAdmin
    .from("jobs")
    .select("id, title, description")
    .eq("id", jobId)
    .single();

  // --------------------------------------------------
  // Handle errors
  // --------------------------------------------------

  if (
    analysisError ||
    jobError ||
    !analysis ||
    !job
  ) {
    console.error(
      "Analysis result error:",
      analysisError
    );

    console.error(
      "Job result error:",
      jobError
    );

    return (
      <main className="min-h-screen bg-bg px-5 pb-20 pt-28 sm:px-8">
        <div className="mx-auto max-w-wrap">
          <Link
            href={`/dashboard/agents/recruitos/jobs/${jobId}`}
            className="mb-10 inline-flex items-center gap-2 text-[13px] text-ink-dim transition-colors hover:text-ink"
          >
            <span>←</span>
            Back to Job
          </Link>

          <div className="rounded-xl border border-border p-6 sm:p-8">
            <h1 className="font-display text-xl font-semibold text-ink">
              Analysis not found
            </h1>

            <p className="mt-3 text-sm leading-[1.6] text-ink-dim">
              RecruitOS could not find the analysis
              for this candidate and job.
            </p>
          </div>
        </div>
      </main>
    );
  }

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
    <main className="min-h-screen bg-bg px-5 pb-20 pt-28 sm:px-8">
      <div className="mx-auto max-w-wrap">

        {/* Back */}

        <Link
          href={`/dashboard/agents/recruitos/jobs/${jobId}`}
          className="mb-10 inline-flex items-center gap-2 text-[13px] text-ink-dim transition-colors hover:text-ink"
        >
          <span>←</span>
          Back to Job
        </Link>

        {/* Header */}

        <div className="mb-12">
          <p className="mb-4 font-mono text-[11px] tracking-[0.08em] text-accent">
            RECRUITOS / ANALYSIS RESULT
          </p>

          <h1 className="font-display text-[clamp(36px,5vw,64px)] font-semibold leading-[1.05] tracking-[-0.025em] text-ink">
            Candidate analysis.
          </h1>

          <p className="mt-5 max-w-[700px] text-[15px] leading-[1.7] text-ink-dim">
            RecruitOS analyzed this candidate against
            the selected job.
          </p>
        </div>

        {/* Job context */}

        <section className="mb-5 rounded-xl border border-border p-6 sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.08em] text-accent">
            ANALYZED FOR
          </p>

          <h2 className="mt-3 font-display text-2xl font-semibold text-ink">
            {job.title}
          </h2>

          <div className="mt-6 border-t border-border pt-6">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-ink-dim">
              Job description
            </p>

            <p className="whitespace-pre-wrap text-sm leading-[1.7] text-ink-dim">
              {job.description}
            </p>
          </div>
        </section>

        {/* Recommendation */}

        <section className="grid gap-5 md:grid-cols-3">
          <div className="rounded-xl border border-border p-6 sm:p-8">
            <p className="font-mono text-[11px] tracking-[0.08em] text-ink-dim">
              RECOMMENDATION
            </p>

            <p
              className={`mt-4 font-display text-3xl font-semibold ${recommendationColor}`}
            >
              {recommendationLabel}
            </p>
          </div>

          <div className="rounded-xl border border-border p-6 sm:p-8">
            <p className="font-mono text-[11px] tracking-[0.08em] text-ink-dim">
              MATCH SCORE
            </p>

            <p className="mt-4 font-display text-3xl font-semibold text-ink">
              {analysis.match_score}/100
            </p>
          </div>

          <div className="rounded-xl border border-border p-6 sm:p-8">
            <p className="font-mono text-[11px] tracking-[0.08em] text-ink-dim">
              CONFIDENCE
            </p>

            <p className="mt-4 font-display text-3xl font-semibold capitalize text-ink">
              {analysis.confidence_level}
            </p>
          </div>
        </section>

        {/* Summary */}

        <section className="mt-5 rounded-xl border border-border p-6 sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.08em] text-accent">
            SUMMARY
          </p>

          <h2 className="mt-3 font-display text-xl font-semibold text-ink">
            RecruitOS assessment
          </h2>

          <p className="mt-5 max-w-[800px] text-sm leading-[1.8] text-ink-dim">
            {analysis.summary}
          </p>
        </section>

        {/* Why this candidate */}

        <section className="mt-5 rounded-xl border border-border p-6 sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.08em] text-accent">
            WHY THIS CANDIDATE
          </p>

          <h2 className="mt-3 font-display text-xl font-semibold text-ink">
            Why this candidate matches
          </h2>

          <p className="mt-5 max-w-[800px] text-sm leading-[1.8] text-ink-dim">
            {analysis.why_strong_match}
          </p>
        </section>

        {/* Experience */}

        <section className="mt-5 rounded-xl border border-border p-6 sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.08em] text-accent">
            EXPERIENCE
          </p>

          <h2 className="mt-3 font-display text-xl font-semibold text-ink">
            Relevant experience
          </h2>

          <p className="mt-5 font-display text-4xl font-semibold text-ink">
            {analysis.years_relevant_experience}
            <span className="ml-2 text-lg text-ink-dim">
              years
            </span>
          </p>
        </section>

        {/* Skills */}

        <div className="mt-5 grid gap-5 md:grid-cols-2">

          {/* Matching skills */}

          <section className="rounded-xl border border-border p-6 sm:p-8">
            <p className="font-mono text-[11px] tracking-[0.08em] text-accent">
              MATCHING SKILLS
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {analysis.matching_skills?.length ? (
                analysis.matching_skills.map(
                  (skill: string) => (
                    <span
                      key={skill}
                      className="rounded-md border border-border px-3 py-2 text-xs text-ink"
                    >
                      {skill}
                    </span>
                  )
                )
              ) : (
                <p className="text-sm text-ink-dim">
                  No strong matching skills identified.
                </p>
              )}
            </div>
          </section>

          {/* Missing skills */}

          <section className="rounded-xl border border-border p-6 sm:p-8">
            <p className="font-mono text-[11px] tracking-[0.08em] text-red-400">
              MISSING SKILLS
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {analysis.missing_skills?.length ? (
                analysis.missing_skills.map(
                  (skill: string) => (
                    <span
                      key={skill}
                      className="rounded-md border border-red-400/30 px-3 py-2 text-xs text-red-300"
                    >
                      {skill}
                    </span>
                  )
                )
              ) : (
                <p className="text-sm text-ink-dim">
                  No major missing skills identified.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Concerns */}

        <section className="mt-5 rounded-xl border border-border p-6 sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.08em] text-yellow-400">
            POTENTIAL CONCERNS
          </p>

          <div className="mt-6 space-y-3">
            {analysis.potential_concerns?.length ? (
              analysis.potential_concerns.map(
                (concern: string) => (
                  <div
                    key={concern}
                    className="flex gap-3 text-sm leading-[1.7] text-ink-dim"
                  >
                    <span className="text-yellow-400">
                      •
                    </span>

                    <span>
                      {concern}
                    </span>
                  </div>
                )
              )
            ) : (
              <p className="text-sm text-ink-dim">
                No significant concerns identified.
              </p>
            )}
          </div>
        </section>

        {/* Reasoning */}

        <section className="mt-5 rounded-xl border border-border p-6 sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.08em] text-accent">
            REASONING
          </p>

          <h2 className="mt-3 font-display text-xl font-semibold text-ink">
            Why RecruitOS reached this conclusion
          </h2>

          <p className="mt-5 max-w-[800px] text-sm leading-[1.8] text-ink-dim">
            {analysis.reasoning}
          </p>
        </section>

        {/* Actions */}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
          href={`/dashboard/agents/recruitos/analyze?jobId=${jobId}`}
          className="rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90"
          >
           Analyze another candidate
          </Link>

          <Link
            href={`/dashboard/agents/recruitos/jobs/${jobId}`}
            className="rounded-lg border border-border px-5 py-3 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
          >
            Back to Job
          </Link>

          <Link
            href="/dashboard/agents/recruitos/jobs"
            className="rounded-lg border border-border px-5 py-3 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
          >
            All Jobs
          </Link>
        </div>
      </div>
    </main>
  );
}
