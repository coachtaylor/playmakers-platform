-- Teammate invites: a revocable link per invite, and a match against players who are
-- already registered. See "Teammate invites" in design/HANDOFF.md.
--
-- Before this, an invite was held only by phone or handle, matched when the invitee
-- registered. Two problems: a text sent to a mistyped number stayed live forever, and
-- an invite to someone who had *already* registered never activated, silently burning
-- one of the two slots. Now every invite carries its own token, the link binds on that
-- token, changing the contact details mints a new one (killing the sent link), and a
-- contact that names a registered player binds at insert.

alter table public.teammate_requests
  add column if not exists invite_token text,
  add column if not exists invite_sent_at timestamptz;

create unique index if not exists teammate_requests_token
  on public.teammate_requests (invite_token)
  where invite_token is not null;

-- ---------------------------------------------------------------------------
-- Contact normalizing. Both paths read the same normal form, so a number that
-- matches a player also matches the invite row, and changing one changes both.
-- ---------------------------------------------------------------------------

-- Digits only, with the US country code dropped so "+1 602 555 0100" and
-- "(602) 555-0100" are the same number.
create or replace function public.digits_of(p_value text)
returns text language sql immutable set search_path = '' as $$
  select case when length(d) = 11 and left(d, 1) = '1' then right(d, 10) else d end
    from (select nullif(regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g'), '') as d) s;
$$;

create or replace function public.handle_of(p_value text)
returns text language sql immutable set search_path = '' as $$
  select nullif(lower(ltrim(trim(coalesce(p_value, '')), '@')), '');
$$;

-- Rows written before this migration kept a leading 1.
update public.teammate_requests
   set invite_phone = public.digits_of(invite_phone)
 where invite_phone is not null and invite_phone <> public.digits_of(invite_phone);

-- 32 hex characters from pg_strong_random, via gen_random_uuid.
create or replace function public.new_invite_token()
returns text language sql volatile set search_path = '' as $$
  select replace(gen_random_uuid()::text, '-', '');
$$;

-- The registered player a phone number or handle names, if any. Exact match on the
-- normal form only: no partial matching, so this cannot be used to probe around a
-- number. A phone needs all ten digits.
create or replace function public.match_registered_member(
  p_program uuid,
  p_phone text,
  p_handle text
) returns uuid language sql stable security definer set search_path = '' as $$
  select m.id
    from public.registrations r
    join public.members m on m.id = r.member_id
   where r.program_id = p_program
     and r.status <> 'cancelled'
     and (
       (p_phone is not null and length(p_phone) = 10 and public.digits_of(m.phone) = p_phone)
       or (p_handle is not null and public.handle_of(m.instagram_handle) = p_handle)
     )
   order by m.id
   limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Requesting, editing and withdrawing
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
  v_target uuid := p_target_member;
  v_phone text := public.digits_of(p_phone);
  v_handle text := public.handle_of(p_handle);
begin
  select count(*) into v_used
    from public.teammate_requests
   where registration_id = p_registration and status <> 'withdrawn';
  if v_used >= 2 then
    raise exception 'You can request at most 2 teammates.';
  end if;

  -- An invite by contact details may name someone who is already registered. Bind it
  -- now: waiting for a registration that already happened never activates.
  if v_target is null then
    if coalesce(v_phone, v_handle) is null then
      raise exception 'Add a phone number or an Instagram handle so we can reach them.';
    end if;
    v_target := public.match_registered_member(v_reg.program_id, v_phone, v_handle);
    if v_target = v_reg.member_id then
      raise exception 'Those are your own details. Add someone else.';
    end if;
  end if;

  if v_target is not null then
    if v_target = v_reg.member_id then
      raise exception 'You cannot request yourself.';
    end if;
    if not exists (
      select 1 from public.registrations r
       where r.program_id = v_reg.program_id and r.member_id = v_target and r.status <> 'cancelled'
    ) then
      raise exception 'That player is not registered for this program.';
    end if;
    if exists (
      select 1 from public.teammate_requests
       where registration_id = p_registration and target_member_id = v_target and status <> 'withdrawn'
    ) then
      raise exception 'You have already requested that player.';
    end if;

    -- The contact details stay on the row as the requester typed them, so the card can
    -- show what they entered rather than what the player has on their record.
    insert into public.teammate_requests (
      org_id, program_id, registration_id, requester_member_id, target_member_id,
      invite_name, invite_phone, invite_handle, status, activated_at
    ) values (
      v_reg.org_id, v_reg.program_id, p_registration, v_reg.member_id, v_target,
      nullif(trim(coalesce(p_name, '')), ''), v_phone, v_handle, 'requested', now()
    )
    returning id into v_request;
  else
    if exists (
      select 1 from public.teammate_requests
       where registration_id = p_registration and status <> 'withdrawn'
         and ((v_phone is not null and invite_phone = v_phone)
           or (v_handle is not null and invite_handle = v_handle))
    ) then
      raise exception 'You have already invited that person.';
    end if;

    insert into public.teammate_requests (
      org_id, program_id, registration_id, requester_member_id, invite_name, invite_phone,
      invite_handle, status, invite_token
    ) values (
      v_reg.org_id, v_reg.program_id, p_registration, v_reg.member_id,
      nullif(trim(coalesce(p_name, '')), ''), v_phone, v_handle, 'invited',
      public.new_invite_token()
    )
    returning id into v_request;
  end if;

  perform public.touch_registration(p_registration, 3::smallint);
  return v_request;
end;
$$;

-- Correcting an invite. Changing the number or the handle mints a new token, which
-- kills the link already sent: a text that went to the wrong person stops working as
-- soon as the player notices. A registered player's details are not editable here.
create or replace function public.update_teammate_invite(
  p_request uuid,
  p_name text default null,
  p_phone text default null,
  p_handle text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_row public.teammate_requests;
  v_reg public.registrations;
  v_phone text := public.digits_of(p_phone);
  v_handle text := public.handle_of(p_handle);
  v_target uuid;
  v_changed boolean;
begin
  select * into v_row from public.teammate_requests where id = p_request;
  if v_row.id is null then
    raise exception 'request not found';
  end if;
  v_reg := public.my_open_registration(v_row.registration_id);
  if v_row.status = 'withdrawn' then
    raise exception 'That request was already removed.';
  end if;
  if v_row.target_member_id is not null then
    raise exception 'That player is registered, so their name and number stay as they have them.';
  end if;
  if coalesce(v_phone, v_handle) is null then
    raise exception 'Add a phone number or an Instagram handle so we can reach them.';
  end if;

  v_changed := v_phone is distinct from v_row.invite_phone
            or v_handle is distinct from v_row.invite_handle;

  if v_changed and exists (
    select 1 from public.teammate_requests other
     where other.registration_id = v_row.registration_id
       and other.id <> v_row.id
       and other.status <> 'withdrawn'
       and ((v_phone is not null and other.invite_phone = v_phone)
         or (v_handle is not null and other.invite_handle = v_handle))
  ) then
    raise exception 'You have already invited that person.';
  end if;

  -- The corrected details may name someone who has registered in the meantime.
  v_target := public.match_registered_member(v_row.program_id, v_phone, v_handle);
  if v_target = v_reg.member_id then
    raise exception 'Those are your own details. Add someone else.';
  end if;
  if v_target is not null and exists (
    select 1 from public.teammate_requests dup
     where dup.registration_id = v_row.registration_id
       and dup.id <> v_row.id
       and dup.target_member_id = v_target
       and dup.status <> 'withdrawn'
  ) then
    raise exception 'You have already requested that player.';
  end if;

  update public.teammate_requests
     set invite_name = nullif(trim(coalesce(p_name, '')), ''),
         invite_phone = v_phone,
         invite_handle = v_handle,
         target_member_id = v_target,
         status = case when v_target is not null then 'requested' else 'invited' end,
         activated_at = case when v_target is not null then now() else activated_at end,
         -- a match retires the link; a changed contact replaces it; a name-only edit keeps it
         invite_token = case
                          when v_target is not null then null
                          when v_changed then public.new_invite_token()
                          else invite_token
                        end,
         invite_sent_at = case when v_changed then null else invite_sent_at end
   where id = p_request;

  return p_request;
end;
$$;

-- Removing a request kills its link too.
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
     set status = 'withdrawn', withdrawn_at = now(), invite_token = null
   where id = p_request;
end;
$$;

-- Records that the player sent the link, so the card can say so.
create or replace function public.mark_invite_sent(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reg uuid;
begin
  select registration_id into v_reg from public.teammate_requests where id = p_request;
  if v_reg is null then
    raise exception 'request not found';
  end if;
  perform public.my_open_registration(v_reg);
  update public.teammate_requests set invite_sent_at = now()
   where id = p_request and status = 'invited';
end;
$$;

-- ---------------------------------------------------------------------------
-- Opening an invite link
-- ---------------------------------------------------------------------------

-- What the program page shows to someone arriving on an invite link. Holding the token
-- is the only way to see this, and all it discloses is who invited them, in the same
-- "First L." form used everywhere else. Returns null for a revoked or unknown token,
-- which the page treats as "no longer active" and then carries on as normal.
create or replace function public.invite_preview(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'program_id', tr.program_id,
           'requester_name', trim(coalesce(m.preferred_name, m.first_name) || ' ' ||
             case when coalesce(m.last_name, '') = '' then '' else left(m.last_name, 1) || '.' end),
           'requester_initials', upper(left(coalesce(m.preferred_name, m.first_name), 1) ||
             case when coalesce(m.last_name, '') = '' then '' else left(m.last_name, 1) end),
           'invited_name', tr.invite_name
         )
    from public.teammate_requests tr
    join public.members m on m.id = tr.requester_member_id
   where tr.invite_token = nullif(trim(coalesce(p_token, '')), '')
     and tr.status = 'invited'
     and tr.target_member_id is null;
$$;

-- Attaches the member to the invite the link names. Silent when the token is unknown,
-- revoked, the requester's own, or would duplicate a request they already hold.
create or replace function public.bind_invite_token(p_program uuid, p_token text, p_member uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_token text := nullif(trim(coalesce(p_token, '')), '');
begin
  if v_token is null then
    return false;
  end if;
  select tr.id into v_id
    from public.teammate_requests tr
   where tr.invite_token = v_token
     and tr.program_id = p_program
     and tr.status = 'invited'
     and tr.target_member_id is null
     and tr.requester_member_id <> p_member
     and not exists (
       select 1 from public.teammate_requests dup
        where dup.registration_id = tr.registration_id
          and dup.target_member_id = p_member
          and dup.status <> 'withdrawn'
     );
  if v_id is null then
    return false;
  end if;
  update public.teammate_requests
     set target_member_id = p_member, status = 'requested', activated_at = now(), invite_token = null
   where id = v_id;
  return true;
end;
$$;

-- For someone who already had a registration open when they opened the link.
create or replace function public.claim_invite(p_registration uuid, p_invite text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations := public.my_open_registration(p_registration);
begin
  return public.bind_invite_token(v_reg.program_id, p_invite, v_reg.member_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Starting a registration, now with the invite token
-- ---------------------------------------------------------------------------

-- Replaced by the two-argument form below; dropped so a one-argument call is not
-- ambiguous between them.
drop function if exists public.start_registration(uuid);

create or replace function public.start_registration(p_program uuid, p_invite text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_program public.programs;
  v_member uuid;
  v_reg uuid;
  v_bound boolean;
  v_match uuid;
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

  -- The invite this person actually opened.
  v_bound := public.bind_invite_token(p_program, p_invite, v_member);

  -- Most people will not tap the link; they will come to the site and sign up. So a
  -- request held against their number or handle still activates on its own. One row at
  -- a time: the same person can hold two rows (invited by phone and by handle) and only
  -- one of them can name them.
  if not v_bound then
    select tr.id into v_match
      from public.teammate_requests tr
      join public.members m on m.id = v_member
     where tr.program_id = p_program
       and tr.target_member_id is null
       and tr.status = 'invited'
       and tr.requester_member_id <> v_member
       and (
         (tr.invite_phone is not null and tr.invite_phone = public.digits_of(m.phone))
         or (tr.invite_handle is not null and tr.invite_handle = public.handle_of(m.instagram_handle))
       )
       and not exists (
         select 1 from public.teammate_requests dup
          where dup.registration_id = tr.registration_id
            and dup.target_member_id = v_member
            and dup.status <> 'withdrawn'
       )
     order by tr.created_at
     limit 1;
    if v_match is not null then
      update public.teammate_requests
         set target_member_id = v_member, status = 'requested', activated_at = now(),
             invite_token = null
       where id = v_match;
    end if;
  end if;

  return v_reg;
end;
$$;

-- ---------------------------------------------------------------------------
-- my_registration: the teammate cards now carry the contact details and the link
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
               'initials', coalesce(
                 upper(left(coalesce(tm.preferred_name, tm.first_name), 1) ||
                   case when coalesce(tm.last_name, '') = '' then '' else left(tm.last_name, 1) end),
                 public.initials_of(tr.invite_name),
                 public.initials_of(ltrim(coalesce(tr.invite_handle, ''), '@')),
                 '?'),
               -- what the requester typed, never what the player has on their record
               'invite_name', tr.invite_name,
               'invite_phone', tr.invite_phone,
               'invite_handle', tr.invite_handle,
               'invite_token', tr.invite_token,
               'invite_sent_at', tr.invite_sent_at,
               -- an invite by contact details that turned out to name a registered player
               'matched_from_invite', tr.target_member_id is not null
                 and coalesce(tr.invite_phone, tr.invite_handle) is not null,
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
-- Grants. Helpers stay internal; invite_preview is public because the link is
-- opened before signing in.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.digits_of(text), public.handle_of(text), public.new_invite_token(),
  public.match_registered_member(uuid, text, text),
  public.bind_invite_token(uuid, text, uuid),
  public.start_registration(uuid, text), public.request_teammate(uuid, uuid, text, text, text),
  public.update_teammate_invite(uuid, text, text, text), public.withdraw_teammate_request(uuid),
  public.mark_invite_sent(uuid), public.claim_invite(uuid, text), public.invite_preview(text),
  public.my_registration(uuid)
from public, anon, authenticated;

grant execute on function
  public.start_registration(uuid, text), public.request_teammate(uuid, uuid, text, text, text),
  public.update_teammate_invite(uuid, text, text, text), public.withdraw_teammate_request(uuid),
  public.mark_invite_sent(uuid), public.claim_invite(uuid, text), public.invite_preview(text),
  public.my_registration(uuid)
to authenticated;

-- Someone opening an invite link has not signed in yet.
grant execute on function public.invite_preview(text) to anon;
