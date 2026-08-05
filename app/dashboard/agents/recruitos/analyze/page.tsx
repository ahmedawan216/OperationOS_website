import Link from "next/link";
import RecruitOSAnalyzePage from "./AnalyzePage";

type PageProps = {
  searchParams: Promise<{
    jobId?: string | string[];
  }>;
};

export default async function Page({
  searchParams,
}: PageProps) {
  const { jobId } = await searchParams;

  const resolvedJobId = Array.isArray(jobId)
    ? jobId[0]
    : jobId;

  if (!resolvedJobId) {
    return (
      <main className="min-h-screen bg-bg px-5 pb-20 pt-28 sm:px-8">
        <div className="mx-auto max-w-wrap">
          <Link
            href="/dashboard/agents/recruitos/jobs"
            className="mb-10 inline-flex items-center gap-2 text-[13px] text-ink-dim hover:text-ink"
          >
            <span>←</span>
            Back to Jobs
          </Link>

          <div className="rounded-xl border border-red-400/30 p-6">
            <h1 className="font-display text-xl font-semibold text-ink">
              Select a job first
            </h1>

            <p className="mt-3 text-sm text-ink-dim">
              Return to the jobs page and select a job before analyzing a
              candidate.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return <RecruitOSAnalyzePage jobId={resolvedJobId} />;
}