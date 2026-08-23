-- RecruitOS V1: per-user ownership and RLS.
-- Existing legacy rows remain nullable so deployment does not fail; they are
-- intentionally inaccessible to authenticated users until explicitly assigned.

alter table public.jobs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.resumes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.resume_analyses
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists jobs_user_id_idx on public.jobs(user_id);
create index if not exists resumes_user_id_idx on public.resumes(user_id);
create index if not exists resume_analyses_user_id_idx on public.resume_analyses(user_id);

alter table public.jobs enable row level security;
alter table public.resumes enable row level security;
alter table public.resume_analyses enable row level security;

-- These policies protect access when the publishable/anon key is used.
-- Server operations that intentionally use the service-role key still perform
-- explicit ownership checks in application code.

drop policy if exists "Users can view their own jobs" on public.jobs;
drop policy if exists "Users can create their own jobs" on public.jobs;
drop policy if exists "Users can update their own jobs" on public.jobs;
drop policy if exists "Users can delete their own jobs" on public.jobs;

create policy "Users can view their own jobs"
  on public.jobs for select
  using (user_id = auth.uid());

create policy "Users can create their own jobs"
  on public.jobs for insert
  with check (user_id = auth.uid());

create policy "Users can update their own jobs"
  on public.jobs for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own jobs"
  on public.jobs for delete
  using (user_id = auth.uid());

drop policy if exists "Users can view their own resumes" on public.resumes;
drop policy if exists "Users can create their own resumes" on public.resumes;
drop policy if exists "Users can update their own resumes" on public.resumes;
drop policy if exists "Users can delete their own resumes" on public.resumes;

create policy "Users can view their own resumes"
  on public.resumes for select
  using (user_id = auth.uid());

create policy "Users can create their own resumes"
  on public.resumes for insert
  with check (user_id = auth.uid());

create policy "Users can update their own resumes"
  on public.resumes for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own resumes"
  on public.resumes for delete
  using (user_id = auth.uid());

drop policy if exists "Users can view their own analyses" on public.resume_analyses;
drop policy if exists "Users can create their own analyses" on public.resume_analyses;
drop policy if exists "Users can update their own analyses" on public.resume_analyses;
drop policy if exists "Users can delete their own analyses" on public.resume_analyses;

create policy "Users can view their own analyses"
  on public.resume_analyses for select
  using (user_id = auth.uid());

create policy "Users can create their own analyses"
  on public.resume_analyses for insert
  with check (user_id = auth.uid());

create policy "Users can update their own analyses"
  on public.resume_analyses for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own analyses"
  on public.resume_analyses for delete
  using (user_id = auth.uid());

-- New resume objects are stored under <auth-user-id>/<uuid>.pdf.
-- This prevents one authenticated user from directly accessing another
-- user's files through Supabase Storage.

drop policy if exists "Users can read their own resume objects" on storage.objects;
drop policy if exists "Users can upload their own resume objects" on storage.objects;
drop policy if exists "Users can update their own resume objects" on storage.objects;
drop policy if exists "Users can delete their own resume objects" on storage.objects;

create policy "Users can read their own resume objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can upload their own resume objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can update their own resume objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete their own resume objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
