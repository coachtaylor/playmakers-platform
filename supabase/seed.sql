-- Demo data for the Fall 26 pilot. Every player here is fictional (example.com emails)
-- except the owner invite and one roster row for the project owner, so the flow can be
-- tested end to end. Safe to re-run: it clears the demo org first.

delete from public.organizations where slug = 'playmakers';

with org as (
  insert into public.organizations (name, slug) values ('PlayMakers Club', 'playmakers') returning id
), season as (
  insert into public.seasons (org_id, label, starts_on, ends_on)
  select id, 'Fall 26', '2026-09-23', '2026-12-02' from org returning id, org_id
), program as (
  insert into public.programs (
    org_id, season_id, name, sport, format, format_type, division, location_name, day_of_week,
    voting_opens_at, voting_closes_at
  )
  select org_id, id, 'Women''s 5v5 Flag Football (DRAFT) Tempe Wednesdays', 'flag_football', '5v5',
         'DRAFT', 'womens', 'Benedict Sports Complex, Tempe', 'Wednesday',
         now() - interval '1 hour', '2026-11-20 23:59:00-07'
    from season returning id, org_id
), cats as (
  insert into public.award_categories (org_id, program_id, kind, label, slots, eligibility, sort_order)
  select org_id, id, k.kind, k.label, k.slots, k.eligibility, k.sort_order
    from program,
         (values ('rookie', 'Rookie All-Star', 5, 'rookie', 1),
                 ('allstar', 'All-Star', 5, 'any', 2),
                 ('veteran', 'Veteran All-Star', 5, 'veteran', 3)) as k(kind, label, slots, eligibility, sort_order)
  returning id
), invite as (
  insert into public.staff_invites (org_id, email, role)
  select id, 'coachtaylorp04@gmail.com', 'owner' from org returning id
)
select 1;

-- Roster: six teams of seven, two rookies each, plus the project owner on Team Sidewinders.
do $$
declare
  v_program uuid := (select id from public.programs where name like 'Women''s 5v5%' order by created_at desc limit 1);
  v_rows jsonb := '[]'::jsonb;
  v_teams text[] := array['Sidewinders', 'Haboobs', 'Monsoon', 'Saguaros', 'Javelinas', 'Roadrunners'];
  v_first text[] := array['Ava','Bri','Carmen','Dani','Elena','Faith','Gia','Hana','Isla','Jade','Kira','Lena',
                          'Maya','Nia','Olive','Priya','Quinn','Rosa','Sky','Tess','Uma','Val','Wren','Ximena',
                          'Yara','Zoe','Aria','Bella','Cleo','Dahlia','Esme','Fern','Gwen','Hazel','Ines','Juno',
                          'Kai','Luz','Mila','Noor','Opal','Paz'];
  v_last text[] := array['Alvarez','Brooks','Chen','Diaz','Ellis','Flores','Garcia','Hughes','Ito','Jones','Kim','Lopez',
                         'Morales','Nguyen','Ortiz','Patel','Quintero','Reyes','Silva','Torres','Underwood','Vega','Walker','Xu',
                         'Young','Zamora','Avila','Bennett','Castro','Delgado','Espinoza','Fox','Gomez','Hall','Ibarra','James',
                         'Khan','Lee','Mendez','Nash','Owens','Price'];
  i integer;
begin
  for i in 1..42 loop
    v_rows := v_rows || jsonb_build_object(
      'email', 'player' || lpad(i::text, 2, '0') || '@example.com',
      'first_name', v_first[i],
      'last_name', v_last[i],
      'team', v_teams[((i - 1) / 7) + 1],
      'role', case when (i - 1) % 7 = 0 then 'captain' else 'player' end,
      'is_rookie', (i - 1) % 7 in (5, 6)
    );
  end loop;
  v_rows := v_rows || jsonb_build_object(
    'email', 'coachtaylorp04@gmail.com', 'first_name', 'Taylor', 'last_name', 'Pangilinan',
    'team', 'Sidewinders', 'role', 'player', 'is_rookie', false
  );

  -- direct inserts (import_roster requires a signed-in commissioner)
  insert into public.teams (org_id, program_id, name)
  select p.org_id, p.id, t from public.programs p, unnest(v_teams) t where p.id = v_program;

  insert into public.members (org_id, email, first_name, last_name)
  select p.org_id, r->>'email', r->>'first_name', r->>'last_name'
    from public.programs p, jsonb_array_elements(v_rows) r where p.id = v_program;

  insert into public.roster_spots (org_id, program_id, team_id, member_id, role, is_rookie, source)
  select p.org_id, p.id, t.id, m.id, r->>'role', (r->>'is_rookie')::boolean, 'import'
    from public.programs p
    cross join jsonb_array_elements(v_rows) r
    join public.members m on m.org_id = p.org_id and lower(m.email) = lower(r->>'email')
    join public.teams t on t.program_id = p.id and t.name = r->>'team'
   where p.id = v_program;

  -- link the owner if they have already signed in once
  update public.members m set user_id = u.id
    from auth.users u
   where lower(u.email) = lower(m.email) and m.user_id is null;
end $$;
