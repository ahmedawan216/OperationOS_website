"use client";

import { useState, useTransition } from "react";
import { deleteResumeAnalysis } from "@/app/actions/delete-resume-analysis";

export default function DeleteAnalysisButton({ analysisId, resumeId, candidateName }: { analysisId: string; resumeId: string | null; candidateName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteResumeAnalysis(analysisId);
      if (!result.success) {
        setError(result.error ?? "Could not delete the analysis.");
        return;
      }
      if (resumeId) {
        window.dispatchEvent(new CustomEvent("recruitos:analysis-deleted", { detail: { resumeId } }));
      }
      setConfirming(false);
      window.location.reload();
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-dim">Remove {candidateName}&apos;s analysis?</span>
        <button type="button" onClick={handleDelete} disabled={pending} className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs font-medium text-red-300 transition-colors hover:border-red-400/70 hover:bg-red-400/15 disabled:opacity-50">{pending ? "Deleting..." : "Delete"}</button>
        <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50">Cancel</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-red-400/25 px-4 py-2.5 text-xs font-medium text-red-300 transition-colors hover:border-red-400/60 hover:bg-red-400/10 hover:text-red-200">Delete analysis</button>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
