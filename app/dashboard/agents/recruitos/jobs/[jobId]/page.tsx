import Link from "next/link";

import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

import CandidatePipeline from "./candidate-pipeline";

type PageProps = { params: Promise<{ jobId: string }> };

export default async function RecruitOSJobPage({ params }: PageProps) {
  const user = await requireAuthenticatedUser();
  const { jobId } = await params;

  const { data: job, error: jobError } = await supabaseAdmin
    .from("jobs")
    .select("id, title, description, status, created_at")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();

  if (jobError || !job) {
    return (
      <main className="min-h-screen bg-bg px-5 pb-20 pt-28 sm:px-8"><div className="mx-auto max-w-wrap">
        <Link href="/dashboard/agents/recruitos/jobs" className="mb-10 inline-flex items-center gap-2 text-[13px] text-ink-dim transition-colors hover:text-ink"><span>←</span> Back to Jobs</Link>
        <div className="rounded-xl border border-border p-8"><h1 className="font-display text-xl font-semibold text-ink">Job not found</h1><p className="mt-3 text-sm text-ink-dim">This job could not be found.</p></div>
      </div></main>
    );
  }

  const { data: candidates, error: candidatesError } = await supabaseAdmin
    .from("resume_analyses")
    .select("id, resume_id, recommendation, match_score, confidence_level, summary, recruiter_status")
    .eq("job_id", jobId)
    .eq("user_id", user.id)
    .order("match_score", { ascending: false });

  if (candidatesError) console.error("Candidate pipeline fetch error:", candidatesError);

  return (
    <main className="min-h-screen bg-bg px-5 pb-20 pt-28 sm:px-8"><div className="mx-auto max-w-wrap">
      <Link href="/dashboard/agents/recruitos/jobs" className="mb-10 inline-flex items-center gap-2 text-[13px] text-ink-dim transition-colors hover:text-ink"><span>←</span> Back to Jobs</Link>
      <div className="mb-12"><div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between"><div>
        <p className="mb-4 font-mono text-[11px] tracking-[0.08em] text-accent">RECRUITOS / JOB</p>
        <h1 className="font-display text-[clamp(36px,5vw,64px)] font-semibold leading-[1.05] tracking-[-0.025em] text-ink">{job.title}</h1>
        <p className="mt-5 text-sm text-ink-dim">Job ID: {job.id}</p>
      </div><span className={`inline-flex w-fit rounded-full border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.08em] ${job.status === "open" ? "border-accent/30 text-accent" : "border-border text-ink-dim"}`}>{job.status}</span></div></div>

      <section className="rounded-xl border border-border p-6 sm:p-8">
        <p className="font-mono text-[11px] tracking-[0.08em] text-ink-dim">JOB DESCRIPTION</p>
        <h2 className="mt-4 font-display text-2xl font-semibold text-ink">Requirements</h2>
        <div className="mt-8 rounded-lg border border-border p-6"><p className="whitespace-pre-wrap text-sm leading-[1.8] text-ink-dim">{job.description}</p></div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={`/dashboard/agents/recruitos/analyze?jobId=${job.id}`} className="rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90">Analyze a candidate</Link>
          <Link href="/dashboard/agents/recruitos/jobs" className="rounded-lg border border-border px-5 py-3 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent">All jobs</Link>
        </div>
      </section>

      <CandidatePipeline jobId={job.id} candidates={candidates ?? []} />
    </div></main>
  );
}
