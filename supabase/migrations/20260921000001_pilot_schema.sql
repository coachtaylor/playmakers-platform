-- PlayMakers platform: Fall 26 pilot schema
-- Scope: roster import, login, media consent, tagged media, all-star voting.
-- Multi-tenant from day one: every row carries org_id.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Core org structure
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.org_staff (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'photographer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Staff are invited by email; the invite converts to org_staff on first login.
create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'photographer')),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index staff_invites_org_email on public.staff_invites (org_id, lower(email));

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);
create index seasons_org on public.seasons (org_id);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  name text not null,
  sport text not null default 'flag_football'
    check (sport in ('flag_football', 'kickball', 'basketball', 'pickleball')),
  format text check (format in ('5v5', '7v7', '10v10')),
  format_type text not null check (format_type in ('DRAFT', 'BYOT')),
  division text check (division in ('womens', 'mens', 'coed')),
  location_name text,
  day_of_week text,
  voting_opens_at timestamptz,
  voting_closes_at timestamptz,
  results_published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint voting_window_order check (
    voting_opens_at is null or voting_closes_at is null or voting_opens_at < voting_closes_at
  )
);
create index programs_org on public.programs (org_id);
create index programs_season on public.programs (season_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (program_id, name)
);
create index teams_org on public.teams (org_id);

-- A member is a person known to an organization. user_id links them to a login
-- once they sign in with the same email.
create table public.members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  first_name text not null,
  last_name text not null default '',
  preferred_name text,
  pronouns text,
  photo_path text,
  media_consent text check (media_consent in ('public', 'league_only', 'none')),
  consent_at timestamptz,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index members_org_email on public.members (org_id, lower(email));
create index members_user on public.members (user_id);

create table public.roster_spots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  member_id uuid not null references public.members(id) on delete cascade,
  role text not null default 'player' check (role in ('captain', 'player', 'free_agent')),
  is_rookie boolean not null default false,
  source text not null default 'import' check (source in ('import', 'registered', 'drafted', 'placed')),
  created_at timestamptz not null default now(),
  unique (program_id, member_id)
);
create index roster_spots_member on public.roster_spots (member_id);
create index roster_spots_team on public.roster_spots (team_id);
create index roster_spots_org on public.roster_spots (org_id);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  starts_at timestamptz,
  location_name text,
  home_team_id uuid references public.teams(id) on delete set null,
  away_team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now()
);
create index games_program on public.games (program_id);
create index games_org on public.games (org_id);
create index games_home on public.games (home_team_id);
create index games_away on public.games (away_team_id);

-- ---------------------------------------------------------------------------
-- Media
-- ---------------------------------------------------------------------------

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  game_id uuid references public.games(id) on delete set null,
  uploaded_by uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('photo', 'video')),
  storage_path text not null unique,
  taken_on date,
  created_at timestamptz not null default now()
);
create index media_assets_program on public.media_assets (program_id);
create index media_assets_org on public.media_assets (org_id);
create index media_assets_game on public.media_assets (game_id);
create index media_assets_uploader on public.media_assets (uploaded_by);

create table public.media_tags (
  asset_id uuid not null references public.media_assets(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  tagged_by uuid references auth.users(id) on delete set null,
  status text not null default 'confirmed' check (status in ('confirmed', 'removed')),
  created_at timestamptz not null default now(),
  primary key (asset_id, member_id)
);
create index media_tags_member on public.media_tags (member_id);
create index media_tags_tagger on public.media_tags (tagged_by);

-- ---------------------------------------------------------------------------
-- Awards and voting
-- ---------------------------------------------------------------------------

create table public.award_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  kind text not null check (kind in ('rookie', 'allstar', 'veteran')),
  label text not null,
  slots integer not null default 5 check (slots between 1 and 20),
  -- who can be voted for: anyone, only rookies, or only non-rookies
  eligibility text not null default 'any' check (eligibility in ('any', 'rookie', 'veteran')),
  sort_order integer not null default 0,
  unique (program_id, kind)
);
create index award_categories_org on public.award_categories (org_id);

