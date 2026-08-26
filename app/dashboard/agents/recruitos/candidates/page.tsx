import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Props = { searchParams: Promise<{ q?: string; jobId?: string; status?: string; recommendation?: string; sort?: string; page?: string }> };
const statuses = ["new", "reviewing", "shortlisted", "interview", "offer", "hired", "rejected"];
const recommendations = ["interview", "maybe", "reject"];
const sortOptions: Array<[string, string]> = [["score", "Match score"], ["newest", "Newest"], ["oldest", "Oldest"]];

type CandidateRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  headline: string | null;
  created_at: string;
  updated_at: string;
};

type MatchRow = {
  id: string;
  candidate_id: string;
  job_id: string;
  match_score: number | null;
  recommendation: string | null;
  recruiter_status: string;
  updated_at: string;
  jobs: { id: string; title: string } | { id: string; title: string }[] | null;
};

export default async function RecruitOSCandidatesPage({ searchParams }: Props) {
  const user = await requireAuthenticatedUser();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 20;

  // Candidates are first-class RecruitOS records. Do not make the Candidates
  // page depend on candidate_job_matches: a candidate exists as soon as a
  // resume is successfully extracted, even if the recruiter has not analyzed
  // that candidate against a job yet.
  let candidateIds: string[] | null = null;

  if (params.jobId || (params.status && statuses.includes(params.status)) || (params.recommendation && recommendations.includes(params.recommendation))) {
    let matchQuery = supabaseAdmin
      .from("candidate_job_matches")
      .select("candidate_id")
      .eq("user_id", user.id);

    if (params.jobId) matchQuery = matchQuery.eq("job_id", params.jobId);
    if (params.status && statuses.includes(params.status)) matchQuery = matchQuery.eq("recruiter_status", params.status);
    if (params.recommendation && recommendations.includes(params.recommendation)) matchQuery = matchQuery.eq("recommendation", params.recommendation);

    const { data: matchingIds, error: matchFilterError } = await matchQuery;
    if (matchFilterError) console.error("Candidate match filter error:", matchFilterError);
    candidateIds = [...new Set((matchingIds ?? []).map((row) => row.candidate_id))];
  }

  let candidatesQuery = supabaseAdmin
    .from("candidates")
    .select("id, full_name, email, headline, created_at, updated_at", { count: "exact" })
    .eq("user_id", user.id);

  if (candidateIds) candidatesQuery = candidateIds.length ? candidatesQuery.in("id", candidateIds) : candidatesQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
  if (q) {
    const escaped = q.replace(/[%_,]/g, "");
    candidatesQuery = candidatesQuery.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,headline.ilike.%${escaped}%`);
  }

  const { data: allCandidates, count, error } = await candidatesQuery;
  const candidates = (allCandidates ?? []) as CandidateRow[];

  // Match data is optional. A candidate without an analysis is still visible;
  // matching information is attached when it exists.
  const candidateIdList = candidates.map((candidate) => candidate.id);
  const { data: matchData, error: matchError } = candidateIdList.length
    ? await supabaseAdmin
        .from("candidate_job_matches")
        .select("id, candidate_id, job_id, match_score, recommendation, recruiter_status, updated_at, jobs ( id, title )")
        .eq("user_id", user.id)
        .in("candidate_id", candidateIdList)
    : { data: [], error: null };

  if (matchError) console.error("Candidate match fetch error:", matchError);

  const matches = (matchData ?? []) as MatchRow[];
  const matchByCandidate = new Map<string, MatchRow>();
  for (const match of matches) {
    const isInSelectedContext = Boolean(
      (!params.jobId || match.job_id === params.jobId) &&
      (!params.status || match.recruiter_status === params.status) &&
      (!params.recommendation || match.recommendation === params.recommendation)
    );
    if (!isInSelectedContext) continue;

    const existing = matchByCandidate.get(match.candidate_id);
    if (!existing || new Date(match.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
      matchByCandidate.set(match.candidate_id, match);
    }
  }

  const enriched = candidates.map((candidate) => ({ candidate, match: matchByCandidate.get(candidate.id) ?? null }));
  const sort = params.sort ?? "score";

  enriched.sort((a, b) => {
    if (sort === "newest") return new Date(b.candidate.created_at).getTime() - new Date(a.candidate.created_at).getTime();
    if (sort === "oldest") return new Date(a.candidate.created_at).getTime() - new Date(b.candidate.created_at).getTime();
    return (b.match?.match_score ?? -1) - (a.match?.match_score ?? -1);
  });

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageItems = enriched.slice(pageStart, pageStart + pageSize);

  const { data: jobs } = await supabaseAdmin.from("jobs").select("id, title").eq("user_id", user.id).order("created_at", { ascending: false });

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

  return <main className="min-h-screen bg-bg px-4 pb-20 pt-24 sm:px-6 sm:pt-28 lg:px-8"><div className="mx-auto max-w-wrap">
    <Link href="/dashboard/agents/recruitos" className="mb-8 inline-flex min-h-10 items-center gap-2 rounded-md text-[13px] text-ink-dim transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">← Back to RecruitOS</Link>
    <div className="mb-9 border-b border-border pb-8 sm:mb-10 sm:pb-10"><p className="mb-4 font-mono text-[11px] tracking-[0.08em] text-accent">RECRUITOS / CANDIDATES</p><h1 className="font-display text-[clamp(36px,5vw,64px)] font-semibold leading-[1.05] tracking-[-0.025em] text-ink">Candidates.</h1><p className="mt-4 max-w-[700px] text-[15px] leading-[1.7] text-ink-dim">Search, prioritize, and manage candidates across your jobs.</p></div>

    <form className="rounded-xl border border-border bg-surface/[0.2] p-4 sm:p-5"><div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto]"><input name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search candidates by name or email" className="min-h-11 rounded-lg border border-border bg-transparent px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-dim focus:border-accent focus:ring-1 focus:ring-accent/40" /><select name="jobId" defaultValue={params.jobId ?? ""} aria-label="Filter by job" className="min-h-11 rounded-lg border border-border bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent"><option value="">All jobs</option>{jobs?.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select><select name="status" defaultValue={params.status ?? ""} aria-label="Filter by pipeline stage" className="min-h-11 rounded-lg border border-border bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent"><option value="">All stages</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><select name="recommendation" defaultValue={params.recommendation ?? ""} aria-label="Filter by recommendation" className="min-h-11 rounded-lg border border-border bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent"><option value="">All recommendations</option>{recommendations.map((item) => <option key={item} value={item}>{item}</option>)}</select><button type="submit" className="min-h-11 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Search</button></div><div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs text-ink-dim">Sort:</span>{sortOptions.map(([value, label]) => <Link key={value} href={href({ sort: value, page: "1" })} className={`rounded-md border px-3 py-2 text-xs transition-colors ${sort === value ? "border-accent bg-accent/[0.06] text-accent" : "border-border text-ink-dim hover:border-accent/50 hover:text-ink"}`}>{label}</Link>)}</div></form>

    {error ? <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/[0.03] p-6 text-sm text-red-300">We couldn’t load candidates. Please refresh and try again.</div> : !pageItems.length ? <section className="mt-5 rounded-xl border border-border p-7 sm:p-10"><p className="font-mono text-[11px] tracking-[0.08em] text-accent">NO MATCHES</p><h2 className="mt-4 font-display text-2xl font-semibold text-ink">{q || params.jobId || params.status || params.recommendation ? "No candidates match these filters." : "No candidates yet."}</h2><p className="mt-3 text-sm text-ink-dim">{q || params.jobId || params.status || params.recommendation ? "Try changing your filters or search terms." : "Upload a resume from a job to start building your candidate pool."}</p></section> : <section className="mt-5 overflow-hidden rounded-xl border border-border"><div className="divide-y divide-border">{pageItems.map(({ candidate, match }) => { const job = match ? (Array.isArray(match.jobs) ? match.jobs[0] : match.jobs) : null; const profileHref = `/dashboard/agents/recruitos/candidates/${candidate.id}${match ? `?jobId=${match.job_id}` : ""}`; return <div key={candidate.id} className="flex flex-col gap-5 px-5 py-5 transition-colors hover:bg-white/[0.015] sm:px-6 sm:py-6 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><Link href={profileHref} className="font-display text-lg font-semibold text-ink transition-colors hover:text-accent">{candidate.full_name || candidate.email || "Unnamed candidate"}</Link><p className="mt-1 truncate text-sm text-ink-dim">{candidate.headline || candidate.email || "Candidate"}{job?.title ? ` · ${job.title}` : ""}</p><p className="mt-2 text-xs capitalize text-ink-dim">{match ? `${match.recruiter_status} · ${match.recommendation ?? "pending"}` : "Not analyzed yet"}</p></div><div className="flex items-center justify-between gap-5 sm:justify-start"><div><p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-dim">Match</p><p className="mt-1 font-display text-2xl font-semibold text-ink">{match?.match_score ?? "—"}</p></div><Link href={profileHref} className="min-h-10 inline-flex items-center rounded-lg border border-border px-4 py-2.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent">Open profile</Link></div></div>; })}</div></section>}
    {totalPages > 1 && <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-ink-dim">Page {page} of {totalPages}</span><div className="flex gap-2">{page > 1 && <Link href={href({ page: String(page - 1) })} className="min-h-10 inline-flex items-center rounded-lg border border-border px-4 py-2 text-xs text-ink">Previous</Link>}{page < totalPages && <Link href={href({ page: String(page + 1) })} className="min-h-10 inline-flex items-center rounded-lg border border-border px-4 py-2 text-xs text-ink">Next</Link>}</div></div>}
  </div></main>;
}
