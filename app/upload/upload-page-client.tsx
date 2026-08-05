"use client";

import { useSearchParams } from "next/navigation";

import RecruitOSAnalyzePage from "@/app/dashboard/agents/recruitos/analyze/AnalyzePage";

export default function UploadPageClient() {
  const searchParams = useSearchParams();

  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return (
      <main className="min-h-screen bg-bg px-5 pb-20 pt-28 sm:px-8">
        <div className="mx-auto max-w-wrap">
          <div className="mx-auto max-w-[720px] rounded-xl border border-red-400/30 p-6">
            <p className="font-mono text-[11px] tracking-[0.08em] text-red-400">
              JOB REQUIRED
            </p>

            <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
              No job selected.
            </h1>

            <p className="mt-3 text-sm leading-[1.7] text-ink-dim">
              Return to RecruitOS Jobs and select a job before uploading a
              resume.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return <RecruitOSAnalyzePage jobId={jobId} />;
}