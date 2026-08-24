"use client";

import { useState, useTransition } from "react";
import { generateRecruiterSummary } from "@/app/actions/recruiter-summary";

export default function RecruiterSummary() {
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function generate() { setError(null); startTransition(async () => { const result = await generateRecruiterSummary(); if (!result.success) setError(result.error ?? "Could not generate summary."); else setSummary(result.summary ?? null); }); }
  return <section className="mt-10 rounded-xl border border-border p-6 sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-mono text-[11px] tracking-[0.08em] text-accent">RECRUITER INTELLIGENCE</p><h2 className="mt-3 font-display text-2xl font-semibold text-ink">What needs your attention?</h2><p className="mt-2 max-w-[650px] text-sm leading-[1.6] text-ink-dim">Generate a grounded summary from your stored candidate and pipeline data.</p></div><button type="button" disabled={pending} onClick={generate} className="rounded-lg border border-accent px-4 py-2.5 text-sm font-medium text-accent disabled:opacity-50">{pending ? "Generating..." : "Generate summary"}</button></div>{summary && <p className="mt-6 border-t border-border pt-6 text-sm leading-[1.8] text-ink">{summary}</p>}{error && <p className="mt-5 text-sm text-red-400">{error}</p>}</section>;
}
