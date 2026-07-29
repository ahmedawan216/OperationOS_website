"use client";

import {
  useState,
  useCallback,
} from "react";
import { useSearchParams } from "next/navigation";

import UploadResumeForm from "@/app/dashboard/agents/recruitos/analyze/upload-resume-form";

export default function UploadPageClient() {
  const searchParams = useSearchParams();

  const jobId =
    searchParams.get("jobId");

  const [resumeId, setResumeId] =
    useState<string | null>(null);

  const handleUploadSuccess =
    useCallback((id: string) => {
      setResumeId(id);
    }, []);

  return (
    <main className="min-h-screen bg-bg px-5 pb-20 pt-28 sm:px-8">
      <div className="mx-auto max-w-wrap">
        <div className="mx-auto max-w-[720px]">
          <p className="mb-4 font-mono text-[11px] tracking-[0.08em] text-accent">
            RECRUITOS / ANALYZE
          </p>

          <h1 className="font-display text-[clamp(36px,5vw,64px)] font-semibold leading-[1.05] tracking-[-0.025em] text-ink">
            Analyze a candidate.
          </h1>

          <p className="mt-5 text-[15px] leading-[1.7] text-ink-dim">
            Upload a resume and RecruitOS will
            evaluate the candidate against the
            selected job.
          </p>

          {!jobId && (
            <div className="mt-8 rounded-xl border border-red-400/30 p-6">
              <p className="text-sm text-red-400">
                No job selected. Please return to a
                job and start the analysis from there.
              </p>
            </div>
          )}

          <UploadResumeForm
            jobId={
              jobId ?? undefined
            }
            onUploadSuccess={
              handleUploadSuccess
            }
          />

          {resumeId && (
            <div className="mt-8 rounded-xl border border-border p-6">
              <p className="text-sm text-green-400">
                Resume uploaded successfully.
              </p>

              <p className="mt-2 text-xs text-ink-dim">
                Resume ID: {resumeId}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}