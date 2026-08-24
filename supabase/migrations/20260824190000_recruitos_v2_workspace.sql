-- RecruitOS V2: first-class candidates, job matches, structured resume state,
-- recruiter notes/activity, job lifecycle, and ownership-aware RLS.
-- This migration intentionally evolves the V1 tables instead of replacing them.

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  email text,
  normalized_email text,
  phone text,
  location text,
  headline text,
  skills jsonb not null default '[]'::jsonb,
  experience jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  years_experience numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.resumes
  add column if not exists candidate_id uuid references public.candidates(id) on delete set null;

alter table public.resumes
  add column if not exists processing_status text not null default 'pending';

alter table public.resumes
  add column if not exists processing_error text;

alter table public.resume_analyses
  add column if not exists candidate_id uuid references public.candidates(id) on delete set null;

alter table public.jobs
  add column if not exists lifecycle_status text not null default 'open';

update public.resumes
set processing_status = case
  when status = 'success' then 'completed'
  when status = 'failed' then 'failed'
  else 'pending'
end
where processing_status = 'pending';

update public.jobs
set lifecycle_status = case
  when lower(coalesce(status, '')) in ('draft', 'open', 'closed', 'archived')
    then lower(status)
  else 'open'
end
where lifecycle_status = 'open';

create table if not exists public.candidate_job_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  resume_id uuid references public.resumes(id) on delete set null,
  latest_analysis_id uuid references public.resume_analyses(id) on delete set null,
  match_score integer,
  recommendation text,
  recruiter_status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_job_matches_unique_candidate_job unique (candidate_id, job_id),
  constraint candidate_job_matches_score_check check (match_score is null or (match_score between 0 and 100)),
  constraint candidate_job_matches_recommendation_check check (recommendation is null or recommendation in ('interview', 'maybe', 'reject')),
  constraint candidate_job_matches_status_check check (recruiter_status in ('new', 'reviewing', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'))
);

create table if not exists public.candidate_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidate_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists candidates_id_user_id_unique
  on public.candidates(id, user_id);

create unique index if not exists jobs_id_user_id_unique
  on public.jobs(id, user_id);

create unique index if not exists resumes_id_user_id_unique
  on public.resumes(id, user_id);

create unique index if not exists candidates_user_normalized_email_unique
  on public.candidates(user_id, normalized_email)
  where normalized_email is not null;

create index if not exists candidates_user_id_idx
  on public.candidates(user_id);
create index if not exists candidates_email_idx
  on public.candidates(user_id, email);
create index if not exists candidates_normalized_email_idx
  on public.candidates(user_id, normalized_email);
create index if not exists candidates_created_at_idx
  on public.candidates(user_id, created_at desc);

create index if not exists resumes_candidate_id_idx
  on public.resumes(candidate_id);
create index if not exists resumes_processing_status_idx
  on public.resumes(user_id, processing_status);

create index if not exists resume_analyses_candidate_id_idx
  on public.resume_analyses(candidate_id);
create index if not exists resume_analyses_job_id_idx
  on public.resume_analyses(user_id, job_id);

create index if not exists candidate_job_matches_user_job_idx
  on public.candidate_job_matches(user_id, job_id);
create index if not exists candidate_job_matches_user_status_idx
  on public.candidate_job_matches(user_id, recruiter_status);
create index if not exists candidate_job_matches_user_score_idx
  on public.candidate_job_matches(user_id, match_score desc);
create index if not exists candidate_job_matches_candidate_idx
  on public.candidate_job_matches(candidate_id);

create index if not exists candidate_notes_candidate_idx
  on public.candidate_notes(user_id, candidate_id, created_at desc);
create index if not exists candidate_activity_candidate_idx
  on public.candidate_activity(user_id, candidate_id, created_at desc);
create index if not exists candidate_activity_job_idx
  on public.candidate_activity(user_id, job_id, created_at desc);
create index if not exists jobs_lifecycle_status_idx
  on public.jobs(user_id, lifecycle_status);

alter table public.candidates enable row level security;
alter table public.candidate_job_matches enable row level security;
alter table public.candidate_notes enable row level security;
alter table public.candidate_activity enable row level security;

-- Candidates

drop policy if exists "Users can view their own candidates" on public.candidates;
drop policy if exists "Users can create their own candidates" on public.candidates;
drop policy if exists "Users can update their own candidates" on public.candidates;
drop policy if exists "Users can delete their own candidates" on public.candidates;

create policy "Users can view their own candidates"
  on public.candidates for select
  using (user_id = auth.uid());

create policy "Users can create their own candidates"
  on public.candidates for insert
  with check (user_id = auth.uid());

create policy "Users can update their own candidates"
  on public.candidates for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own candidates"
  on public.candidates for delete
  using (user_id = auth.uid());

-- Candidate/job matches

drop policy if exists "Users can view their own candidate matches" on public.candidate_job_matches;
drop policy if exists "Users can create their own candidate matches" on public.candidate_job_matches;
drop policy if exists "Users can update their own candidate matches" on public.candidate_job_matches;
drop policy if exists "Users can delete their own candidate matches" on public.candidate_job_matches;

create policy "Users can view their own candidate matches"
  on public.candidate_job_matches for select
  using (user_id = auth.uid());

create policy "Users can create their own candidate matches"
  on public.candidate_job_matches for insert
  with check (user_id = auth.uid());

create policy "Users can update their own candidate matches"
  on public.candidate_job_matches for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own candidate matches"
  on public.candidate_job_matches for delete
  using (user_id = auth.uid());

-- Notes

drop policy if exists "Users can view their own candidate notes" on public.candidate_notes;
drop policy if exists "Users can create their own candidate notes" on public.candidate_notes;
drop policy if exists "Users can update their own candidate notes" on public.candidate_notes;
drop policy if exists "Users can delete their own candidate notes" on public.candidate_notes;

create policy "Users can view their own candidate notes"
  on public.candidate_notes for select
  using (user_id = auth.uid());

create policy "Users can create their own candidate notes"
  on public.candidate_notes for insert
  with check (user_id = auth.uid());

create policy "Users can update their own candidate notes"
  on public.candidate_notes for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own candidate notes"
  on public.candidate_notes for delete
  using (user_id = auth.uid());

-- Activity

drop policy if exists "Users can view their own candidate activity" on public.candidate_activity;
drop policy if exists "Users can create their own candidate activity" on public.candidate_activity;

create policy "Users can view their own candidate activity"
  on public.candidate_activity for select
  using (user_id = auth.uid());

create policy "Users can create their own candidate activity"
  on public.candidate_activity for insert
  with check (user_id = auth.uid());

-- V2 jobs can be filtered through lifecycle_status while the V1 status column
-- remains intact for backward compatibility.
