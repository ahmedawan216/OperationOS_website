import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import CandidatePipeline from "./candidate-pipeline";
import BatchUpload from "./batch-upload";
import JobControls from "./job-controls";

type PageProps = { params: Promise<{ jobId: string }> };

export default async function RecruitOSJobPage({ params }: PageProps) {
  const user = await requireAuthenticatedUser();
  const { jobId } = await params;
  const { data: job, error: jobError } = await supabaseAdmin.from("jobs").select("id, title, description, status, lifecycle_status, created_at").eq("id", jobId).eq("user_id", user.id).single();
  if (jobError || !job) return <main className="min-h-screen bg-bg px-4 pb-20 pt-24 sm:px-6 sm:pt-28 lg:px-8"><div className="mx-auto max-w-wrap"><Link href="/dashboard/agents/recruitos/jobs" className="mb-8 inline-flex min-h-10 text-[13px] text-ink-dim">← Back to Jobs</Link><div className="rounded-xl border border-border p-7"><h1 className="font-display text-xl font-semibold text-ink">Job not found</h1><p className="mt-3 text-sm text-ink-dim">This job could not be found.</p></div></div></main>;
  const { data: candidates, error: candidatesError } = await supabaseAdmin.from("candidate_job_matches").select("id, candidate_id, resume_id, latest_analysis_id, recommendation, match_score, recruiter_status, created_at, candidates ( id, full_name, email, headline )").eq("job_id", jobId).eq("user_id", user.id).order("match_score", { ascending: false, nullsFirst: false });
  if (candidatesError) console.error("Candidate pipeline fetch error:", candidatesError);
  const totalCandidates = candidates?.length ?? 0;
  const strongMatches = (candidates ?? []).filter((candidate) => (candidate.match_score ?? 0) >= 75).length;
  const interviews = (candidates ?? []).filter((candidate) => candidate.recruiter_status === "interview").length;
  const hired = (candidates ?? []).filter((candidate) => candidate.recruiter_status === "hired").length;
  const lifecycle = (job.lifecycle_status ?? job.status) as "draft" | "open" | "closed" | "archived";
  const lifecycleClass = lifecycle === "open" ? "border-accent/30 bg-accent/[0.06] text-accent" : lifecycle === "closed" ? "border-yellow-400/25 bg-yellow-400/[0.04] text-yellow-300" : "border-border text-ink-dim";

  return <main className="min-h-screen bg-bg px-4 pb-20 pt-24 sm:px-6 sm:pt-28 lg:px-8"><div className="mx-auto max-w-wrap">
    <Link href="/dashboard/agents/recruitos/jobs" className="mb-8 inline-flex min-h-10 items-center gap-2 rounded-md text-[13px] text-ink-dim transition-colors hover:text-ink">← Back to Jobs</Link>
    <div className="mb-9 border-b border-border pb-8 sm:mb-10 sm:pb-10"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="mb-4 font-mono text-[11px] tracking-[0.08em] text-accent">RECRUITOS / JOB</p><h1 className="break-words font-display text-[clamp(36px,5vw,64px)] font-semibold leading-[1.05] tracking-[-0.025em] text-ink">{job.title}</h1><p className="mt-4 text-sm text-ink-dim">Created {new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p></div><span className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] ${lifecycleClass}`}>{lifecycle}</span></div></div>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[{ label: "Candidates", value: totalCandidates }, { label: "Strong matches", value: strongMatches }, { label: "Interviews", value: interviews }, { label: "Hired", value: hired }].map((metric) => <div key={metric.label} className="rounded-xl border border-border bg-surface/[0.25] p-5 sm:p-6"><p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-dim">{metric.label}</p><p className="mt-3 font-display text-3xl font-semibold text-ink">{metric.value}</p></div>)}</section>
    <JobControls jobId={job.id} title={job.title} description={job.description} status={lifecycle} />
    <section className="mt-5 rounded-xl border border-border p-5 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-[11px] tracking-[0.08em] text-ink-dim">JOB DESCRIPTION</p><h2 className="mt-3 font-display text-2xl font-semibold text-ink">Requirements</h2></div><Link href={`/dashboard/agents/recruitos/analyze?jobId=${job.id}`} className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent hover:text-bg">Analyze a resume</Link></div><div className="mt-6 rounded-lg border border-border bg-surface/[0.18] p-5 sm:p-6"><p className="whitespace-pre-wrap text-sm leading-[1.8] text-ink-dim">{job.description}</p></div></section>
    <BatchUpload jobId={job.id} />
    <CandidatePipeline jobId={job.id} candidates={candidates ?? []} />
  </div></main>;
}
