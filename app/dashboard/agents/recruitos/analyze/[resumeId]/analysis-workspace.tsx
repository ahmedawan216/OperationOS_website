"use client";

import { useState, useTransition } from "react";
import { updateResumeAnalysis, type EditableAnalysis } from "@/app/actions/update-resume-analysis";

type Props = {
  analysis: EditableAnalysis & {
    id: string;
    recommendationLabel: string;
    recommendationColor: string;
  };
};

function listValue(items: string[]) { return items.join("\n"); }
function parseList(value: string) { return value.split("\n").map((item) => item.trim()).filter(Boolean); }

const card = "rounded-xl border border-border p-6 sm:p-8";
const input = "mt-2 w-full rounded-lg border border-border bg-bg px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent";
const textarea = `${input} leading-[1.6]`;

export default function AnalysisWorkspace({ analysis }: Props) {
  const [editing, setEditing] = useState(false);
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

  function beginEdit() {
    setError(null);
    setForm({
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
    setEditing(true);
  }

  function cancelEdit() {
    setError(null);
    setEditing(false);
  }

  function save() {
    setError(null);
    const matchScore = Number(form.matchScore);
    const years = Number(form.yearsRelevantExperience);
    if (!Number.isFinite(matchScore) || matchScore < 0 || matchScore > 100) {
      setError("Match score must be between 0 and 100.");
      return;
    }
    if (!Number.isFinite(years) || years < 0) {
      setError("Relevant experience must be zero or greater.");
      return;
    }

    startTransition(async () => {
      const result = await updateResumeAnalysis(analysis.id, {
        recommendation: form.recommendation,
        matchScore,
        confidence: form.confidence,
        summary: form.summary,
        whyStrongMatch: form.whyStrongMatch,
        matchingSkills: parseList(form.matchingSkills),
        missingSkills: parseList(form.missingSkills),
        yearsRelevantExperience: years,
        potentialConcerns: parseList(form.potentialConcerns),
        reasoning: form.reasoning,
      });
      if (!result.success) {
        setError(result.error ?? "Could not save the analysis.");
        return;
      }
      window.location.reload();
    });
  }

  if (editing) {
    return (
      <section className="rounded-xl border border-accent/30 bg-accent/5 p-5 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-[11px] tracking-[0.08em] text-accent">RECRUITER EDIT</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Edit candidate analysis</h2>
            <p className="mt-2 max-w-[720px] text-sm leading-[1.6] text-ink-dim">Make the final assessment your own. Your changes replace the current RecruitOS assessment for this candidate and job.</p>
          </div>
          <button type="button" onClick={cancelEdit} disabled={pending} className="self-start text-sm text-ink-dim transition-colors hover:text-ink disabled:opacity-50">Cancel</button>
        </div>

        <div className="mt-7 grid gap-5 md:grid-cols-3">
          <label className="text-xs text-ink-dim">Recommendation<select value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value as EditableAnalysis["recommendation"] })} className={input}><option value="interview">Interview</option><option value="maybe">Maybe</option><option value="reject">Reject</option></select></label>
          <label className="text-xs text-ink-dim">Match score<input type="number" min="0" max="100" value={form.matchScore} onChange={(e) => setForm({ ...form, matchScore: e.target.value })} className={input} /></label>
          <label className="text-xs text-ink-dim">Confidence<select value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value as EditableAnalysis["confidence"] })} className={input}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="text-xs text-ink-dim">Summary<textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={7} className={textarea} /></label>
          <label className="text-xs text-ink-dim">Why this candidate matches<textarea value={form.whyStrongMatch} onChange={(e) => setForm({ ...form, whyStrongMatch: e.target.value })} rows={7} className={textarea} /></label>
          <label className="text-xs text-ink-dim">Matching skills <span>(one per line)</span><textarea value={form.matchingSkills} onChange={(e) => setForm({ ...form, matchingSkills: e.target.value })} rows={6} className={textarea} /></label>
          <label className="text-xs text-ink-dim">Missing skills <span>(one per line)</span><textarea value={form.missingSkills} onChange={(e) => setForm({ ...form, missingSkills: e.target.value })} rows={6} className={textarea} /></label>
          <label className="text-xs text-ink-dim">Potential concerns <span>(one per line)</span><textarea value={form.potentialConcerns} onChange={(e) => setForm({ ...form, potentialConcerns: e.target.value })} rows={6} className={textarea} /></label>
          <label className="text-xs text-ink-dim">Relevant experience (years)<input type="number" min="0" step="0.5" value={form.yearsRelevantExperience} onChange={(e) => setForm({ ...form, yearsRelevantExperience: e.target.value })} className={input} /></label>
          <label className="text-xs text-ink-dim md:col-span-2">Reasoning<textarea value={form.reasoning} onChange={(e) => setForm({ ...form, reasoning: e.target.value })} rows={9} className={textarea} /></label>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button" onClick={save} disabled={pending} className="w-full rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{pending ? "Saving changes..." : "Save changes"}</button>
          <button type="button" onClick={cancelEdit} disabled={pending} className="w-full rounded-lg border border-border px-5 py-3 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50 sm:w-auto">Cancel</button>
          {error && <p role="alert" className="text-sm text-red-400 sm:ml-2">{error}</p>}
        </div>
      </section>
    );
  }

  return (
    <div>
      <section className={card}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0"><p className="font-mono text-[11px] tracking-[0.08em] text-accent">RECRUITOS ASSESSMENT</p><h2 className="mt-3 font-display text-2xl font-semibold text-ink">Candidate analysis</h2><p className="mt-2 text-sm text-ink-dim">Review RecruitOS&apos; assessment, then make your final edits if needed.</p></div>
          <button type="button" onClick={beginEdit} className="w-full shrink-0 rounded-lg border border-accent/50 bg-accent/[0.06] px-4 py-3 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent hover:text-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 sm:w-auto">Edit analysis</button>
        </div>
      </section>

      <section className="mt-5 grid gap-5 md:grid-cols-3">
        <div className={card}><p className="font-mono text-[11px] tracking-[0.08em] text-ink-dim">RECOMMENDATION</p><p className={`mt-4 font-display text-3xl font-semibold ${analysis.recommendationColor}`}>{analysis.recommendationLabel}</p></div>
        <div className={card}><p className="font-mono text-[11px] tracking-[0.08em] text-ink-dim">MATCH SCORE</p><p className="mt-4 font-display text-3xl font-semibold text-ink">{analysis.matchScore}/100</p></div>
        <div className={card}><p className="font-mono text-[11px] tracking-[0.08em] text-ink-dim">CONFIDENCE</p><p className="mt-4 font-display text-3xl font-semibold capitalize text-ink">{analysis.confidence}</p></div>
      </section>

      <section className={`mt-5 ${card}`}><p className="font-mono text-[11px] tracking-[0.08em] text-accent">SUMMARY</p><h2 className="mt-3 font-display text-xl font-semibold text-ink">RecruitOS assessment</h2><p className="mt-5 max-w-[800px] whitespace-pre-wrap text-sm leading-[1.8] text-ink-dim">{analysis.summary}</p></section>
      <section className={`mt-5 ${card}`}><p className="font-mono text-[11px] tracking-[0.08em] text-accent">WHY THIS CANDIDATE</p><h2 className="mt-3 font-display text-xl font-semibold text-ink">Why this candidate matches</h2><p className="mt-5 max-w-[800px] whitespace-pre-wrap text-sm leading-[1.8] text-ink-dim">{analysis.whyStrongMatch}</p></section>
      <section className={`mt-5 ${card}`}><p className="font-mono text-[11px] tracking-[0.08em] text-accent">EXPERIENCE</p><h2 className="mt-3 font-display text-xl font-semibold text-ink">Relevant experience</h2><p className="mt-5 font-display text-4xl font-semibold text-ink">{analysis.yearsRelevantExperience}<span className="ml-2 text-lg text-ink-dim">years</span></p></section>
      <div className="mt-5 grid gap-5 md:grid-cols-2"><section className={card}><p className="font-mono text-[11px] tracking-[0.08em] text-accent">MATCHING SKILLS</p><div className="mt-6 flex flex-wrap gap-2">{analysis.matchingSkills.length ? analysis.matchingSkills.map((skill) => <span key={skill} className="rounded-md border border-border px-3 py-2 text-xs text-ink">{skill}</span>) : <p className="text-sm text-ink-dim">No strong matching skills identified.</p>}</div></section><section className={card}><p className="font-mono text-[11px] tracking-[0.08em] text-red-400">MISSING SKILLS</p><div className="mt-6 flex flex-wrap gap-2">{analysis.missingSkills.length ? analysis.missingSkills.map((skill) => <span key={skill} className="rounded-md border border-red-400/30 px-3 py-2 text-xs text-red-300">{skill}</span>) : <p className="text-sm text-ink-dim">No major missing skills identified.</p>}</div></section></div>
      <section className={`mt-5 ${card}`}><p className="font-mono text-[11px] tracking-[0.08em] text-yellow-400">POTENTIAL CONCERNS</p><div className="mt-6 space-y-3">{analysis.potentialConcerns.length ? analysis.potentialConcerns.map((concern) => <div key={concern} className="flex gap-3 text-sm leading-[1.7] text-ink-dim"><span className="text-yellow-400">•</span><span>{concern}</span></div>) : <p className="text-sm text-ink-dim">No significant concerns identified.</p>}</div></section>
      <section className={`mt-5 ${card}`}><p className="font-mono text-[11px] tracking-[0.08em] text-accent">REASONING</p><h2 className="mt-3 font-display text-xl font-semibold text-ink">Why RecruitOS reached this conclusion</h2><p className="mt-5 max-w-[800px] whitespace-pre-wrap text-sm leading-[1.8] text-ink-dim">{analysis.reasoning}</p></section>
    </div>
  );
}
