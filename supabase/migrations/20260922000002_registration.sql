-- Registration: season terms on the program, one registration per player per program,
-- the draft card (player profile), teammate requests, sub availability, BYOT teams and
-- their join flow, versioned agreements, and the money records phase one only writes.
--
-- Phase one takes no money: payment is handed off to LeagueApps, the spot is held for
-- 15 minutes, and the player comes back to the confirmation screen. credit_ledger and
-- refund_request exist so the records are modelled, not so money moves.

-- ---------------------------------------------------------------------------
-- Program terms: dates, fees, roster shape
-- ---------------------------------------------------------------------------

alter table public.programs
  add column registration_opens_at timestamptz,
  add column registration_closes_at timestamptz,
  add column open_play_at timestamptz,
  add column draft_at timestamptz,
  add column first_game_at timestamptz,
  add column game_weeks integer check (game_weeks is null or game_weeks between 1 and 52),
  add column skill_level text,
  add column blurb text,
  add column hero_photo_path text,
  -- players per team (BYOT roster cap, shown as [15] in the mockups)
  add column roster_cap integer check (roster_cap is null or roster_cap between 1 and 60),
  -- coed composition, e.g. {"min_men": 6, "min_women": 4} for kickball
  add column composition_rules jsonb not null default '{}'::jsonb,
  -- {"currency":"USD","amount_cents":7900,"plan":{"installments":2,"amount_cents":3950,"second_due_on":"2026-10-14"}}
  add column fees jsonb not null default '{}'::jsonb,
  -- LeagueApps checkout for this program (phase one payment handoff)
  add column payment_url text,
  add constraint registration_window_order check (
    registration_opens_at is null or registration_closes_at is null
    or registration_opens_at < registration_closes_at
  );

-- ---------------------------------------------------------------------------
-- Person-level fields the registration form collects once
-- ---------------------------------------------------------------------------

alter table public.members
  add column phone text,
  add column date_of_birth date,
  add column instagram_handle text,
  -- only used to enforce coed composition in BYOT leagues; never shown to players
  add column gender text check (gender in ('woman', 'man', 'nonbinary', 'undisclosed'));

-- ---------------------------------------------------------------------------
-- Teams: BYOT join codes and a captain of record
-- ---------------------------------------------------------------------------

alter table public.teams
  add column join_code text check (join_code ~ '^[A-Z0-9]{6}$'),
  add column captain_member_id uuid references public.members(id) on delete set null,
  add column created_by_registration uuid;

create unique index teams_join_code on public.teams (program_id, join_code) where join_code is not null;
create index teams_captain on public.teams (captain_member_id);

-- One number per team. DRAFT registrations have no team yet, so the number is only
-- checked once a roster spot lands on a team.
create unique index roster_spots_team_jersey
  on public.roster_spots (team_id, jersey_number)
  where team_id is not null and jersey_number is not null;

-- ---------------------------------------------------------------------------
-- Registration
-- ---------------------------------------------------------------------------

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'pending_payment', 'complete', 'cancelled', 'waitlisted')),
  -- furthest step the player has finished, 1 to 6 in the mockups' order
  last_completed_step smallint not null default 0 check (last_completed_step between 0 and 6),

  -- BYOT: how they are getting on a team. null in a DRAFT league.
  role_choice text check (role_choice in ('captain', 'join_team', 'free_agent')),
  team_id uuid references public.teams(id) on delete set null,

  -- emergency contact: per season, because the person can change
  emergency_name text,
  emergency_phone text,
  emergency_relationship text,

  heard_about text,

  -- payment handoff (no money is processed here)
  payment_plan text check (payment_plan in ('full', 'plan')),
  discount_code text,
  amount_due_cents integer check (amount_due_cents is null or amount_due_cents >= 0),
  payment_provider text not null default 'leagueapps',
  payment_reference text,
  hold_expires_at timestamptz,
  handed_off_at timestamptz,
  paid_at timestamptz,

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (program_id, member_id)
);
create index registrations_org on public.registrations (org_id);
create index registrations_member on public.registrations (member_id);
create index registrations_program_status on public.registrations (program_id, status);
create index registrations_team on public.registrations (team_id);

alter table public.teams
  add constraint teams_created_by_registration_fkey
  foreign key (created_by_registration) references public.registrations(id) on delete set null;