create table public.ballots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  voter_member_id uuid not null references public.members(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, voter_member_id)
);
create index ballots_org on public.ballots (org_id);
create index ballots_voter on public.ballots (voter_member_id);

create table public.ballot_choices (
  ballot_id uuid not null references public.ballots(id) on delete cascade,
  category_id uuid not null references public.award_categories(id) on delete cascade,
  candidate_member_id uuid not null references public.members(id) on delete cascade,
  primary key (ballot_id, category_id, candidate_member_id)
);
create index ballot_choices_category on public.ballot_choices (category_id);
create index ballot_choices_candidate on public.ballot_choices (candidate_member_id);

-- Final selections are the commissioner's call; votes inform it.
create table public.award_selections (
  category_id uuid not null references public.award_categories(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  selected_by uuid references auth.users(id) on delete set null,
  selected_at timestamptz not null default now(),
  primary key (category_id, member_id)
);
create index award_selections_member on public.award_selections (member_id);
create index award_selections_selector on public.award_selections (selected_by);

-- ---------------------------------------------------------------------------
-- Helper functions used by policies
-- ---------------------------------------------------------------------------

create or replace function public.is_org_staff(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.org_staff s
    where s.org_id = p_org and s.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.org_staff s
    where s.org_id = p_org and s.user_id = (select auth.uid()) and s.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.org_id = p_org and m.user_id = (select auth.uid())
  ) or public.is_org_staff(p_org);
$$;

-- ---------------------------------------------------------------------------
-- Account linking: a login claims member rows and staff invites by email
-- ---------------------------------------------------------------------------

create or replace function public.link_user_by_email(p_user uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_email is null then
    return;
  end if;

  update public.members
     set user_id = p_user
   where lower(email) = lower(p_email) and user_id is null;

  insert into public.org_staff (org_id, user_id, role)
  select i.org_id, p_user, i.role
    from public.staff_invites i
   where lower(i.email) = lower(p_email) and i.accepted_at is null
  on conflict (org_id, user_id) do update set role = excluded.role;

  update public.staff_invites
     set accepted_at = now()
   where lower(email) = lower(p_email) and accepted_at is null;
end;
$$;
revoke execute on function public.link_user_by_email(uuid, text) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.link_user_by_email(new.id, new.email);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Called after every login so rows imported after signup still link.
create or replace function public.claim_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
begin
  select u.email into v_email from auth.users u where u.id = (select auth.uid());
  if v_email is null then
    raise exception 'not signed in';
  end if;
  perform public.link_user_by_email((select auth.uid()), v_email);
end;
$$;

-- ---------------------------------------------------------------------------
-- Player-facing RPCs
-- ---------------------------------------------------------------------------

create or replace function public.complete_onboarding(
  p_preferred_name text,
  p_pronouns text,
  p_media_consent text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_media_consent not in ('public', 'league_only', 'none') then
    raise exception 'invalid media consent';
  end if;

  update public.members
     set preferred_name = nullif(trim(p_preferred_name), ''),
         pronouns = nullif(trim(p_pronouns), ''),
         media_consent = p_media_consent,
         consent_at = now(),
         onboarded_at = coalesce(onboarded_at, now())
   where user_id = (select auth.uid());

  if not found then
    raise exception 'no player record for this login';
  end if;

  -- a player who opts out entirely is untagged from existing media
  if p_media_consent = 'none' then
    update public.media_tags t
       set status = 'removed'
      from public.members m
     where t.member_id = m.id and m.user_id = (select auth.uid());
  end if;
end;
$$;

create or replace function public.my_profile()
returns table (
  member_id uuid, org_id uuid, org_name text, first_name text, last_name text,
  preferred_name text, pronouns text, media_consent text, onboarded_at timestamptz,
  is_staff boolean, is_admin boolean
) language sql stable security definer set search_path = '' as $$
  select m.id, m.org_id, o.name, m.first_name, m.last_name, m.preferred_name, m.pronouns,
         m.media_consent, m.onboarded_at,
         public.is_org_staff(m.org_id), public.is_org_admin(m.org_id)
    from public.members m
    join public.organizations o on o.id = m.org_id
   where m.user_id = (select auth.uid());
$$;

create or replace function public.my_programs()
returns table (
  program_id uuid, program_name text, season_label text, team_name text, is_rookie boolean,
  voting_opens_at timestamptz, voting_closes_at timestamptz, results_published_at timestamptz,
  has_voted boolean
) language sql stable security definer set search_path = '' as $$
  select p.id, p.name, s.label, t.name, rs.is_rookie,
         p.voting_opens_at, p.voting_closes_at, p.results_published_at,
         exists (select 1 from public.ballots b where b.program_id = p.id and b.voter_member_id = m.id)
    from public.members m
    join public.roster_spots rs on rs.member_id = m.id
    join public.programs p on p.id = rs.program_id
    join public.seasons s on s.id = p.season_id
    left join public.teams t on t.id = rs.team_id
   where m.user_id = (select auth.uid())
   order by s.starts_on desc nulls last, p.name;
$$;

-- True when the caller is rostered in the program or administers its org.
create or replace function public.can_view_program(p_program uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.roster_spots rs
    join public.members m on m.id = rs.member_id
    where rs.program_id = p_program and m.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.programs p where p.id = p_program and public.is_org_admin(p.org_id)
  );
$$;

-- Candidate cards for the ballot: names, team, rookie flag. No emails.
create or replace function public.program_candidates(p_program uuid)
returns table (
  member_id uuid, display_name text, team_name text, is_rookie boolean, photo_path text
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_view_program(p_program) then
    raise exception 'not allowed';
  end if;
  return query
    select m.id,
           trim(coalesce(m.preferred_name, m.first_name) || ' ' || m.last_name),
           t.name, rs.is_rookie, m.photo_path
      from public.roster_spots rs
      join public.members m on m.id = rs.member_id
      left join public.teams t on t.id = rs.team_id
     where rs.program_id = p_program
     order by t.name nulls last, 2;
end;
$$;

create or replace function public.submit_ballot(p_program uuid, p_choices jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_voter uuid;
  v_org uuid;
  v_opens timestamptz;
  v_closes timestamptz;
  v_ballot uuid;
  v_cat record;
  v_entry jsonb;
  v_candidate uuid;
  v_count integer;
begin
  select m.id, p.org_id, p.voting_opens_at, p.voting_closes_at
    into v_voter, v_org, v_opens, v_closes
    from public.programs p
    join public.roster_spots rs on rs.program_id = p.id
    join public.members m on m.id = rs.member_id
   where p.id = p_program and m.user_id = (select auth.uid());

  if v_voter is null then
    raise exception 'you are not on a roster in this league';
  end if;
  if v_opens is null or now() < v_opens then
    raise exception 'voting has not opened yet';
  end if;
  if v_closes is not null and now() > v_closes then
    raise exception 'voting has closed';
  end if;

  insert into public.ballots (org_id, program_id, voter_member_id)
  values (v_org, p_program, v_voter)
  on conflict (program_id, voter_member_id) do update set updated_at = now()
  returning id into v_ballot;

  delete from public.ballot_choices where ballot_id = v_ballot;

  for v_entry in select * from jsonb_array_elements(coalesce(p_choices, '[]'::jsonb)) loop
    select c.* into v_cat
      from public.award_categories c
     where c.id = (v_entry->>'category_id')::uuid and c.program_id = p_program;
    if v_cat.id is null then
      raise exception 'unknown award category';
    end if;

    select count(*) into v_count
      from (select distinct x from jsonb_array_elements_text(coalesce(v_entry->'member_ids', '[]'::jsonb)) x) d;
    if v_count > v_cat.slots then
      raise exception '% allows at most % picks', v_cat.label, v_cat.slots;
    end if;

    for v_candidate in
      select distinct x::uuid from jsonb_array_elements_text(coalesce(v_entry->'member_ids', '[]'::jsonb)) x
    loop
      if v_candidate = v_voter then
        raise exception 'you cannot vote for yourself';
      end if;
      if not exists (
        select 1 from public.roster_spots rs
         where rs.program_id = p_program and rs.member_id = v_candidate
           and (v_cat.eligibility = 'any'
                or (v_cat.eligibility = 'rookie' and rs.is_rookie)
                or (v_cat.eligibility = 'veteran' and not rs.is_rookie))
      ) then
        raise exception 'a pick for % is not eligible', v_cat.label;
      end if;
      insert into public.ballot_choices (ballot_id, category_id, candidate_member_id)
      values (v_ballot, v_cat.id, v_candidate);
    end loop;
  end loop;

  return v_ballot;
end;
$$;

create or replace function public.my_ballot(p_program uuid)
returns table (category_id uuid, candidate_member_id uuid) language sql stable security definer set search_path = '' as $$
  select bc.category_id, bc.candidate_member_id
    from public.ballots b
    join public.members m on m.id = b.voter_member_id
    join public.ballot_choices bc on bc.ballot_id = b.id
   where b.program_id = p_program and m.user_id = (select auth.uid());
$$;

-- Published results, visible to anyone rostered once the commissioner publishes.
create or replace function public.program_results(p_program uuid)
returns table (category_id uuid, category_label text, sort_order integer, member_id uuid, display_name text, team_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_view_program(p_program) then
    raise exception 'not allowed';
  end if;
  if not exists (select 1 from public.programs p where p.id = p_program and p.results_published_at is not null)
     and not exists (select 1 from public.programs p where p.id = p_program and public.is_org_admin(p.org_id)) then
    raise exception 'results are not published yet';
  end if;
  return query
    select c.id, c.label, c.sort_order, m.id,
           trim(coalesce(m.preferred_name, m.first_name) || ' ' || m.last_name), t.name
      from public.award_selections s
      join public.award_categories c on c.id = s.category_id
      join public.members m on m.id = s.member_id
      left join public.roster_spots rs on rs.member_id = m.id and rs.program_id = c.program_id
      left join public.teams t on t.id = rs.team_id
     where c.program_id = p_program
     order by c.sort_order, 5;
end;
$$;

-- ---------------------------------------------------------------------------
-- Commissioner RPCs
-- ---------------------------------------------------------------------------

create or replace function public.require_program_admin(p_program uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  select p.org_id into v_org from public.programs p where p.id = p_program;
  if v_org is null or not public.is_org_admin(v_org) then
    raise exception 'commissioner access required';
  end if;
  return v_org;
end;
$$;

-- rows: [{email, first_name, last_name, team, role, is_rookie}]
create or replace function public.import_roster(p_program uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := public.require_program_admin(p_program);
  v_row jsonb;
  v_team uuid;
  v_member uuid;
  v_email text;
  v_added integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_inserted boolean;
begin
  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_email := lower(trim(v_row->>'email'));
    if v_email is null or v_email = '' or position('@' in v_email) = 0
       or coalesce(trim(v_row->>'first_name'), '') = '' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_team := null;
    if coalesce(trim(v_row->>'team'), '') <> '' then
      insert into public.teams (org_id, program_id, name)
      values (v_org, p_program, trim(v_row->>'team'))
      on conflict (program_id, name) do update set name = excluded.name
      returning id into v_team;
    end if;

    insert into public.members (org_id, email, first_name, last_name, user_id)
    values (
      v_org, v_email, trim(v_row->>'first_name'), coalesce(trim(v_row->>'last_name'), ''),
      (select u.id from auth.users u where lower(u.email) = v_email limit 1)
    )
    on conflict (org_id, lower(email)) do update
      set first_name = excluded.first_name,
          last_name = excluded.last_name,
          user_id = coalesce(public.members.user_id, excluded.user_id)
    returning id into v_member;

    insert into public.roster_spots (org_id, program_id, team_id, member_id, role, is_rookie, source)
    values (
      v_org, p_program, v_team, v_member,
      case when lower(coalesce(v_row->>'role', '')) in ('captain', 'player', 'free_agent')
           then lower(v_row->>'role') else 'player' end,
      coalesce((v_row->>'is_rookie')::boolean, false),
      'import'
    )
    on conflict (program_id, member_id) do update
      set team_id = excluded.team_id, role = excluded.role, is_rookie = excluded.is_rookie
    returning (xmax = 0) into v_inserted;

    if v_inserted then v_added := v_added + 1; else v_updated := v_updated + 1; end if;
  end loop;

  return jsonb_build_object('added', v_added, 'updated', v_updated, 'skipped', v_skipped);
end;
$$;

create or replace function public.award_tallies(p_program uuid)
returns table (
  category_id uuid, category_label text, sort_order integer, slots integer,
  member_id uuid, display_name text, team_name text, is_rookie boolean,
  votes bigint, selected boolean
) language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_program_admin(p_program);
  return query
    select c.id, c.label, c.sort_order, c.slots, m.id,
           trim(coalesce(m.preferred_name, m.first_name) || ' ' || m.last_name),
           t.name, rs.is_rookie,
           count(bc.ballot_id),
           exists (select 1 from public.award_selections s where s.category_id = c.id and s.member_id = m.id)
      from public.award_categories c
      join public.roster_spots rs on rs.program_id = c.program_id
      join public.members m on m.id = rs.member_id
      left join public.teams t on t.id = rs.team_id
      left join public.ballot_choices bc on bc.category_id = c.id and bc.candidate_member_id = m.id
     where c.program_id = p_program
       and (c.eligibility = 'any'
            or (c.eligibility = 'rookie' and rs.is_rookie)
            or (c.eligibility = 'veteran' and not rs.is_rookie))
     group by c.id, c.label, c.sort_order, c.slots, m.id, m.preferred_name, m.first_name, m.last_name, t.name, rs.is_rookie
     order by c.sort_order, count(bc.ballot_id) desc, 6;
end;
$$;

create or replace function public.program_turnout(p_program uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_program_admin(p_program);
  return jsonb_build_object(
    'rostered', (select count(*) from public.roster_spots where program_id = p_program),
    'logged_in', (select count(*) from public.roster_spots rs join public.members m on m.id = rs.member_id
                   where rs.program_id = p_program and m.user_id is not null),
    'ballots', (select count(*) from public.ballots where program_id = p_program)
  );
end;
$$;

create or replace function public.set_award_selection(p_category uuid, p_member uuid, p_selected boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_program uuid;
begin
  select c.program_id into v_program from public.award_categories c where c.id = p_category;
  perform public.require_program_admin(v_program);
  if p_selected then
    insert into public.award_selections (category_id, member_id, selected_by)
    values (p_category, p_member, (select auth.uid()))
    on conflict do nothing;
  else
    delete from public.award_selections where category_id = p_category and member_id = p_member;
  end if;
end;
$$;

create or replace function public.set_voting_window(p_program uuid, p_opens timestamptz, p_closes timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_program_admin(p_program);
  update public.programs set voting_opens_at = p_opens, voting_closes_at = p_closes where id = p_program;
end;
$$;

create or replace function public.set_results_published(p_program uuid, p_published boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_program_admin(p_program);
  update public.programs
     set results_published_at = case when p_published then now() else null end
   where id = p_program;
end;
$$;

-- ---------------------------------------------------------------------------
-- Media tag guard: nobody who chose "none" can be tagged; same org only
-- ---------------------------------------------------------------------------

create or replace function public.guard_media_tag()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_consent text;
  v_member_org uuid;
  v_asset_org uuid;
begin
  select m.media_consent, m.org_id into v_consent, v_member_org from public.members m where m.id = new.member_id;
  select a.org_id into v_asset_org from public.media_assets a where a.id = new.asset_id;
  if v_member_org is distinct from v_asset_org then
    raise exception 'player is not in this league';
  end if;
  if new.status = 'confirmed' and v_consent = 'none' then
    raise exception 'this player has opted out of media';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_media_tag() from public, anon, authenticated;

create trigger media_tags_guard
  before insert or update on public.media_tags
  for each row execute function public.guard_media_tag();
