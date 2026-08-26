import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import DeleteJobButton from "./delete-job-button";

type Job = { id: string; title: string; description: string; status: string; lifecycle_status: string | null; created_at: string };

const statusClass = (status: string) => status === "open"
  ? "border-accent/30 bg-accent/[0.06] text-accent"
  : status === "closed"
    ? "border-yellow-400/25 bg-yellow-400/[0.04] text-yellow-300"
    : status === "archived"
      ? "border-border text-ink-faint"
      : "border-border text-ink-dim";

export default async function RecruitOSJobsPage() {
  const user = await requireAuthenticatedUser();
  const { data: jobs, error } = await supabaseAdmin
    .from("jobs")
    .select("id, title, description, status, lifecycle_status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-bg px-4 pb-20 pt-24 sm:px-6 sm:pt-28 lg:px-8">
      <div className="mx-auto max-w-wrap">
        <Link href="/dashboard/agents/recruitos" className="mb-8 inline-flex min-h-10 items-center gap-2 rounded-md text-[13px] text-ink-dim transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">← Back to RecruitOS</Link>

        <div className="mb-9 flex flex-col gap-6 border-b border-border pb-8 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:pb-10">
          <div className="max-w-[700px]"><p className="mb-4 font-mono text-[11px] tracking-[0.08em] text-accent">RECRUITOS / JOBS</p><h1 className="font-display text-[clamp(36px,5vw,64px)] font-semibold leading-[1.05] tracking-[-0.025em] text-ink">Your jobs.</h1><p className="mt-4 text-[15px] leading-[1.7] text-ink-dim">Manage roles and the candidate pipelines attached to them.</p></div>
          <Link href="/dashboard/agents/recruitos/jobs/new" className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90 sm:w-auto">+ New job</Link>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-400/30 bg-red-400/[0.03] p-6"><p className="text-sm text-red-300">We couldn’t load your jobs. Please refresh and try again.</p></div>
        ) : !jobs?.length ? (
          <div className="rounded-xl border border-border p-7 text-center sm:p-12"><p className="font-display text-xl font-semibold text-ink">No jobs yet.</p><p className="mt-3 text-sm text-ink-dim">Create your first job to start building a hiring pipeline.</p><Link href="/dashboard/agents/recruitos/jobs/new" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90">Create your first job</Link></div>
        ) : (
          <section className="overflow-hidden rounded-xl border border-border">
            <div className="hidden grid-cols-[minmax(0,1fr)_110px_145px_220px] gap-5 border-b border-border bg-surface/[0.35] px-5 py-4 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-dim sm:grid sm:px-6"><span>Job</span><span>Status</span><span>Created</span><span>Actions</span></div>
            <div className="divide-y divide-border">
              {jobs.map((job: Job) => {
                const lifecycle = job.lifecycle_status ?? job.status;
                return <div key={job.id} className="grid gap-5 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_110px_145px_220px] sm:items-center sm:gap-5 sm:px-6 sm:py-6">
                  <div className="min-w-0"><h2 className="truncate font-display text-lg font-semibold text-ink">{job.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-[1.6] text-ink-dim">{job.description}</p></div>
                  <div><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize ${statusClass(lifecycle)}`}>{lifecycle}</span></div>
                  <div className="text-sm text-ink-dim">{new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                  <div className="flex flex-wrap gap-2"><Link href={`/dashboard/agents/recruitos/jobs/${job.id}`} className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent/[0.06] hover:text-accent">Open job →</Link><DeleteJobButton jobId={job.id} jobTitle={job.title} /></div>
                </div>;
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