-- The draft card. One per registration: answers belong to a season, not to a person
-- forever, and captains read them when they draft.
create table public.player_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  registration_id uuid not null unique references public.registrations(id) on delete cascade,

  positions_played text[] not null default '{}',
  preferred_offense text,
  preferred_defense text,

  -- three states, never a boolean: a reluctant QB is not a yes and not a no
  qb_willing text check (qb_willing in ('yes', 'reluctant', 'no')),
  qb_years text,

  years_playing text,
  experience_type text,
  route_familiarity text,
  athletic_history text,

  height_ft integer check (height_ft is null or height_ft between 3 and 8),
  height_in integer check (height_in is null or height_in between 0 and 11),
  jersey_name text,
  jersey_number text check (jersey_number is null or jersey_number ~ '^[0-9]{1,3}$'),
  shirt_size text check (shirt_size is null or shirt_size in ('XS', 'S', 'M', 'L', 'XL', '2XL', '3XL')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index player_profiles_org on public.player_profiles (org_id);
create index player_profiles_program on public.player_profiles (program_id);
create index player_profiles_member on public.player_profiles (member_id);

-- Teammate requests: at most 2 per registration, and they only count when mutual.
-- Someone who has not registered yet is stored by phone or handle and matched when
-- they do register.
create table public.teammate_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  requester_member_id uuid not null references public.members(id) on delete cascade,
  target_member_id uuid references public.members(id) on delete cascade,
  invite_name text,
  invite_phone text,
  invite_handle text,
  status text not null default 'requested'
    check (status in ('requested', 'invited', 'withdrawn')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  withdrawn_at timestamptz,
  -- either a player we know, or enough to reach someone we don't
  constraint teammate_request_has_a_person check (
    target_member_id is not null
    or coalesce(nullif(trim(invite_phone), ''), nullif(trim(invite_handle), '')) is not null
  ),
  constraint teammate_request_not_self check (target_member_id is null or target_member_id <> requester_member_id)
);
create unique index teammate_requests_one_per_target
  on public.teammate_requests (registration_id, target_member_id)
  where target_member_id is not null and status <> 'withdrawn';
create unique index teammate_requests_one_per_phone
  on public.teammate_requests (registration_id, invite_phone)
  where invite_phone is not null and status <> 'withdrawn';
create index teammate_requests_target on public.teammate_requests (target_member_id);
create index teammate_requests_program on public.teammate_requests (program_id);
create index teammate_requests_org on public.teammate_requests (org_id);

-- Sub availability is off unless the player turns it on.
create table public.sub_availability (
  registration_id uuid primary key references public.registrations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  enabled boolean not null default false,
  locations text[] not null default '{}',
  nights text[] not null default '{}',
  notice_hours integer check (notice_hours is null or notice_hours between 0 and 336),
  positions text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create index sub_availability_member on public.sub_availability (member_id);
create index sub_availability_org on public.sub_availability (org_id);
create index sub_availability_open on public.sub_availability (program_id) where enabled;

-- BYOT: browse a team and ask its captain for a spot. Join-by-code needs no approval.
create table public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'waitlisted', 'withdrawn')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (team_id, member_id)
);
create index team_join_requests_team_status on public.team_join_requests (team_id, status);
create index team_join_requests_registration on public.team_join_requests (registration_id);
create index team_join_requests_org on public.team_join_requests (org_id);
create index team_join_requests_decider on public.team_join_requests (decided_by);

-- ---------------------------------------------------------------------------
-- Agreements: versioned, accepted by version, with a timestamp and an IP
-- ---------------------------------------------------------------------------

create table public.waiver_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('liability', 'refund_policy', 'code_of_conduct')),
  version_label text not null,
  body text not null,
  effective_from timestamptz not null default now(),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, kind, version_label)
);
-- one live version per document per org
create unique index waiver_versions_current on public.waiver_versions (org_id, kind) where retired_at is null;

create table public.waiver_acceptances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  waiver_version_id uuid not null references public.waiver_versions(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete cascade,
  registration_id uuid references public.registrations(id) on delete set null,
  accepted_at timestamptz not null default now(),
  ip inet,
  user_agent text,
  unique (waiver_version_id, member_id)
);
create index waiver_acceptances_member on public.waiver_acceptances (member_id);
create index waiver_acceptances_registration on public.waiver_acceptances (registration_id);
create index waiver_acceptances_org on public.waiver_acceptances (org_id);

-- ---------------------------------------------------------------------------
-- Money records. Nothing here moves money in phase one.
-- ---------------------------------------------------------------------------

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  -- positive issues credit, negative spends it
  amount_cents integer not null check (amount_cents <> 0),
  currency text not null default 'USD',
  reason text not null check (reason in ('refund_credit', 'goodwill', 'applied_to_registration', 'expired', 'adjustment')),
  registration_id uuid references public.registrations(id) on delete set null,
  refund_request_id uuid,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index credit_ledger_member on public.credit_ledger (member_id);
create index credit_ledger_org on public.credit_ledger (org_id);
create index credit_ledger_creator on public.credit_ledger (created_by);

create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  reason text,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'denied', 'processed')),
  -- what the policy works out to, filled in when a commissioner decides
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  as_credit boolean not null default true,
  resolution_note text,
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz
);
create index refund_requests_registration on public.refund_requests (registration_id);
create index refund_requests_member on public.refund_requests (member_id);
create index refund_requests_org_status on public.refund_requests (org_id, status);
create index refund_requests_decider on public.refund_requests (decided_by);

alter table public.credit_ledger
  add constraint credit_ledger_refund_request_fkey
  foreign key (refund_request_id) references public.refund_requests(id) on delete set null;
create index credit_ledger_refund_request on public.credit_ledger (refund_request_id);

-- ---------------------------------------------------------------------------
-- Row level security. Players read their own rows; every write goes through an RPC.
-- ---------------------------------------------------------------------------

alter table public.registrations      enable row level security;
alter table public.player_profiles    enable row level security;
alter table public.teammate_requests  enable row level security;
alter table public.sub_availability   enable row level security;
alter table public.team_join_requests enable row level security;
alter table public.waiver_versions    enable row level security;
alter table public.waiver_acceptances enable row level security;
alter table public.credit_ledger      enable row level security;
alter table public.refund_requests    enable row level security;

create or replace function public.is_me(p_member uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m where m.id = p_member and m.user_id = (select auth.uid())
  );
$$;

create policy "read own registration or admin" on public.registrations
  for select to authenticated using (public.is_me(member_id) or public.is_org_admin(org_id));
create policy "admins write registrations" on public.registrations
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy "read own profile or admin" on public.player_profiles
  for select to authenticated using (public.is_me(member_id) or public.is_org_admin(org_id));
create policy "admins write player profiles" on public.player_profiles
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- both sides of a request can see it, so "requested you back" can be shown
create policy "read own teammate requests or admin" on public.teammate_requests
  for select to authenticated using (
    public.is_me(requester_member_id) or public.is_me(target_member_id) or public.is_org_admin(org_id)
  );
create policy "admins write teammate requests" on public.teammate_requests
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy "read own sub availability or admin" on public.sub_availability
  for select to authenticated using (public.is_me(member_id) or public.is_org_admin(org_id));
