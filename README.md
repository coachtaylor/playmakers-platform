# PlayMakers platform

League app for PlayMakers Club. First release is the **Fall 26 all-star voting pilot**:
roster import, email sign-in links, media consent, in-app all-star voting, and a commissioner
view with live tallies, final selections and an embargo until results are announced.

Spec: `season-lifecycle.md` and `registration-spec.md` in the "flag football v2" Claude project.

## Stack

Next.js 15 (App Router) · Supabase (Postgres, Auth, Storage) · Tailwind 4 · deploy on Vercel.

## Run locally

```bash
cp .env.example .env.local   # fill in the Supabase URL and publishable key
npm install
npm run dev
```

## Database

Migrations live in `supabase/migrations/` and are already applied to the `playmakers-platform`
Supabase project (us-west-1). `supabase/seed.sql` loads a demo league: 42 fictional players on six
teams in "Women's 5v5 Flag Football (DRAFT) Tempe Wednesdays", voting open, plus an owner invite
for the project owner. Re-running the seed wipes and recreates the demo org.

Design rules the schema enforces:

- Every table carries `org_id` and has row level security. Players read only their own league.
- Players never see other players' emails. Ballot candidate cards come from `program_candidates()`.
- Ballots are written only through `submit_ballot()`, which checks the voting window, roster
  membership, slot limits, rookie/veteran eligibility and blocks self-votes.
- Vote totals are commissioner-only (`award_tallies()`). Final selections are the commissioner's
  call and stay hidden from players until `set_results_published()`.
- Media consent has three states (public, league only, none). A player who picks "none" cannot be
  tagged, and existing tags are removed.

The Supabase security advisor flags the `SECURITY DEFINER` RPCs as callable by signed-in users.
That is intentional: each one checks the caller's role inside the function.

## Roles

- **Player**: any member row whose email matches a login.
- **Commissioner** (`owner` / `admin`) and **photographer**: rows in `org_staff`. Add someone by
  inserting a `staff_invites` row with their email and role; it converts on their next sign-in.

```sql
insert into staff_invites (org_id, email, role)
select id, 'cheyenne@example.com', 'owner' from organizations where slug = 'playmakers';
```

## Before real players get invited

1. **Auth URLs**: Supabase dashboard > Authentication > URL Configuration. Set Site URL to the
   production domain and add `https://<domain>/auth/callback` (and `http://localhost:3000/auth/callback`
   for local work) to Redirect URLs.
2. **Email sending**: Supabase's built-in sender is rate limited to a few emails an hour. Connect
   custom SMTP (Resend, Postmark) with a verified sending domain before inviting a league.
3. **Cheyenne's approval** to load her roster, and of the email players receive.
4. **Reset the demo**: delete the demo org (`delete from organizations where slug = 'playmakers'`)
   before importing the real roster, or rename it.

## Commissioner flow

1. `/admin` > league > **Import roster**: upload the LeagueApps CSV. Email and first name are
   required; last name, team, role and rookie are used when present. Re-importing updates in place.
2. Set the voting window (Phoenix time).
3. Watch turnout and tallies. Tick the players you're selecting in each category.
4. Announce at the party, then **Publish results to players**.

## Not built yet

Media upload and tagging UI (tables, storage bucket and policies exist), highlight reels,
open play evaluation, draft room, registration and payments.
