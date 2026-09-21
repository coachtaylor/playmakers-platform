-- Row level security. Players read their own league; commissioners manage it.
-- Writes that need validation (ballots, onboarding, import) go through RPCs only.

alter table public.organizations   enable row level security;
alter table public.org_staff       enable row level security;
alter table public.staff_invites   enable row level security;
alter table public.seasons         enable row level security;
alter table public.programs        enable row level security;
alter table public.teams           enable row level security;
alter table public.members         enable row level security;
alter table public.roster_spots    enable row level security;
alter table public.games           enable row level security;
alter table public.media_assets    enable row level security;
alter table public.media_tags      enable row level security;
alter table public.award_categories enable row level security;
alter table public.ballots         enable row level security;
alter table public.ballot_choices  enable row level security;
alter table public.award_selections enable row level security;

-- organizations
create policy "members read their org" on public.organizations
  for select to authenticated using (public.is_org_member(id));

-- org_staff
create policy "staff read own row, admins read all" on public.org_staff
  for select to authenticated using (user_id = (select auth.uid()) or public.is_org_admin(org_id));
create policy "admins manage staff" on public.org_staff
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- staff_invites
create policy "admins manage invites" on public.staff_invites
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- league structure: readable by the league, writable by commissioners
create policy "league reads seasons" on public.seasons
  for select to authenticated using (public.is_org_member(org_id));
create policy "admins write seasons" on public.seasons
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy "league reads programs" on public.programs
  for select to authenticated using (public.is_org_member(org_id));
create policy "admins write programs" on public.programs
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy "league reads teams" on public.teams
  for select to authenticated using (public.is_org_member(org_id));
create policy "admins write teams" on public.teams
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy "league reads games" on public.games
  for select to authenticated using (public.is_org_member(org_id));
create policy "admins write games" on public.games
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy "league reads award categories" on public.award_categories
  for select to authenticated using (public.is_org_member(org_id));
create policy "admins write award categories" on public.award_categories
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- members: your own row, or commissioners. Other players' names reach the app
-- only through program_candidates(), which never returns emails.
create policy "read own member row or admin" on public.members
  for select to authenticated using (user_id = (select auth.uid()) or public.is_org_admin(org_id));
create policy "admins write members" on public.members
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- roster spots
create policy "read own roster spots or admin" on public.roster_spots
  for select to authenticated using (
    public.is_org_admin(org_id)
    or exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  );
create policy "admins write roster spots" on public.roster_spots
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- media: the whole league sees league media; staff upload
create policy "league reads media" on public.media_assets
  for select to authenticated using (public.is_org_member(org_id));
create policy "staff upload media" on public.media_assets
  for insert to authenticated with check (public.is_org_staff(org_id) and uploaded_by = (select auth.uid()));
create policy "admins manage media" on public.media_assets
  for update to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy "admins delete media" on public.media_assets
  for delete to authenticated using (public.is_org_admin(org_id));

create policy "league reads tags" on public.media_tags
  for select to authenticated using (
    exists (select 1 from public.media_assets a where a.id = asset_id and public.is_org_member(a.org_id))
  );
create policy "league members tag" on public.media_tags
  for insert to authenticated with check (
    tagged_by = (select auth.uid())
    and exists (select 1 from public.media_assets a where a.id = asset_id and public.is_org_member(a.org_id))
  );
create policy "players remove own tag, admins manage" on public.media_tags
  for update to authenticated using (
    exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
    or exists (select 1 from public.media_assets a where a.id = asset_id and public.is_org_admin(a.org_id))
  );

-- ballots: read your own; writes only through submit_ballot()
create policy "read own ballot" on public.ballots
  for select to authenticated using (
    exists (select 1 from public.members m where m.id = voter_member_id and m.user_id = (select auth.uid()))
  );
create policy "read own ballot choices" on public.ballot_choices
  for select to authenticated using (
    exists (
      select 1 from public.ballots b join public.members m on m.id = b.voter_member_id
      where b.id = ballot_id and m.user_id = (select auth.uid())
    )
  );

-- selections: commissioners only; players see them via program_results() after publish
create policy "admins read selections" on public.award_selections
  for select to authenticated using (
    exists (select 1 from public.award_categories c where c.id = category_id and public.is_org_admin(c.org_id))
  );

-- ---------------------------------------------------------------------------
-- Anonymous visitors get nothing
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from public;
grant execute on function
  public.is_org_staff(uuid), public.is_org_admin(uuid), public.is_org_member(uuid),
  public.can_view_program(uuid), public.claim_account(), public.complete_onboarding(text, text, text),
  public.my_profile(), public.my_programs(), public.program_candidates(uuid),
  public.submit_ballot(uuid, jsonb), public.my_ballot(uuid), public.program_results(uuid),
  public.require_program_admin(uuid), public.import_roster(uuid, jsonb), public.award_tallies(uuid),
  public.program_turnout(uuid), public.set_award_selection(uuid, uuid, boolean),
  public.set_voting_window(uuid, timestamptz, timestamptz), public.set_results_published(uuid, boolean)
to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private "media" bucket, paths are {org_id}/{program_id}/{file}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

create policy "league reads media files" on storage.objects
  for select to authenticated using (
    bucket_id = 'media' and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );
create policy "staff upload media files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'media' and public.is_org_staff(((storage.foldername(name))[1])::uuid)
  );
create policy "admins delete media files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'media' and public.is_org_admin(((storage.foldername(name))[1])::uuid)
  );
