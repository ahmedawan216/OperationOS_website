import Link from "next/link";

import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Job = {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
};

export default async function RecruitOSJobsPage() {
  const user = await requireAuthenticatedUser();
  const { data: jobs, error } = await supabaseAdmin
    .from("jobs")
    .select("id, title, description, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-bg px-5 pb-20 pt-28 sm:px-8">
      <div className="mx-auto max-w-wrap">
        <Link href="/dashboard/agents/recruitos" className="mb-10 inline-flex items-center gap-2 text-[13px] text-ink-dim transition-colors hover:text-ink">
          <span>←</span> Back to RecruitOS
        </Link>

        <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-[700px]">
            <p className="mb-4 font-mono text-[11px] tracking-[0.08em] text-accent">RECRUITOS / JOBS</p>
            <h1 className="font-display text-[clamp(36px,5vw,64px)] font-semibold leading-[1.05] tracking-[-0.025em] text-ink">Your jobs.</h1>
            <p className="mt-5 text-[15px] leading-[1.7] text-ink-dim">Manage your open roles and analyze candidates against the right job.</p>
          </div>
          <Link href="/dashboard/agents/recruitos/jobs/new" className="inline-flex shrink-0 items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90">+ New job</Link>
        </div>

        {error && <div className="rounded-xl border border-red-400/30 p-6"><p className="text-sm text-red-400">Failed to load jobs.</p></div>}

        {!error && (!jobs || jobs.length === 0) && (
          <div className="rounded-xl border border-border p-8 text-center sm:p-12">
            <p className="font-display text-xl font-semibold text-ink">No jobs yet.</p>
            <p className="mt-3 text-sm leading-[1.6] text-ink-dim">Create your first job to start analyzing candidates with RecruitOS.</p>
            <Link href="/dashboard/agents/recruitos/jobs/new" className="mt-6 inline-flex rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90">Create your first job</Link>
          </div>
        )}

        {!error && jobs && jobs.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-border">
            <div className="hidden grid-cols-[1fr_120px_150px_160px] gap-6 border-b border-border px-6 py-4 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-dim sm:grid">
              <span>Job</span><span>Status</span><span>Created</span><span></span>
            </div>
            <div className="divide-y divide-border">
              {jobs.map((job: Job) => (
                <div key={job.id} className="grid gap-5 px-6 py-6 sm:grid-cols-[1fr_120px_150px_160px] sm:items-center sm:gap-6">
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-lg font-semibold text-ink">{job.title}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-[1.6] text-ink-dim">{job.description}</p>
                  </div>
                  <div><span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium ${job.status === "open" ? "border-accent/30 text-accent" : "border-border text-ink-dim"}`}>{job.status}</span></div>
                  <div className="text-sm text-ink-dim">{new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                  <Link href={`/dashboard/agents/recruitos/jobs/${job.id}`} className="inline-flex w-fit rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent">Open job →</Link>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
