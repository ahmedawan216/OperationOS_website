"use client";

import { useRef, useState } from "react";
import { batchAnalyzeResumes, type BatchItemResult } from "@/app/actions/batch-analyze-resumes";

type Props = { jobId: string };
const MAX_RESUMES = 25;

export default function BatchUpload({ jobId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<BatchItemResult[]>([]);
  const [pending, setPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const limitReached = results.length >= MAX_RESUMES;

  async function handleProcess() {
    if (!file || pending || limitReached) return;

    setPending(true);
    try {
      const next = await batchAnalyzeResumes(jobId, [file]);
      setResults((current) => [...current, ...next]);
    } catch (error) {
      console.error("Batch upload error:", error);
      setResults((current) => [
        ...current,
        { name: file.name, success: false, error: "This resume could not be processed." },
      ]);
    } finally {
      setPending(false);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <section className="mt-5 rounded-xl border border-border p-6 sm:p-8">
      <p className="font-mono text-[11px] tracking-[0.08em] text-accent">BATCH INGESTION</p>
      <h2 className="mt-3 font-display text-2xl font-semibold text-ink">Process multiple resumes.</h2>
      <p className="mt-2 max-w-[700px] text-sm leading-[1.6] text-ink-dim">
        Add up to 25 PDF resumes, one at a time. Select a resume, process it, then choose the next one. Each resume is processed independently.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        disabled={pending || limitReached}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="mt-6 block w-full cursor-pointer rounded-lg border border-border bg-transparent px-4 py-3 text-sm text-ink file:mr-4 file:rounded-md file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-medium file:text-bg disabled:cursor-not-allowed disabled:opacity-50"
      />

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-ink-dim">
            {results.length} / {MAX_RESUMES} resumes processed
          </p>
          {file && <p className="mt-1 truncate text-xs text-ink">Ready: {file.name}</p>}
          {limitReached && <p className="mt-1 text-xs text-accent">25-resume batch limit reached.</p>}
        </div>
        <button
          type="button"
          onClick={handleProcess}
          disabled={!file || pending || limitReached}
          className="rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Processing resume..." : limitReached ? "Batch complete" : "Process resume"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="mt-6 space-y-2 border-t border-border pt-6">
          {results.map((result, index) => (
            <div
              key={`${index}-${result.name}-${result.resumeId ?? "failed"}`}
              className="flex flex-col gap-1 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="truncate text-sm text-ink">{result.name}</span>
              <span className={`text-xs ${result.success ? "text-green-400" : "text-red-400"}`}>
                {result.success ? "Completed" : result.error ?? "Failed"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
