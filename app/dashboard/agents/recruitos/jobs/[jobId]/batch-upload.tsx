"use client";

import { useState } from "react";
import { batchAnalyzeResumes, type BatchItemResult } from "@/app/actions/batch-analyze-resumes";

type Props = { jobId: string };

export default function BatchUpload({ jobId }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<BatchItemResult[]>([]);
  const [pending, setPending] = useState(false);

  async function handleProcess() {
    if (!files.length || pending) return;
    setPending(true);
    setResults([]);
    try {
      const next = await batchAnalyzeResumes(jobId, files);
      setResults(next);
    } catch (error) {
      console.error("Batch upload error:", error);
      setResults(files.map((file) => ({ name: file.name, success: false, error: "Batch processing could not be started." })));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-5 rounded-xl border border-border p-6 sm:p-8">
      <p className="font-mono text-[11px] tracking-[0.08em] text-accent">BATCH INGESTION</p>
      <h2 className="mt-3 font-display text-2xl font-semibold text-ink">Process multiple resumes.</h2>
      <p className="mt-2 max-w-[700px] text-sm leading-[1.6] text-ink-dim">Select up to 25 PDF resumes. Each file is processed independently so one malformed resume does not stop the rest.</p>
      <input
        type="file"
        accept="application/pdf"
        multiple
        disabled={pending}
        onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 25))}
        className="mt-6 block w-full cursor-pointer rounded-lg border border-border bg-transparent px-4 py-3 text-sm text-ink file:mr-4 file:rounded-md file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-medium file:text-bg"
      />
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-ink-dim">{files.length} resume{files.length === 1 ? "" : "s"} selected</p>
        <button type="button" onClick={handleProcess} disabled={!files.length || pending} className="rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "Processing resumes..." : "Process resumes"}
        </button>
      </div>
      {results.length > 0 && (
        <div className="mt-6 space-y-2 border-t border-border pt-6">
          {results.map((result) => (
            <div key={`${result.name}-${result.resumeId ?? "failed"}`} className="flex flex-col gap-1 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="truncate text-sm text-ink">{result.name}</span>
              <span className={`text-xs ${result.success ? "text-green-400" : "text-red-400"}`}>{result.success ? "Completed" : result.error ?? "Failed"}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
