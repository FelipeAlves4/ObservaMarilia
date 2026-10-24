-- Functions start with PUBLIC execute by default. Expose only the RPC surface
-- explicitly granted below; helper functions remain private to database code.
revoke all on all functions in schema public from public;

grant execute on function public.list_occurrences(text), public.get_occurrence(uuid) to anon, authenticated;
grant execute on function public.current_profile(), public.create_occurrence(text,text,text,text,text,text,numeric,numeric,text,text,integer), public.advance_occurrence_to_analysis(uuid,text), public.assign_occurrence(uuid,text,uuid[],text,timestamptz), public.start_occurrence(uuid), public.record_execution_progress(uuid,text,smallint,text,text,integer), public.conclude_occurrence(uuid,text,text,text,integer), public.validate_occurrence(uuid,text,text), public.list_collaborators(), public.claim_geocode(text) to authenticated;

-- The cache is read/written only by a SECURITY DEFINER RPC and service-role
-- Edge Function. This explicit deny policy keeps RLS closed and self-documenting.
create policy "geocode cache is service only" on public.geocode_cache
for all to authenticated using (false) with check (false);
