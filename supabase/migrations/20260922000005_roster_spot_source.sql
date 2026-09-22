-- Two fixes to complete_registration, found testing the flow against the demo league:
--
-- 1. A player already on the roster from the CSV import kept source = 'import' after
--    registering, so nothing on the roster said they had actually registered.
-- 2. The upsert wrote role = 'player' over an imported captain's row, because a DRAFT
--    registration has no role_choice of its own. Keep the role that is already there
--    unless the registration claims one.

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
        -- they registered, whatever put them on the roster first
        source = 'registered',
        -- only a BYOT role choice overrides the role already on the spot
        role = case when excluded.role = 'player' then public.roster_spots.role else excluded.role end,
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

revoke execute on function public.complete_registration(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_registration(uuid, text) to authenticated;
