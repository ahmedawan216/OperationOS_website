"use client";

import { useState, useTransition } from "react";
import { updateResumeAnalysis, type EditableAnalysis } from "@/app/actions/update-resume-analysis";

function listValue(items: string[]) { return items.join("\n"); }
function parseList(value: string) { return value.split("\n").map((item) => item.trim()).filter(Boolean); }

export default function EditAnalysis({ analysis }: { analysis: EditableAnalysis & { id: string } }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    recommendation: analysis.recommendation,
    matchScore: String(analysis.matchScore),
    confidence: analysis.confidence,
    summary: analysis.summary,
    whyStrongMatch: analysis.whyStrongMatch,
    matchingSkills: listValue(analysis.matchingSkills),
    missingSkills: listValue(analysis.missingSkills),
    yearsRelevantExperience: String(analysis.yearsRelevantExperience),
    potentialConcerns: listValue(analysis.potentialConcerns),
    reasoning: analysis.reasoning,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateResumeAnalysis(analysis.id, {
        recommendation: form.recommendation as EditableAnalysis["recommendation"],
        matchScore: Number(form.matchScore),
        confidence: form.confidence as EditableAnalysis["confidence"],
        summary: form.summary,
        whyStrongMatch: form.whyStrongMatch,
        matchingSkills: parseList(form.matchingSkills),
        missingSkills: parseList(form.missingSkills),
        yearsRelevantExperience: Number(form.yearsRelevantExperience),
        potentialConcerns: parseList(form.potentialConcerns),
        reasoning: form.reasoning,
      });
      if (!result.success) setError(result.error ?? "Could not save the analysis.");
      else { setOpen(false); window.location.reload(); }
    });
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent">Edit analysis</button>;

  return (
    <section className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[11px] tracking-[0.08em] text-accent">RECRUITER EDIT</p><h2 className="mt-2 font-display text-xl font-semibold text-ink">Edit analysis</h2><p className="mt-2 text-sm text-ink-dim">Adjust RecruitOS&apos; assessment before using it in your recruiting workflow.</p></div><button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-dim transition-colors hover:text-ink">Cancel</button></div>
      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        <label className="text-xs text-ink-dim">Recommendation<select value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value as typeof form.recommendation })} className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-ink"><option value="interview">Interview</option><option value="maybe">Maybe</option><option value="reject">Reject</option></select></label>
        <label className="text-xs text-ink-dim">Match score<input type="number" min="0" max="100" value={form.matchScore} onChange={(e) => setForm({ ...form, matchScore: e.target.value })} className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-ink" /></label>
        <label className="text-xs text-ink-dim">Confidence<select value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value as typeof form.confidence })} className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-ink"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <label className="text-xs text-ink-dim">Summary<textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={6} className="mt-2 w-full rounded-lg border border-border bg-bg px-4 py-3 text-sm leading-[1.6] text-ink outline-none focus:border-accent" /></label>
        <label className="text-xs text-ink-dim">Why this candidate matches<textarea value={form.whyStrongMatch} onChange={(e) => setForm({ ...form, whyStrongMatch: e.target.value })} rows={6} className="mt-2 w-full rounded-lg border border-border bg-bg px-4 py-3 text-sm leading-[1.6] text-ink outline-none focus:border-accent" /></label>
        <label className="text-xs text-ink-dim">Matching skills <span className="text-ink-dim">(one per line)</span><textarea value={form.matchingSkills} onChange={(e) => setForm({ ...form, matchingSkills: e.target.value })} rows={5} className="mt-2 w-full rounded-lg border border-border bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent" /></label>
        <label className="text-xs text-ink-dim">Missing skills <span className="text-ink-dim">(one per line)</span><textarea value={form.missingSkills} onChange={(e) => setForm({ ...form, missingSkills: e.target.value })} rows={5} className="mt-2 w-full rounded-lg border border-border bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent" /></label>
        <label className="text-xs text-ink-dim">Potential concerns <span className="text-ink-dim">(one per line)</span><textarea value={form.potentialConcerns} onChange={(e) => setForm({ ...form, potentialConcerns: e.target.value })} rows={5} className="mt-2 w-full rounded-lg border border-border bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent" /></label>
        <label className="text-xs text-ink-dim">Relevant experience (years)<input type="number" min="0" step="0.5" value={form.yearsRelevantExperience} onChange={(e) => setForm({ ...form, yearsRelevantExperience: e.target.value })} className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-ink" /></label>
        <label className="text-xs text-ink-dim md:col-span-2">Reasoning<textarea value={form.reasoning} onChange={(e) => setForm({ ...form, reasoning: e.target.value })} rows={7} className="mt-2 w-full rounded-lg border border-border bg-bg px-4 py-3 text-sm leading-[1.6] text-ink outline-none focus:border-accent" /></label>
      </div>
      <div className="mt-6 flex items-center gap-3"><button type="button" onClick={save} disabled={pending} className="rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Saving..." : "Save analysis"}</button>{error && <p role="alert" className="text-sm text-red-400">{error}</p>}</div>
    </section>
  );
}
