-- Jersey number and positions per roster spot (both can change season to season).
-- Positions use the registration form's vocabulary: QB, WR, RB, C, Rusher, CB, S, LB.

alter table public.roster_spots
  add column jersey_number text check (jersey_number ~ '^[0-9]{1,3}$'),
  add column positions text[] not null default '{}';

-- Return types change, so drop and recreate.
drop function if exists public.program_candidates(uuid);
drop function if exists public.award_tallies(uuid);

create function public.program_candidates(p_program uuid)
returns table (
  member_id uuid, display_name text, team_name text, is_rookie boolean, photo_path text,
  jersey_number text, positions text[]
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_view_program(p_program) then
    raise exception 'not allowed';
  end if;
  return query
    select m.id,
           trim(coalesce(m.preferred_name, m.first_name) || ' ' || m.last_name),
           t.name, rs.is_rookie, m.photo_path, rs.jersey_number, rs.positions
      from public.roster_spots rs
      join public.members m on m.id = rs.member_id
      left join public.teams t on t.id = rs.team_id
     where rs.program_id = p_program
     order by t.name nulls last, 2;
end;
$$;

create function public.award_tallies(p_program uuid)
returns table (
  category_id uuid, category_label text, sort_order integer, slots integer,
  member_id uuid, display_name text, team_name text, is_rookie boolean,
  jersey_number text, positions text[],
  votes bigint, selected boolean
) language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_program_admin(p_program);
  return query
    select c.id, c.label, c.sort_order, c.slots, m.id,
           trim(coalesce(m.preferred_name, m.first_name) || ' ' || m.last_name),
           t.name, rs.is_rookie, rs.jersey_number, rs.positions,
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
     group by c.id, c.label, c.sort_order, c.slots, m.id, m.preferred_name, m.first_name, m.last_name,
              t.name, rs.is_rookie, rs.jersey_number, rs.positions
     order by c.sort_order, count(bc.ballot_id) desc, 6;
end;
$$;

-- Import accepts jersey_number (digits) and positions (array of strings).
create or replace function public.import_roster(p_program uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := public.require_program_admin(p_program);
  v_row jsonb;
  v_team uuid;
  v_member uuid;
  v_email text;
  v_jersey text;
  v_positions text[];
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

    v_jersey := nullif(regexp_replace(coalesce(v_row->>'jersey_number', ''), '[^0-9]', '', 'g'), '');
    if v_jersey is not null and length(v_jersey) > 3 then v_jersey := null; end if;
    v_positions := coalesce(
      (select array_agg(trim(x)) from jsonb_array_elements_text(coalesce(v_row->'positions', '[]'::jsonb)) x
        where trim(x) <> ''),
      '{}');

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

    insert into public.roster_spots (org_id, program_id, team_id, member_id, role, is_rookie, source,
                                     jersey_number, positions)
    values (
      v_org, p_program, v_team, v_member,
      case when lower(coalesce(v_row->>'role', '')) in ('captain', 'player', 'free_agent')
           then lower(v_row->>'role') else 'player' end,
      coalesce((v_row->>'is_rookie')::boolean, false),
      'import', v_jersey, v_positions
    )
    on conflict (program_id, member_id) do update
      set team_id = excluded.team_id, role = excluded.role, is_rookie = excluded.is_rookie,
          jersey_number = coalesce(excluded.jersey_number, public.roster_spots.jersey_number),
          positions = case when cardinality(excluded.positions) > 0 then excluded.positions
                           else public.roster_spots.positions end
    returning (xmax = 0) into v_inserted;

    if v_inserted then v_added := v_added + 1; else v_updated := v_updated + 1; end if;
  end loop;

  return jsonb_build_object('added', v_added, 'updated', v_updated, 'skipped', v_skipped);
end;
$$;

revoke execute on function public.program_candidates(uuid), public.award_tallies(uuid)
  from public, anon;
grant execute on function public.program_candidates(uuid), public.award_tallies(uuid)
  to authenticated;
