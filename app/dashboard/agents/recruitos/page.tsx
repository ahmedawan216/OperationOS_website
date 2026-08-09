import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function RecruitOSPage() {
  const { data: jobs, error } = await supabaseAdmin
    .from("jobs")
    .select("id, title, status, created_at")
    .order("created_at", {
      ascending: false,
    })
    .limit(3);

  if (error) {
    console.error(
      "RecruitOS jobs fetch error:",
      error
    );
  }

  return (
    <main className="min-h-screen bg-bg px-5 pb-20 pt-28 sm:px-8">
      <div className="mx-auto max-w-wrap">
        {/* Back navigation */}

        <Link
          href="/dashboard"
          className="mb-10 inline-flex items-center gap-2 text-[13px] text-ink-dim transition-colors hover:text-ink"
        >
          <span>←</span>
          Back to agents
        </Link>

        {/* Agent header */}

        <div className="mb-12 border-b border-border pb-10">
          <div className="mb-5 flex items-center gap-3">
            <span className="font-mono text-[11px] tracking-[0.08em] text-accent">
              EMPLOYEE 001
            </span>

            <span className="rounded-full border border-accent/20 bg-accent/[0.06] px-2.5 py-1 font-mono text-[10px] tracking-[0.05em] text-accent">
              ACTIVE
            </span>
          </div>

          <h1 className="font-display text-[clamp(36px,5vw,64px)] font-semibold leading-[1.05] tracking-[-0.025em] text-ink">
            RecruitOS
          </h1>

          <p className="mt-4 max-w-[620px] text-[15px] leading-[1.7] text-ink-dim">
            Your AI recruiting employee. Analyze candidates,
            understand why they match, and keep control over
            every hiring decision.
          </p>
        </div>

        {/* Agent overview */}

        <section>
          <div className="mb-6">
            <p className="font-mono text-[11px] tracking-[0.08em] text-ink-dim">
              RECRUITOS WORKSPACE
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Analyze resumes */}

            <Link
              href="/dashboard/agents/recruitos/analyze"
              className="group rounded-xl border border-border p-6 transition-all duration-200 hover:border-accent/40 hover:bg-accent/[0.03]"
            >
              <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-lg border border-border font-mono text-sm text-accent">
                AI
              </div>

              <h2 className="font-display text-lg font-semibold text-ink">
                Analyze resumes
              </h2>

              <p className="mt-2 text-sm leading-[1.6] text-ink-dim">
                Upload a candidate resume and let RecruitOS
                analyze its fit against a job description.
              </p>

              <div className="mt-7 border-t border-border pt-4">
                <span className="text-sm text-ink-dim transition-colors group-hover:text-ink">
                  Open analyzer →
                </span>
              </div>
            </Link>

            {/* Candidates */}

            <Link
              href="/dashboard/agents/recruitos/candidates"
              className="group rounded-xl border border-border p-6 transition-all duration-200 hover:border-accent/40 hover:bg-accent/[0.03]"
            >
              <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-lg border border-border font-mono text-sm text-accent">
                CV
              </div>

              <h2 className="font-display text-lg font-semibold text-ink">
                Candidates
              </h2>

              <p className="mt-2 text-sm leading-[1.6] text-ink-dim">
                View, compare, and manage candidates analyzed
                by RecruitOS.
              </p>

              <div className="mt-7 border-t border-border pt-4">
                <span className="text-sm text-ink-dim transition-colors group-hover:text-ink">
                  View candidates →
                </span>
              </div>
            </Link>

            {/* Your jobs */}

            <Link
              href="/dashboard/agents/recruitos/jobs"
              className="group rounded-xl border border-border p-6 transition-all duration-200 hover:border-accent/40 hover:bg-accent/[0.03]"
            >
              <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-lg border border-border font-mono text-sm text-accent">
                JOB
              </div>

              <h2 className="font-display text-lg font-semibold text-ink">
                Your jobs
              </h2>

              <p className="mt-2 text-sm leading-[1.6] text-ink-dim">
                Manage your hiring roles and choose which
                job RecruitOS should use for candidate analysis.
              </p>

              {jobs?.length ? (
                <div className="mt-6 space-y-2">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-lg border border-border px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-xs font-medium text-ink">
                          {job.title}
                        </span>

                        <span
                          className={`shrink-0 text-[10px] uppercase tracking-[0.06em] ${
                            job.status === "open"
                              ? "text-accent"
                              : "text-ink-dim"
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-6 text-xs text-ink-dim">
                  No jobs created yet.
                </p>
              )}

              <div className="mt-7 border-t border-border pt-4">
                <span className="text-sm text-ink-dim transition-colors group-hover:text-ink">
                  Manage jobs →
                </span>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