create policy "admins write sub availability" on public.sub_availability
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- a join request is visible to the asker, the team's captain and commissioners
create policy "read own or captained join requests" on public.team_join_requests
  for select to authenticated using (
    public.is_me(member_id)
    or public.is_org_admin(org_id)
    or exists (select 1 from public.teams t where t.id = team_id and public.is_me(t.captain_member_id))
  );
create policy "admins write join requests" on public.team_join_requests
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy "league reads waivers" on public.waiver_versions
  for select to authenticated using (public.is_org_member(org_id));
create policy "admins write waivers" on public.waiver_versions
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy "read own acceptances or admin" on public.waiver_acceptances
  for select to authenticated using (public.is_me(member_id) or public.is_org_admin(org_id));
create policy "admins write acceptances" on public.waiver_acceptances
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy "read own credit or admin" on public.credit_ledger
  for select to authenticated using (public.is_me(member_id) or public.is_org_admin(org_id));
create policy "admins write credit" on public.credit_ledger
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy "read own refund requests or admin" on public.refund_requests
  for select to authenticated using (public.is_me(member_id) or public.is_org_admin(org_id));
create policy "admins write refund requests" on public.refund_requests
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- Public program info. The only thing a signed-out visitor can read, and the
-- program page inside registration reads it too, because a first-time registrant
-- has no member row yet and so is not an org member.
-- ---------------------------------------------------------------------------

create or replace function public.program_public(p_program uuid)
returns table (
  program_id uuid, org_id uuid, org_name text, name text, sport text, format text,
  format_type text, division text, skill_level text, blurb text, location_name text,
  day_of_week text, season_label text, season_starts_on date, season_ends_on date,
  game_weeks integer, open_play_at timestamptz, draft_at timestamptz, first_game_at timestamptz,
  registration_opens_at timestamptz, registration_closes_at timestamptz,
  roster_cap integer, composition_rules jsonb, fees jsonb, hero_photo_path text,
  has_payment_url boolean
) language sql stable security definer set search_path = '' as $$
  select p.id, p.org_id, o.name, p.name, p.sport, p.format, p.format_type, p.division,
         p.skill_level, p.blurb, p.location_name, p.day_of_week,
         s.label, s.starts_on, s.ends_on, p.game_weeks,
         p.open_play_at, p.draft_at, p.first_game_at,
         p.registration_opens_at, p.registration_closes_at,
         p.roster_cap, p.composition_rules, p.fees, p.hero_photo_path,
         p.payment_url is not null
    from public.programs p
    join public.organizations o on o.id = p.org_id
    join public.seasons s on s.id = p.season_id
   where p.id = p_program;
$$;

create or replace function public.open_programs()
returns table (
  program_id uuid, org_id uuid, org_name text, name text, sport text, format text,
  format_type text, division text, skill_level text, blurb text, location_name text,
  day_of_week text, season_label text, season_starts_on date, season_ends_on date,
  game_weeks integer, open_play_at timestamptz, draft_at timestamptz, first_game_at timestamptz,
  registration_opens_at timestamptz, registration_closes_at timestamptz,
  roster_cap integer, composition_rules jsonb, fees jsonb, hero_photo_path text,
  has_payment_url boolean
) language sql stable security definer set search_path = '' as $$
  select r.* from public.programs p
    cross join lateral public.program_public(p.id) r
   where p.registration_closes_at is null or p.registration_closes_at > now()
   order by p.registration_closes_at nulls last, p.name;
$$;

-- ---------------------------------------------------------------------------
-- Registration helpers
-- ---------------------------------------------------------------------------

