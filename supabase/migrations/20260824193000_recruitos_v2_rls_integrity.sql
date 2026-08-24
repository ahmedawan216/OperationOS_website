-- RecruitOS V2: relational ownership integrity for client-side RLS.
-- Service-role server actions still perform explicit ownership checks.

drop policy if exists "Users can view their own candidate matches" on public.candidate_job_matches;
drop policy if exists "Users can create their own candidate matches" on public.candidate_job_matches;
drop policy if exists "Users can update their own candidate matches" on public.candidate_job_matches;
drop policy if exists "Users can delete their own candidate matches" on public.candidate_job_matches;

create policy "Users can view their own candidate matches"
  on public.candidate_job_matches for select
  using (
    user_id = auth.uid()
    and exists (select 1 from public.candidates c where c.id = candidate_id and c.user_id = auth.uid())
    and exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid())
  );

create policy "Users can create their own candidate matches"
  on public.candidate_job_matches for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.candidates c where c.id = candidate_id and c.user_id = auth.uid())
    and exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid())
  );

create policy "Users can update their own candidate matches"
  on public.candidate_job_matches for update
  using (
    user_id = auth.uid()
    and exists (select 1 from public.candidates c where c.id = candidate_id and c.user_id = auth.uid())
    and exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.candidates c where c.id = candidate_id and c.user_id = auth.uid())
    and exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid())
  );

create policy "Users can delete their own candidate matches"
  on public.candidate_job_matches for delete
  using (
    user_id = auth.uid()
    and exists (select 1 from public.candidates c where c.id = candidate_id and c.user_id = auth.uid())
    and exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid())
  );


drop policy if exists "Users can view their own candidate notes" on public.candidate_notes;
drop policy if exists "Users can create their own candidate notes" on public.candidate_notes;
drop policy if exists "Users can update their own candidate notes" on public.candidate_notes;
drop policy if exists "Users can delete their own candidate notes" on public.candidate_notes;

create policy "Users can view their own candidate notes"
  on public.candidate_notes for select
  using (user_id = auth.uid() and exists (select 1 from public.candidates c where c.id = candidate_id and c.user_id = auth.uid()));
create policy "Users can create their own candidate notes"
  on public.candidate_notes for insert
  with check (user_id = auth.uid() and exists (select 1 from public.candidates c where c.id = candidate_id and c.user_id = auth.uid()));
create policy "Users can update their own candidate notes"
  on public.candidate_notes for update
  using (user_id = auth.uid() and exists (select 1 from public.candidates c where c.id = candidate_id and c.user_id = auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from public.candidates c where c.id = candidate_id and c.user_id = auth.uid()));
create policy "Users can delete their own candidate notes"
  on public.candidate_notes for delete
  using (user_id = auth.uid() and exists (select 1 from public.candidates c where c.id = candidate_id and c.user_id = auth.uid()));


drop policy if exists "Users can view their own candidate activity" on public.candidate_activity;
drop policy if exists "Users can create their own candidate activity" on public.candidate_activity;

create policy "Users can view their own candidate activity"
  on public.candidate_activity for select
  using (
    user_id = auth.uid()
    and exists (select 1 from public.candidates c where c.id = candidate_id and c.user_id = auth.uid())
    and (job_id is null or exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid()))
  );
create policy "Users can create their own candidate activity"
  on public.candidate_activity for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.candidates c where c.id = candidate_id and c.user_id = auth.uid())
    and (job_id is null or exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid()))
  );
