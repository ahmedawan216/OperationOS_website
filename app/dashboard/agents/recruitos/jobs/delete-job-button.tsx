"use client";

import { useState, useTransition } from "react";
import { deleteJob } from "@/app/actions/delete-job";

export default function DeleteJobButton({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteJob(jobId);
      if (!result.success) {
        setError(result.error ?? "Could not delete this job.");
        return;
      }
      setConfirming(false);
      window.location.reload();
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <span className="max-w-[280px] text-xs leading-5 text-ink-dim sm:text-right">
          Delete “{jobTitle}”? Its job-specific analyses and pipeline will be removed.
        </span>
        <button type="button" onClick={handleDelete} disabled={pending} className="rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-300 transition-colors hover:border-red-400/70 hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "Deleting..." : "Delete job"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="rounded-lg border border-border px-4 py-3 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={() => setConfirming(true)} className="inline-flex shrink-0 items-center justify-center rounded-lg border border-red-400/25 px-5 py-3 text-sm font-medium text-red-300 transition-colors hover:border-red-400/60 hover:bg-red-400/10 hover:text-red-200">
        Delete job
      </button>
      {error && <p role="alert" className="max-w-[260px] text-right text-xs text-red-400">{error}</p>}
    </div>
  );
}
