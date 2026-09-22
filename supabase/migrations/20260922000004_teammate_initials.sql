-- Initials for an invited teammate came from the first two letters of their name
-- ("Sam M." read as SA). Take the first letter of each of the first two words instead.

create or replace function public.initials_of(p_name text)
returns text language sql immutable set search_path = '' as $$
  select nullif(
    upper(coalesce(substring(p_name from '([[:alnum:]])'), '')
       || coalesce(substring(p_name from '[[:alnum:]][^[:space:]]*[[:space:]]+([[:alnum:]])'), '')),
    '');
$$;

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

revoke execute on function public.initials_of(text), public.my_registration(uuid)
  from public, anon, authenticated;
grant execute on function public.my_registration(uuid) to authenticated;
