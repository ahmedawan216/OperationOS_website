import Link from "next/link";

import UploadResumeForm from "./upload-resume-form";

type PageProps = {
  searchParams: Promise<{
    jobId?: string | string[];
  }>;
};

export default async function RecruitOSAnalyzePage({
  searchParams,
}: PageProps) {
  const { jobId } = await searchParams;
  const resolvedJobId = Array.isArray(jobId) ? jobId[0] : jobId;

  return (
    <main className="min-h-screen bg-bg px-5 pb-20 pt-28 sm:px-8">
      <div className="mx-auto max-w-wrap">
        <Link
          href={
            resolvedJobId
              ? `/dashboard/agents/recruitos/jobs/${resolvedJobId}`
              : "/dashboard/agents/recruitos/jobs"
          }
          className="mb-10 inline-flex items-center gap-2 text-[13px] text-ink-dim transition-colors hover:text-ink"
        >
          <span>←</span>
          {resolvedJobId ? "Back to Job" : "Back to Jobs"}
        </Link>

        <div className="mx-auto max-w-[720px]">
          <p className="mb-4 font-mono text-[11px] tracking-[0.08em] text-accent">
            RECRUITOS / ANALYZE
          </p>

          <h1 className="font-display text-[clamp(36px,5vw,64px)] font-semibold leading-[1.05] tracking-[-0.025em] text-ink">
            Analyze a candidate.
          </h1>

          <p className="mt-5 text-[15px] leading-[1.7] text-ink-dim">
            Upload a resume and RecruitOS will evaluate
            the candidate against the selected job.
          </p>

          {resolvedJobId ? (
            <UploadResumeForm jobId={resolvedJobId} onUploadSuccess={() => {}} />
          ) : (
            <div className="mt-8 rounded-xl border border-red-400/30 p-6 sm:p-8">
              <p className="font-mono text-[11px] tracking-[0.08em] text-red-400">
                JOB REQUIRED
              </p>

              <h2 className="mt-3 font-display text-xl font-semibold text-ink">
                Select a job first.
              </h2>

              <p className="mt-3 text-sm leading-[1.7] text-ink-dim">
                Return to the RecruitOS jobs page and
                select a job before analyzing a candidate.
              </p>

              <Link
                href="/dashboard/agents/recruitos/jobs"
                className="mt-6 inline-flex rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90"
              >
                View jobs
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}