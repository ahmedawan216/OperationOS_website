import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Props = { searchParams: Promise<{ q?: string; jobId?: string; status?: string; recommendation?: string; sort?: string; page?: string }> };

const statuses = ["new", "reviewing", "shortlisted", "interview", "offer", "hired", "rejected"];
const recommendations = ["interview", "maybe", "reject"];
const sortOptions: Array<[string, string]> = [["score", "Match score"], ["newest", "Newest"], ["oldest", "Oldest"]];

export default async function RecruitOSCandidatesPage({ searchParams }: Props) {
  const user = await requireAuthenticatedUser();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin
    .from("candidate_job_matches")
    .select("id, candidate_id, job_id, match_score, recommendation, recruiter_status, updated_at, candidates ( id, full_name, email, headline ), jobs ( id, title )", { count: "exact" })
    .eq("user_id", user.id);

  if (params.jobId) query = query.eq("job_id", params.jobId);
  if (params.status && statuses.includes(params.status)) query = query.eq("recruiter_status", params.status);
  if (params.recommendation && recommendations.includes(params.recommendation)) query = query.eq("recommendation", params.recommendation);
  if (q) {
    const escaped = q.replace(/[%_,]/g, "");
    query = query.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`, { foreignTable: "candidates" });
  }

  const sort = params.sort ?? "score";
  if (sort === "newest") query = query.order("updated_at", { ascending: false });
  else if (sort === "oldest") query = query.order("updated_at", { ascending: true });
  else query = query.order("match_score", { ascending: false, nullsFirst: false });

  const { data: matches, count, error } = await query.range(from, to);
  const { data: jobs } = await supabaseAdmin.from("jobs").select("id, title").eq("user_id", user.id).order("created_at", { ascending: false });
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));

  function href(extra: Record<string, string>) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (params.jobId) next.set("jobId", params.jobId);
    if (params.status) next.set("status", params.status);
    if (params.recommendation) next.set("recommendation", params.recommendation);
    if (params.sort) next.set("sort", params.sort);
    for (const [key, value] of Object.entries(extra)) next.set(key, value);
    return `/dashboard/agents/recruitos/candidates?${next.toString()}`;
  }

  return <main className="min-h-screen bg-bg px-5 pb-20 pt-28 sm:px-8"><div className="mx-auto max-w-wrap">
    <Link href="/dashboard/agents/recruitos" className="mb-10 inline-flex items-center gap-2 text-[13px] text-ink-dim">← Back to RecruitOS</Link>
    <div className="mb-10"><p className="mb-4 font-mono text-[11px] tracking-[0.08em] text-accent">RECRUITOS / CANDIDATES</p><h1 className="font-display text-[clamp(36px,5vw,64px)] font-semibold leading-[1.05] tracking-[-0.025em] text-ink">Candidates.</h1><p className="mt-5 max-w-[700px] text-[15px] leading-[1.7] text-ink-dim">Search, prioritize, and manage candidates across your jobs.</p></div>

    <form className="rounded-xl border border-border p-5 sm:p-6"><div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto]"><input name="q" defaultValue={q} placeholder="Search name or email" className="rounded-lg border border-border bg-transparent px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-dim focus:border-accent" /><select name="jobId" defaultValue={params.jobId ?? ""} className="rounded-lg border border-border bg-bg px-4 py-3 text-sm text-ink outline-none"><option value="">All jobs</option>{jobs?.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select><select name="status" defaultValue={params.status ?? ""} className="rounded-lg border border-border bg-bg px-4 py-3 text-sm text-ink outline-none"><option value="">All stages</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><select name="recommendation" defaultValue={params.recommendation ?? ""} className="rounded-lg border border-border bg-bg px-4 py-3 text-sm text-ink outline-none"><option value="">All recommendations</option>{recommendations.map((item) => <option key={item} value={item}>{item}</option>)}</select><button className="rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg">Search</button></div><div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs text-ink-dim">Sort:</span>{sortOptions.map(([value, label]) => <Link key={value} href={href({ sort: value, page: "1" })} className={`rounded-md border px-3 py-1.5 text-xs ${sort === value ? "border-accent text-accent" : "border-border text-ink-dim"}`}>{label}</Link>)}</div></form>

    {error ? <div className="mt-5 rounded-xl border border-red-400/30 p-6 text-sm text-red-400">Failed to load candidates.</div> : !matches?.length ? <section className="mt-5 rounded-xl border border-border p-8"><p className="font-mono text-[11px] tracking-[0.08em] text-accent">NO MATCHES</p><h2 className="mt-4 font-display text-2xl font-semibold text-ink">No candidates match these filters.</h2><p className="mt-3 text-sm text-ink-dim">Upload resumes from a job or adjust your search.</p></section> : <section className="mt-5 overflow-hidden rounded-xl border border-border"><div className="divide-y divide-border">{matches.map((match) => { const candidate = Array.isArray(match.candidates) ? match.candidates[0] : match.candidates; const job = Array.isArray(match.jobs) ? match.jobs[0] : match.jobs; return <div key={match.id} className="flex flex-col gap-5 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><Link href={`/dashboard/agents/recruitos/candidates/${match.candidate_id}?jobId=${match.job_id}`} className="font-display text-lg font-semibold text-ink hover:text-accent">{candidate?.full_name || candidate?.email || "Unnamed candidate"}</Link><p className="mt-1 truncate text-sm text-ink-dim">{candidate?.headline || candidate?.email || "Candidate"} · {job?.title || "Job"}</p><p className="mt-2 text-xs capitalize text-ink-dim">{match.recruiter_status} · {match.recommendation ?? "pending"}</p></div><div className="flex items-center gap-6"><div><p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-dim">Match</p><p className="mt-1 font-display text-2xl font-semibold text-ink">{match.match_score ?? "—"}</p></div><Link href={`/dashboard/agents/recruitos/candidates/${match.candidate_id}?jobId=${match.job_id}`} className="rounded-lg border border-border px-4 py-2.5 text-xs font-medium text-ink hover:border-accent hover:text-accent">Open profile</Link></div></div>; })}</div></section>}

    {totalPages > 1 && <div className="mt-6 flex items-center justify-between"><span className="text-xs text-ink-dim">Page {page} of {totalPages}</span><div className="flex gap-2">{page > 1 && <Link href={href({ page: String(page - 1) })} className="rounded-lg border border-border px-4 py-2 text-xs text-ink">Previous</Link>}{page < totalPages && <Link href={href({ page: String(page + 1) })} className="rounded-lg border border-border px-4 py-2 text-xs text-ink">Next</Link>}</div></div>}
  </div></main>;
}
