"use client";

import { useRef, useState } from "react";
import { batchUploadResumes, type BatchUploadResult } from "@/app/actions/batch-upload-resumes";
import { batchAnalyzeResumes } from "@/app/actions/batch-analyze-resumes";

type Props = { jobId: string };
const MAX_RESUMES = 25;

type BatchResult = BatchUploadResult & {
  analyzed?: boolean;
};

export default function BatchUpload({ jobId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [selectedResumeIds, setSelectedResumeIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const limitReached = results.length >= MAX_RESUMES;
  const selectable = results.filter((result) => result.success && result.resumeId);

  async function handleProcess() {
    if (!file || pending || limitReached) return;

    setPending(true);
    try {
      const next = await batchUploadResumes(jobId, [file]);
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

  function toggleSelected(resumeId: string) {
    setSelectedResumeIds((current) =>
      current.includes(resumeId) ? current.filter((id) => id !== resumeId) : [...current, resumeId],
    );
  }

  function toggleAll() {
    const ids = selectable.map((result) => result.resumeId as string);
    setSelectedResumeIds((current) => (current.length === ids.length ? [] : ids));
  }

  async function handleAnalyzeSelected() {
    if (!selectedResumeIds.length || analyzing) return;

    setAnalyzing(true);
    try {
      const analyzed = await batchAnalyzeResumes(jobId, selectedResumeIds);
      const byId = new Map(analyzed.map((result) => [result.resumeId, result]));

      setResults((current) =>
        current.map((result) => {
          if (!result.resumeId || !byId.has(result.resumeId)) return result;
          const analysis = byId.get(result.resumeId)!;
          return {
            ...result,
            analyzed: analysis.success,
            error: analysis.success ? result.error : analysis.error,
          };
        }),
      );

      setSelectedResumeIds([]);
    } catch (error) {
      console.error("Batch analysis error:", error);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <section className="mt-5 rounded-xl border border-border p-6 sm:p-8">
      <p className="font-mono text-[11px] tracking-[0.08em] text-accent">BATCH INGESTION</p>
      <h2 className="mt-3 font-display text-2xl font-semibold text-ink">Process multiple resumes.</h2>
      <p className="mt-2 max-w-[700px] text-sm leading-[1.6] text-ink-dim">
        Add up to 25 PDF resumes, one at a time. Process each file, select the candidates you want, then analyze them against this job.
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
          <p className="text-xs text-ink-dim">{results.length} / {MAX_RESUMES} resumes processed</p>
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
        <div className="mt-6 border-t border-border pt-6">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Ready candidates</p>
              <p className="mt-1 text-xs text-ink-dim">Select processed resumes to run RecruitOS analysis.</p>
            </div>
            {selectable.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-medium text-ink-dim transition-colors hover:text-accent"
              >
                {selectedResumeIds.length === selectable.length ? "Clear selection" : "Select all"}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {results.map((result, index) => {
              const canSelect = Boolean(result.success && result.resumeId);
              const checked = Boolean(result.resumeId && selectedResumeIds.includes(result.resumeId));
              return (
                <label
                  key={`${index}-${result.name}-${result.resumeId ?? "failed"}`}
                  className={`flex items-center gap-3 rounded-lg border border-border px-4 py-3 ${canSelect ? "cursor-pointer" : "cursor-default"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canSelect || analyzing || result.analyzed}
                    onChange={() => result.resumeId && toggleSelected(result.resumeId)}
                    className="h-4 w-4 accent-accent disabled:cursor-not-allowed"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{result.name}</span>
                  <span className={`text-xs ${result.success ? "text-green-400" : "text-red-400"}`}>
                    {!result.success ? result.error ?? "Failed" : result.analyzed ? "Analyzed" : "Ready"}
                  </span>
                </label>
              );
            })}
          </div>

          {selectedResumeIds.length > 0 && (
            <div className="mt-5 flex flex-col gap-3 rounded-lg border border-accent/30 bg-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink">{selectedResumeIds.length} candidate{selectedResumeIds.length === 1 ? "" : "s"} selected</p>
              <button
                type="button"
                onClick={handleAnalyzeSelected}
                disabled={analyzing}
                className="rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {analyzing ? "Analyzing candidates..." : "Analyze selected candidates"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