-- The caller's member row in this org, created on the spot for a first-time
-- registrant so the rest of the flow has something to hang off.
create or replace function public.ensure_member(p_org uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_member uuid;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;

  select m.id into v_member from public.members m where m.org_id = p_org and m.user_id = v_user;
  if v_member is not null then
    return v_member;
  end if;

  select u.email into v_email from auth.users u where u.id = v_user;
  if v_email is null then
    raise exception 'not signed in';
  end if;

  -- an imported row with the same email belongs to this person
  update public.members
     set user_id = v_user
   where org_id = p_org and lower(email) = lower(v_email) and user_id is null
  returning id into v_member;
  if v_member is not null then
    return v_member;
  end if;

  insert into public.members (org_id, user_id, email, first_name)
  values (p_org, v_user, lower(v_email), split_part(v_email, '@', 1))
  returning id into v_member;
  return v_member;
end;
$$;

-- The caller's registration, for writing. Raises unless they own it and it is still open.
create or replace function public.my_open_registration(p_registration uuid)
returns public.registrations language plpgsql stable security definer set search_path = '' as $$
declare
  v_reg public.registrations;
begin
  select * into v_reg from public.registrations where id = p_registration;
  if v_reg.id is null or not public.is_me(v_reg.member_id) then
    raise exception 'registration not found';
  end if;
  if v_reg.status in ('cancelled') then
    raise exception 'this registration was cancelled';
  end if;
  return v_reg;
end;
$$;

create or replace function public.touch_registration(p_registration uuid, p_step smallint)
returns void language sql security definer set search_path = '' as $$
  update public.registrations
     set last_completed_step = greatest(last_completed_step, coalesce(p_step, 0)),
         updated_at = now()
   where id = p_registration;
$$;

create or replace function public.start_registration(p_program uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_program public.programs;
  v_member uuid;
  v_reg uuid;
begin
  select * into v_program from public.programs where id = p_program;
  if v_program.id is null then
    raise exception 'program not found';
  end if;
  if v_program.registration_closes_at is not null and now() > v_program.registration_closes_at then
    raise exception 'registration for % has closed', v_program.name;
  end if;
  if v_program.registration_opens_at is not null and now() < v_program.registration_opens_at then
    raise exception 'registration for % has not opened yet', v_program.name;
  end if;

  v_member := public.ensure_member(v_program.org_id);

  insert into public.registrations (org_id, program_id, member_id)
  values (v_program.org_id, p_program, v_member)
  on conflict (program_id, member_id) do update set updated_at = now()
  returning id into v_reg;

  -- a request someone filed against this person's phone or handle now has a player
  update public.teammate_requests tr
     set target_member_id = v_member, status = 'requested', activated_at = now()
    from public.members m
   where m.id = v_member
     and tr.program_id = p_program
     and tr.target_member_id is null
     and tr.status = 'invited'
     and tr.requester_member_id <> v_member
     and (
       (nullif(regexp_replace(coalesce(tr.invite_phone, ''), '[^0-9]', '', 'g'), '') is not null
        and nullif(regexp_replace(coalesce(tr.invite_phone, ''), '[^0-9]', '', 'g'), '')
            = nullif(regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g'), ''))
       or (nullif(lower(ltrim(coalesce(tr.invite_handle, ''), '@')), '') is not null
        and nullif(lower(ltrim(coalesce(tr.invite_handle, ''), '@')), '')
            = nullif(lower(ltrim(coalesce(m.instagram_handle, ''), '@')), ''))
     );

  return v_reg;
end;
$$;

-- One writer for the form steps. p_data carries only that step's fields.
create or replace function public.save_registration_step(
  p_registration uuid,
  p_step smallint,
  p_data jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations := public.my_open_registration(p_registration);
  v_dob date;
  v_consent text;
  v_positions text[];
begin
  if p_step is null or p_step < 1 or p_step > 6 then
    raise exception 'unknown step';
  end if;
  p_data := coalesce(p_data, '{}'::jsonb);

  if p_step = 1 then
    if coalesce(trim(p_data->>'first_name'), '') = '' then
      raise exception 'We need your first name.';
    end if;
    if coalesce(trim(p_data->>'emergency_name'), '') = ''
       or coalesce(trim(p_data->>'emergency_phone'), '') = '' then
      raise exception 'We need an emergency contact name and phone.';
    end if;

    v_dob := nullif(trim(p_data->>'date_of_birth'), '')::date;
    if v_dob is null then
      raise exception 'We need your date of birth.';
    end if;
    if v_dob > current_date - interval '18 years' then
      raise exception 'You must be 18 or older to play.';
    end if;

    update public.members
       set first_name = trim(p_data->>'first_name'),
           last_name = coalesce(nullif(trim(p_data->>'last_name'), ''), last_name, ''),
           preferred_name = nullif(trim(p_data->>'preferred_name'), ''),
           pronouns = nullif(trim(p_data->>'pronouns'), ''),
           phone = nullif(trim(p_data->>'phone'), ''),
           date_of_birth = v_dob
     where id = v_reg.member_id;

    update public.registrations
       set emergency_name = trim(p_data->>'emergency_name'),
           emergency_phone = trim(p_data->>'emergency_phone'),
           emergency_relationship = nullif(trim(p_data->>'emergency_relationship'), ''),
           updated_at = now()
     where id = p_registration;

  elsif p_step = 2 then
    v_positions := coalesce(
      (select array_agg(trim(x)) from jsonb_array_elements_text(coalesce(p_data->'positions_played', '[]'::jsonb)) x
        where trim(x) <> ''),
      '{}');
    if p_data->>'qb_willing' is not null
       and p_data->>'qb_willing' not in ('yes', 'reluctant', 'no') then
      raise exception 'invalid quarterback answer';
    end if;

    insert into public.player_profiles (
      org_id, program_id, member_id, registration_id, positions_played, preferred_offense,
      preferred_defense, qb_willing, qb_years, years_playing, experience_type, route_familiarity,
      athletic_history, height_ft, height_in, jersey_name, jersey_number, shirt_size
    ) values (
      v_reg.org_id, v_reg.program_id, v_reg.member_id, p_registration, v_positions,
      nullif(trim(p_data->>'preferred_offense'), ''),
      nullif(trim(p_data->>'preferred_defense'), ''),
      p_data->>'qb_willing',
      nullif(trim(p_data->>'qb_years'), ''),
      nullif(trim(p_data->>'years_playing'), ''),
      nullif(trim(p_data->>'experience_type'), ''),
      nullif(trim(p_data->>'route_familiarity'), ''),
      nullif(trim(p_data->>'athletic_history'), ''),
      nullif(trim(p_data->>'height_ft'), '')::integer,
      nullif(trim(p_data->>'height_in'), '')::integer,
      nullif(upper(trim(p_data->>'jersey_name')), ''),
      nullif(regexp_replace(coalesce(p_data->>'jersey_number', ''), '[^0-9]', '', 'g'), ''),
      nullif(trim(p_data->>'shirt_size'), '')
    )
    on conflict (registration_id) do update set
      positions_played = excluded.positions_played,
      preferred_offense = excluded.preferred_offense,
      preferred_defense = excluded.preferred_defense,
      qb_willing = excluded.qb_willing,
      qb_years = excluded.qb_years,
      years_playing = excluded.years_playing,
      experience_type = excluded.experience_type,
      route_familiarity = excluded.route_familiarity,
      athletic_history = excluded.athletic_history,
      height_ft = excluded.height_ft,
      height_in = excluded.height_in,
      jersey_name = excluded.jersey_name,
      jersey_number = excluded.jersey_number,
      shirt_size = excluded.shirt_size,
      updated_at = now();

    update public.members
       set instagram_handle = nullif(ltrim(trim(p_data->>'instagram_handle'), '@'), '')
     where id = v_reg.member_id and jsonb_exists(p_data, 'instagram_handle');

    update public.registrations
       set heard_about = coalesce(nullif(trim(p_data->>'heard_about'), ''), heard_about),
           updated_at = now()
     where id = p_registration;

  elsif p_step = 5 then
    -- Media consent is the member's own field and lives outside the waiver. Any value
    -- lets them register; the waivers themselves go through accept_waiver().
    v_consent := p_data->>'media_consent';
    if v_consent is not null then
      if v_consent not in ('public', 'league_only', 'none') then
        raise exception 'invalid media consent';
      end if;
      update public.members
         set media_consent = v_consent, consent_at = now()
       where id = v_reg.member_id;
      if v_consent = 'none' then
        update public.media_tags t set status = 'removed' where t.member_id = v_reg.member_id;
      end if;
    end if;
  end if;

  perform public.touch_registration(p_registration, p_step);
end;
$$;

-- ---------------------------------------------------------------------------
-- Teammate requests
-- ---------------------------------------------------------------------------

create or replace function public.request_teammate(
  p_registration uuid,
  p_target_member uuid,
  p_name text default null,
  p_phone text default null,
  p_handle text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations := public.my_open_registration(p_registration);
  v_used integer;
  v_request uuid;
  v_target_registered boolean;
begin
  select count(*) into v_used
    from public.teammate_requests
   where registration_id = p_registration and status <> 'withdrawn';
  if v_used >= 2 then
    raise exception 'You can request at most 2 teammates.';
  end if;

  if p_target_member is not null then
    if p_target_member = v_reg.member_id then
      raise exception 'You cannot request yourself.';
    end if;
    select exists (
      select 1 from public.registrations r
       where r.program_id = v_reg.program_id and r.member_id = p_target_member
    ) into v_target_registered;
    if not v_target_registered then
      raise exception 'That player is not registered for this program.';
    end if;

    insert into public.teammate_requests (
      org_id, program_id, registration_id, requester_member_id, target_member_id, status, activated_at
    ) values (
      v_reg.org_id, v_reg.program_id, p_registration, v_reg.member_id, p_target_member, 'requested', now()
    )
    returning id into v_request;
  else
    if coalesce(nullif(trim(p_phone), ''), nullif(trim(p_handle), '')) is null then
      raise exception 'Add a phone number or an Instagram handle so we can reach them.';
    end if;
    insert into public.teammate_requests (
      org_id, program_id, registration_id, requester_member_id, invite_name, invite_phone,
      invite_handle, status
    ) values (
      v_reg.org_id, v_reg.program_id, p_registration, v_reg.member_id,
      nullif(trim(p_name), ''),
      nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), ''),
      nullif(ltrim(trim(coalesce(p_handle, '')), '@'), ''),
      'invited'
    )
    returning id into v_request;
  end if;

  perform public.touch_registration(p_registration, 3::smallint);
  return v_request;
end;
$$;

create or replace function public.withdraw_teammate_request(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reg uuid;
begin
  select registration_id into v_reg from public.teammate_requests where id = p_request;
  if v_reg is null then
    raise exception 'request not found';
  end if;
  perform public.my_open_registration(v_reg);
  update public.teammate_requests
     set status = 'withdrawn', withdrawn_at = now()
   where id = p_request;
end;
$$;

-- Registered players in this program, for the teammate search. First name and last
-- initial only, and it says whether they have already asked for you.
create or replace function public.teammate_candidates(p_registration uuid, p_query text default null)
returns table (
  member_id uuid, display_name text, initials text, requested_you boolean, already_requested boolean
) language plpgsql stable security definer set search_path = '' as $$
declare
  v_reg public.registrations := public.my_open_registration(p_registration);
  v_q text := nullif(lower(trim(coalesce(p_query, ''))), '');
begin
  return query
    select m.id,
           trim(coalesce(m.preferred_name, m.first_name) || ' ' ||
                case when coalesce(m.last_name, '') = '' then '' else left(m.last_name, 1) || '.' end),
           upper(left(coalesce(m.preferred_name, m.first_name), 1) ||
                 case when coalesce(m.last_name, '') = '' then '' else left(m.last_name, 1) end),
           exists (
             select 1 from public.teammate_requests tr
              where tr.program_id = v_reg.program_id
                and tr.requester_member_id = m.id
                and tr.target_member_id = v_reg.member_id
                and tr.status <> 'withdrawn'
           ),
           exists (
             select 1 from public.teammate_requests tr
              where tr.registration_id = p_registration
                and tr.target_member_id = m.id
                and tr.status <> 'withdrawn'
           )
      from public.registrations r
      join public.members m on m.id = r.member_id
     where r.program_id = v_reg.program_id
       and r.member_id <> v_reg.member_id
       and r.status <> 'cancelled'
       and (
         v_q is null
         or lower(coalesce(m.preferred_name, '') || ' ' || m.first_name || ' ' || coalesce(m.last_name, '')) like '%' || v_q || '%'
         or lower(coalesce(m.instagram_handle, '')) like '%' || ltrim(v_q, '@') || '%'
       )
     order by 2
     limit 20;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sub availability
-- ---------------------------------------------------------------------------

create or replace function public.set_sub_availability(
  p_registration uuid,
  p_enabled boolean,
  p_locations text[] default '{}',
  p_nights text[] default '{}',
  p_notice_hours integer default null,
  p_positions text[] default '{}'
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations := public.my_open_registration(p_registration);
  v_on boolean := coalesce(p_enabled, false);
begin
  insert into public.sub_availability (
    registration_id, org_id, program_id, member_id, enabled, locations, nights, notice_hours, positions
  ) values (
    p_registration, v_reg.org_id, v_reg.program_id, v_reg.member_id, v_on,
    case when v_on then coalesce(p_locations, '{}') else '{}' end,
    case when v_on then coalesce(p_nights, '{}') else '{}' end,
    case when v_on then p_notice_hours else null end,
    case when v_on then coalesce(p_positions, '{}') else '{}' end
  )
  on conflict (registration_id) do update set
    enabled = excluded.enabled,
    locations = excluded.locations,
    nights = excluded.nights,
    notice_hours = excluded.notice_hours,
    positions = excluded.positions,
    updated_at = now();

  perform public.touch_registration(p_registration, 4::smallint);
end;
$$;

-- ---------------------------------------------------------------------------
-- Agreements
-- ---------------------------------------------------------------------------

create or replace function public.accept_waiver(
  p_registration uuid,
  p_versions uuid[],
  p_ip text default null,
  p_user_agent text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations := public.my_open_registration(p_registration);
  v_version uuid;
  v_kind text;
begin
  if p_versions is null or cardinality(p_versions) = 0 then
    raise exception 'Nothing to accept.';
  end if;

  foreach v_version in array p_versions loop
    select kind into v_kind
      from public.waiver_versions
     where id = v_version and org_id = v_reg.org_id and retired_at is null;
    if v_kind is null then
      raise exception 'That agreement is out of date. Reload the page and read the current one.';
    end if;

    insert into public.waiver_acceptances (
      org_id, waiver_version_id, member_id, registration_id, ip, user_agent
    ) values (
      v_reg.org_id, v_version, v_reg.member_id, p_registration,
      nullif(trim(coalesce(p_ip, '')), '')::inet, nullif(trim(coalesce(p_user_agent, '')), '')
    )
    on conflict (waiver_version_id, member_id) do update
      set registration_id = coalesce(public.waiver_acceptances.registration_id, excluded.registration_id);
  end loop;

  perform public.touch_registration(p_registration, 5::smallint);
end;
$$;

-- Every agreement the player still has to accept for this program.
create or replace function public.required_waivers(p_registration uuid)
returns table (id uuid, kind text, version_label text, body text, accepted_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_reg public.registrations := public.my_open_registration(p_registration);
begin
  return query
    select w.id, w.kind, w.version_label, w.body, a.accepted_at
      from public.waiver_versions w
      left join public.waiver_acceptances a
        on a.waiver_version_id = w.id and a.member_id = v_reg.member_id
     where w.org_id = v_reg.org_id and w.retired_at is null
     order by case w.kind when 'liability' then 1 when 'refund_policy' then 2 else 3 end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payment handoff and completion
-- ---------------------------------------------------------------------------

-- Phase one: no money moves here. This records the plan, holds the spot for 15
-- minutes and returns where to send the player (LeagueApps) to actually pay.
create or replace function public.begin_payment_handoff(
  p_registration uuid,
  p_plan text default 'full',
  p_discount_code text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations := public.my_open_registration(p_registration);
  v_program public.programs;
  v_amount integer;
  v_hold timestamptz := now() + interval '15 minutes';
begin
  if v_reg.status = 'complete' then
    raise exception 'This registration is already paid.';
  end if;
  if coalesce(p_plan, 'full') not in ('full', 'plan') then
    raise exception 'unknown payment option';
  end if;
  if v_reg.last_completed_step < 5 then
    raise exception 'Finish the agreements first.';
  end if;

  select * into v_program from public.programs where id = v_reg.program_id;
  v_amount := nullif(v_program.fees->>'amount_cents', '')::integer;

  update public.registrations
     set status = 'pending_payment',
         payment_plan = coalesce(p_plan, 'full'),
         discount_code = nullif(upper(trim(coalesce(p_discount_code, ''))), ''),
         amount_due_cents = v_amount,
         hold_expires_at = v_hold,
         handed_off_at = now(),
         last_completed_step = greatest(last_completed_step, 6),
         updated_at = now()
   where id = p_registration;

  return jsonb_build_object(
    'registration_id', p_registration,
    'payment_url', v_program.payment_url,
    'amount_cents', v_amount,
    'hold_expires_at', v_hold
  );
end;
$$;

-- Called when the player comes back from LeagueApps. Puts them in the pool (or on
-- their BYOT team), and turns the teammate requests they filed into live ones.
create or replace function public.complete_registration(
  p_registration uuid,
  p_payment_reference text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations := public.my_open_registration(p_registration);
  v_role text := 'player';
begin
  if v_reg.status = 'complete' then
    return jsonb_build_object('registration_id', p_registration, 'status', 'complete');
  end if;
  if v_reg.last_completed_step < 5 then
    raise exception 'Finish the agreements first.';
  end if;

  if v_reg.role_choice = 'captain' then
    v_role := 'captain';
  elsif v_reg.role_choice = 'free_agent' then
    v_role := 'free_agent';
  end if;

  -- numbers are unique within a team, so say so in words before the index does
  if v_reg.team_id is not null and exists (
    select 1
      from public.player_profiles pp
      join public.roster_spots rs
        on rs.team_id = v_reg.team_id and rs.jersey_number = pp.jersey_number
     where pp.registration_id = p_registration
       and pp.jersey_number is not null
       and rs.member_id <> v_reg.member_id
  ) then
    raise exception 'Someone on your team already has that number. Pick another one on the profile step.';
  end if;

  insert into public.roster_spots (org_id, program_id, team_id, member_id, role, source, jersey_number, positions)
  select v_reg.org_id, v_reg.program_id, v_reg.team_id, v_reg.member_id, v_role, 'registered',
         pp.jersey_number, coalesce(pp.positions_played, '{}')
    from public.registrations r
    left join public.player_profiles pp on pp.registration_id = r.id
   where r.id = p_registration
  on conflict (program_id, member_id) do update
    set team_id = coalesce(excluded.team_id, public.roster_spots.team_id),
        role = excluded.role,
        jersey_number = coalesce(excluded.jersey_number, public.roster_spots.jersey_number),
        positions = case when cardinality(excluded.positions) > 0
                         then excluded.positions else public.roster_spots.positions end;

  update public.registrations
     set status = 'complete',
         paid_at = now(),
         payment_reference = coalesce(nullif(trim(coalesce(p_payment_reference, '')), ''), payment_reference),
         hold_expires_at = null,
         completed_at = now(),
         last_completed_step = 6,
         updated_at = now()
   where id = p_registration;

  return jsonb_build_object('registration_id', p_registration, 'status', 'complete');
end;
$$;

-- ---------------------------------------------------------------------------
-- Everything the registration screens read back
-- ---------------------------------------------------------------------------

create or replace function public.my_registration(p_program uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_reg public.registrations;
  v_member public.members;
begin
  select r.* into v_reg
    from public.registrations r
    join public.members m on m.id = r.member_id
   where r.program_id = p_program and m.user_id = (select auth.uid());
  if v_reg.id is null then
    return null;
  end if;
  select * into v_member from public.members where id = v_reg.member_id;

  return jsonb_build_object(
    'registration', jsonb_build_object(
      'id', v_reg.id,
      'program_id', v_reg.program_id,
      'member_id', v_reg.member_id,
      'status', v_reg.status,
      'last_completed_step', v_reg.last_completed_step,
      'role_choice', v_reg.role_choice,
      'team_id', v_reg.team_id,
      'emergency_name', v_reg.emergency_name,
      'emergency_phone', v_reg.emergency_phone,
      'emergency_relationship', v_reg.emergency_relationship,
      'heard_about', v_reg.heard_about,
      'payment_plan', v_reg.payment_plan,
      'discount_code', v_reg.discount_code,
      'amount_due_cents', v_reg.amount_due_cents,
      'hold_expires_at', v_reg.hold_expires_at,
      'paid_at', v_reg.paid_at
    ),
    'member', jsonb_build_object(
      'id', v_member.id,
      'email', v_member.email,
      'first_name', v_member.first_name,
      'last_name', v_member.last_name,
      'preferred_name', v_member.preferred_name,
      'pronouns', v_member.pronouns,
      'phone', v_member.phone,
      'date_of_birth', v_member.date_of_birth,
      'instagram_handle', v_member.instagram_handle,
      'photo_path', v_member.photo_path,
      'media_consent', v_member.media_consent
    ),
    'profile', (
      select to_jsonb(pp) - 'org_id' from public.player_profiles pp where pp.registration_id = v_reg.id
    ),
    'sub_availability', (
      select to_jsonb(sa) - 'org_id' from public.sub_availability sa where sa.registration_id = v_reg.id
    ),
    'teammate_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', tr.id,
               'status', tr.status,
               'target_member_id', tr.target_member_id,
               'name', coalesce(
                 trim(coalesce(tm.preferred_name, tm.first_name) || ' ' ||
                      case when coalesce(tm.last_name, '') = '' then '' else left(tm.last_name, 1) || '.' end),
                 tr.invite_name, tr.invite_handle, tr.invite_phone),
               'initials', upper(coalesce(
                 left(coalesce(tm.preferred_name, tm.first_name), 1) ||
                   case when coalesce(tm.last_name, '') = '' then '' else left(tm.last_name, 1) end,
                 left(coalesce(tr.invite_name, tr.invite_handle, '?'), 2))),
               'mutual', exists (
                 select 1 from public.teammate_requests back
                  where back.program_id = tr.program_id
                    and back.requester_member_id = tr.target_member_id
                    and back.target_member_id = tr.requester_member_id
                    and back.status <> 'withdrawn'
               )
             ) order by tr.created_at)
        from public.teammate_requests tr
        left join public.members tm on tm.id = tr.target_member_id
       where tr.registration_id = v_reg.id and tr.status <> 'withdrawn'
    ), '[]'::jsonb),
    'agreements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', w.id, 'kind', w.kind, 'version_label', w.version_label,
               'body', w.body, 'accepted_at', a.accepted_at)
             order by case w.kind when 'liability' then 1 when 'refund_policy' then 2 else 3 end)
        from public.waiver_versions w
        left join public.waiver_acceptances a
          on a.waiver_version_id = w.id and a.member_id = v_reg.member_id
       where w.org_id = v_reg.org_id and w.retired_at is null
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- BYOT: teams, join codes, approvals. The screens land in a later step; the rules
-- live here so joining is checked in one place.
-- ---------------------------------------------------------------------------

create or replace function public.new_join_code()
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- no I, L, O, 0, 1
  v_code text;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.teams where join_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Seats left on a team, and how the coed rule stands.
create or replace function public.team_capacity(p_team uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_team public.teams;
  v_program public.programs;
  v_total integer;
  v_men integer;
  v_women integer;
begin
  select * into v_team from public.teams where id = p_team;
  if v_team.id is null then
    raise exception 'team not found';
  end if;
  select * into v_program from public.programs where id = v_team.program_id;

  select count(*),
         count(*) filter (where m.gender = 'man'),
         count(*) filter (where m.gender = 'woman')
    into v_total, v_men, v_women
    from public.roster_spots rs
    join public.members m on m.id = rs.member_id
   where rs.team_id = p_team;

  return jsonb_build_object(
    'team_id', p_team,
    'rostered', v_total,
    'roster_cap', v_program.roster_cap,
    'seats_left', case when v_program.roster_cap is null then null else greatest(v_program.roster_cap - v_total, 0) end,
    'men', v_men,
    'women', v_women,
    'min_men', nullif(v_program.composition_rules->>'min_men', '')::integer,
    'min_women', nullif(v_program.composition_rules->>'min_women', '')::integer,
    'full', v_program.roster_cap is not null and v_total >= v_program.roster_cap
  );
end;
$$;

create or replace function public.create_team(p_registration uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations := public.my_open_registration(p_registration);
  v_program public.programs;
  v_team uuid;
  v_code text := public.new_join_code();
begin
  select * into v_program from public.programs where id = v_reg.program_id;
  if v_program.format_type <> 'BYOT' then
    raise exception 'This league drafts teams. There is no captain option.';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Your team needs a name.';
  end if;
  if v_reg.team_id is not null then
    raise exception 'You are already on a team in this program.';
  end if;

  insert into public.teams (org_id, program_id, name, join_code, captain_member_id, created_by_registration)
  values (v_reg.org_id, v_reg.program_id, trim(p_name), v_code, v_reg.member_id, p_registration)
  returning id into v_team;

  update public.registrations
     set role_choice = 'captain', team_id = v_team, updated_at = now()
   where id = p_registration;

  return jsonb_build_object('team_id', v_team, 'join_code', v_code);
end;
$$;

create or replace function public.join_team_by_code(p_registration uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations := public.my_open_registration(p_registration);
  v_team public.teams;
  v_cap jsonb;
begin
  select * into v_team
    from public.teams
   where program_id = v_reg.program_id and join_code = upper(trim(coalesce(p_code, '')));
  if v_team.id is null then
    raise exception 'That join code does not match a team in this program.';
  end if;

  v_cap := public.team_capacity(v_team.id);
  if (v_cap->>'full')::boolean then
    raise exception 'That team is full. Ask the captain to put you on the waitlist.';
  end if;

  update public.registrations
     set role_choice = 'join_team', team_id = v_team.id, updated_at = now()
   where id = p_registration;

  return jsonb_build_object('team_id', v_team.id, 'team_name', v_team.name);
end;
$$;

create or replace function public.request_to_join(p_registration uuid, p_team uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations := public.my_open_registration(p_registration);
  v_team public.teams;
  v_cap jsonb;
  v_status text;
  v_request uuid;
begin
  select * into v_team from public.teams where id = p_team and program_id = v_reg.program_id;
  if v_team.id is null then
    raise exception 'team not found in this program';
  end if;

  v_cap := public.team_capacity(p_team);
  v_status := case when (v_cap->>'full')::boolean then 'waitlisted' else 'pending' end;

  insert into public.team_join_requests (org_id, program_id, team_id, registration_id, member_id, status)
  values (v_reg.org_id, v_reg.program_id, p_team, p_registration, v_reg.member_id, v_status)
  on conflict (team_id, member_id) do update
    set status = case when public.team_join_requests.status = 'declined' then excluded.status
                      else public.team_join_requests.status end
  returning id into v_request;

  update public.registrations
     set role_choice = 'join_team', updated_at = now()
   where id = p_registration and role_choice is null;

  return v_request;
end;
$$;

create or replace function public.approve_join(p_request uuid, p_approve boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_req public.team_join_requests;
  v_team public.teams;
  v_cap jsonb;
begin
  select * into v_req from public.team_join_requests where id = p_request;
  if v_req.id is null then
    raise exception 'request not found';
  end if;
  select * into v_team from public.teams where id = v_req.team_id;
  if not public.is_me(v_team.captain_member_id) and not public.is_org_admin(v_req.org_id) then
    raise exception 'only the captain can answer this';
  end if;

  if not coalesce(p_approve, true) then
    update public.team_join_requests
       set status = 'declined', decided_by = (select auth.uid()), decided_at = now()
     where id = p_request;
    return;
  end if;

  v_cap := public.team_capacity(v_req.team_id);
  if (v_cap->>'full')::boolean then
    raise exception 'That team is full.';
  end if;

  update public.team_join_requests
     set status = 'approved', decided_by = (select auth.uid()), decided_at = now()
   where id = p_request;

  update public.registrations
     set team_id = v_req.team_id, role_choice = 'join_team', updated_at = now()
   where id = v_req.registration_id;

  -- someone who already paid moves onto the roster right away
  update public.roster_spots
     set team_id = v_req.team_id
   where program_id = v_req.program_id and member_id = v_req.member_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Everything is SECURITY DEFINER and checks the caller inside; the two
-- program listings are deliberately public, because the marketing pages are.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.is_me(uuid), public.ensure_member(uuid), public.my_open_registration(uuid),
  public.touch_registration(uuid, smallint), public.new_join_code(),
  public.program_public(uuid), public.open_programs(),
  public.start_registration(uuid), public.save_registration_step(uuid, smallint, jsonb),
  public.request_teammate(uuid, uuid, text, text, text), public.withdraw_teammate_request(uuid),
  public.teammate_candidates(uuid, text),
  public.set_sub_availability(uuid, boolean, text[], text[], integer, text[]),
  public.accept_waiver(uuid, uuid[], text, text), public.required_waivers(uuid),
  public.begin_payment_handoff(uuid, text, text), public.complete_registration(uuid, text),
  public.my_registration(uuid), public.team_capacity(uuid), public.create_team(uuid, text),
  public.join_team_by_code(uuid, text), public.request_to_join(uuid, uuid),
  public.approve_join(uuid, boolean)
from public, anon, authenticated;

grant execute on function
  public.is_me(uuid),
  public.program_public(uuid), public.open_programs(),
  public.start_registration(uuid), public.save_registration_step(uuid, smallint, jsonb),
  public.request_teammate(uuid, uuid, text, text, text), public.withdraw_teammate_request(uuid),
  public.teammate_candidates(uuid, text),
  public.set_sub_availability(uuid, boolean, text[], text[], integer, text[]),
  public.accept_waiver(uuid, uuid[], text, text), public.required_waivers(uuid),
  public.begin_payment_handoff(uuid, text, text), public.complete_registration(uuid, text),
  public.my_registration(uuid), public.team_capacity(uuid), public.create_team(uuid, text),
  public.join_team_by_code(uuid, text), public.request_to_join(uuid, uuid),
  public.approve_join(uuid, boolean)
to authenticated;

-- signed-out visitors see programs and nothing else
grant execute on function public.program_public(uuid), public.open_programs() to anon;

-- ---------------------------------------------------------------------------
-- Storage: a player may write their own headshot under {org_id}/profiles/
-- ---------------------------------------------------------------------------

-- Each upload writes a new file name, so inserting is all a player ever needs.
create policy "players upload own headshot" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'media'
    and (storage.foldername(name))[2] = 'profiles'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );
