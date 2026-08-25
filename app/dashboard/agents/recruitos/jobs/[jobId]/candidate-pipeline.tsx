"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { analyzeResume } from "@/app/actions/analyze-resume";
import { updateRecruiterStatus, type RecruiterStatus } from "@/app/actions/update-recruiter-status";

type Candidate = {
  id: string;
  candidate_id: string;
  resume_id: string | null;
  recommendation: "interview" | "maybe" | "reject" | null;
  match_score: number | null;
  recruiter_status: RecruiterStatus;
  candidates?: { id: string; full_name: string | null; email: string | null; headline: string | null } | { id: string; full_name: string | null; email: string | null; headline: string | null }[] | null;
};
type Props = { candidates: Candidate[]; jobId: string };
const statuses: RecruiterStatus[] = ["new", "reviewing", "shortlisted", "interview", "offer", "hired", "rejected"];
const labels: Record<RecruiterStatus, string> = { new: "New", reviewing: "Reviewing", shortlisted: "Shortlisted", interview: "Interview", offer: "Offer", hired: "Hired", rejected: "Rejected" };
function candidateName(candidate: Candidate) { const value = Array.isArray(candidate.candidates) ? candidate.candidates[0] : candidate.candidates; return value?.full_name || value?.email || "Unnamed candidate"; }

export default function CandidatePipeline({ candidates, jobId }: Props) {
  const [filter, setFilter] = useState<"all" | RecruiterStatus>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const filtered = filter === "all" ? candidates : candidates.filter((candidate) => candidate.recruiter_status === filter);

  function changeStatus(analysisId: string, status: RecruiterStatus) {
    setError(null);
    startTransition(async () => {
      const result = await updateRecruiterStatus(analysisId, status);
      if (!result.success) setError(result.error ?? "Failed to update candidate status.");
      else window.location.reload();
    });
  }

  function toggle(candidateId: string) {
    setError(null);
    setSelected((current) => current.includes(candidateId) ? current.filter((id) => id !== candidateId) : current.length < 5 ? [...current, candidateId] : current);
  }

  function analyzeSelected() {
    const selectedCandidates = candidates.filter((candidate) => selected.includes(candidate.candidate_id) && candidate.resume_id);
    if (!selectedCandidates.length) {
      setError("Select at least one candidate with a resume to analyze.");
      return;
    }

    setError(null);
    setActionMessage(null);
    startTransition(async () => {
      const results = await Promise.all(selectedCandidates.map((candidate) => analyzeResume(candidate.resume_id as string, jobId)));
      const failed = results.filter((result) => !result.success);
      if (failed.length) {
        setError(`${failed.length} selected candidate${failed.length === 1 ? "" : "s"} could not be analyzed.`);
        setActionMessage(null);
      } else {
        setActionMessage(`${selectedCandidates.length} selected candidate${selectedCandidates.length === 1 ? "" : "s"} analyzed successfully.`);
        setSelected([]);
        window.location.reload();
      }
    });
  }

  const compareHref = `/dashboard/agents/recruitos/candidates/compare?jobId=${encodeURIComponent(jobId)}&ids=${selected.join(",")}`;

  return <section className="mt-5 rounded-xl border border-border p-6 sm:p-8">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="font-mono text-[11px] tracking-[0.08em] text-accent">CANDIDATE PIPELINE</p><h2 className="mt-3 font-display text-2xl font-semibold text-ink">Candidates</h2><p className="mt-2 text-sm leading-[1.6] text-ink-dim">Ranked by stored match score. Move each candidate through the job-specific recruiting pipeline.</p></div>
      <div className="flex flex-wrap gap-2">
        {selected.length > 0 && <button type="button" disabled={isPending} onClick={analyzeSelected} className="inline-flex w-fit rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-colors hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-50">{isPending ? "Analyzing..." : `Analyze selected (${selected.length})`}</button>}
        {selected.length >= 2 && <Link href={compareHref} className="inline-flex w-fit rounded-lg border border-accent px-5 py-3 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-bg">Compare ({selected.length})</Link>}
      </div>
    </div>
    <div className="mt-8 flex flex-wrap gap-2"><button type="button" onClick={() => setFilter("all")} className={`rounded-lg border px-4 py-2 text-xs font-medium transition-colors hover:border-accent hover:bg-accent hover:text-bg ${filter === "all" ? "border-accent text-accent" : "border-border text-ink-dim"}`}>All ({candidates.length})</button>{statuses.map((status) => <button key={status} type="button" onClick={() => setFilter(status)} className={`rounded-lg border px-4 py-2 text-xs font-medium transition-colors hover:border-accent hover:bg-accent hover:text-bg ${filter === status ? "border-accent text-accent" : "border-border text-ink-dim"}`}>{labels[status]} ({candidates.filter((candidate) => candidate.recruiter_status === status).length})</button>)}</div>
    {error && <p role="alert" className="mt-5 text-sm text-red-400">{error}</p>}
    {actionMessage && <p role="status" className="mt-5 text-sm text-accent">{actionMessage}</p>}
    {!filtered.length ? <div className="mt-8 rounded-lg border border-border p-8 text-center"><p className="text-sm font-medium text-ink">{candidates.length ? "No candidates in this stage." : "No candidates yet."}</p><p className="mt-2 text-sm text-ink-dim">Upload resumes above to build this job pipeline.</p></div> : <div className="mt-8 space-y-3">{filtered.map((candidate) => { const score = candidate.match_score ?? 0; const name = candidateName(candidate); return <div key={candidate.id} className="rounded-lg border border-border p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-start gap-4"><input aria-label={`Select ${name} for analysis or comparison`} type="checkbox" checked={selected.includes(candidate.candidate_id)} onChange={() => toggle(candidate.candidate_id)} className="mt-1 h-4 w-4 accent-[var(--color-accent)]" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><span className="font-mono text-2xl font-semibold text-ink">{score}</span><span className="text-xs text-ink-dim">/ 100</span><span className="rounded-full border border-accent/30 px-3 py-1 text-[10px] uppercase tracking-[0.08em] text-accent">{labels[candidate.recruiter_status]}</span></div><h3 className="mt-4 truncate font-display text-lg font-semibold text-ink">{name}</h3><p className="mt-1 truncate text-sm text-ink-dim">{Array.isArray(candidate.candidates) ? candidate.candidates[0]?.headline : candidate.candidates?.headline}</p><p className="mt-3 text-xs text-ink-dim">AI recommendation: <span className="capitalize text-ink">{candidate.recommendation ?? "pending"}</span></p></div></div><div className="flex flex-wrap gap-3 lg:shrink-0"><Link href={`/dashboard/agents/recruitos/candidates/${candidate.candidate_id}?jobId=${jobId}`} className="rounded-lg border border-border px-4 py-2.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:bg-accent hover:text-bg">Candidate profile</Link><select value={candidate.recruiter_status} disabled={isPending} onChange={(event) => changeStatus(candidate.id, event.target.value as RecruiterStatus)} className="rounded-lg border border-border bg-bg px-4 py-2.5 text-xs text-ink outline-none focus:border-accent"><option value="new">New</option><option value="reviewing">Reviewing</option><option value="shortlisted">Shortlisted</option><option value="interview">Interview</option><option value="offer">Offer</option><option value="hired">Hired</option><option value="rejected">Rejected</option></select></div></div></div>; })}</div>}
  </section>;
}
