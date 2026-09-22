# PlayMakers platform

League app for PlayMakers Club. First release is the **Fall 26 all-star voting pilot**:
roster import, email sign-in links, media consent, in-app all-star voting, and a commissioner
view with live tallies, final selections and an embargo until results are announced.

Spec: `season-lifecycle.md` and `registration-spec.md` in the "flag football v2" Claude project.

## Stack

Next.js 15 (App Router) · Supabase (Postgres, Auth, Storage) · Tailwind 4 · hosted on Cloudflare Workers
via the OpenNext adapter (`@opennextjs/cloudflare`).

## Run locally

```bash
cp .env.example .env.local   # fill in the Supabase URL and publishable key
npm install
npm run dev
```

## Deploy (Cloudflare Workers)

Config lives in `wrangler.jsonc` and `open-next.config.ts`. The Worker is named `playmakers-platform`.

- **Automatic:** the Cloudflare Worker is connected to this GitHub repo (Workers Builds). Every push to
  `main` builds with `npx opennextjs-cloudflare build` and deploys with `npx opennextjs-cloudflare deploy`.
- **Manual:** `npm run deploy` (runs `wrangler login` the first time).
- `npm run preview` builds and runs the Worker locally in the Cloudflare runtime.

`NEXT_PUBLIC_*` values are baked in at build time, so set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as **build variables** in the Worker's Settings > Build.
Compressed Worker size is about 1.3 MB, under the 3 MB free-plan limit.

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
   production domain (e.g. `https://playmakers-platform.<account>.workers.dev`) and add `https://<domain>/auth/callback` (and `http://localhost:3000/auth/callback`
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

## Registration (DRAFT flow)

`/register/[programId]` is the player-facing registration for a DRAFT program: program page,
then six steps that each save before moving on (about you, player profile, teammate requests,
sub availability, agreements, payment), then a confirmation. The program page is readable
signed out; every step needs a login and comes back to the program page after sign-in.

Design source: `design/mockups/*.dc.html` and `design/HANDOFF.md`. Shared form pieces live in
`src/components/form.tsx`.

Rules the schema enforces, not just the UI:

- `qb_willing` is three states (yes / reluctant / no), never a boolean.
- Height is two integers (`height_ft`, `height_in`).
- At most 2 teammate requests per registration, and a request only counts when it is mutual.
  Someone who hasn't registered is held by phone or handle and matched when they do.
- Sub availability is off by default; turning it off clears the locations, nights and notice.
- Media consent stays a member field, outside the waiver. Any value lets a player register.
- Waivers are versioned; acceptance is recorded by version id with a timestamp and IP.
- Jersey numbers are unique within a team (partial unique index on `roster_spots`).

**Payment is a handoff, not a checkout.** `begin_payment_handoff()` records the plan, holds the
spot for 15 minutes and returns the program's LeagueApps URL; the player comes back to
`/register/[programId]/return`, which calls `complete_registration()`. Nothing verifies the
payment — there is no webhook and no order lookup — and no money moves through this app.
`credit_ledger` and `refund_requests` exist as records only. A program with no `payment_url`
set shows `/register/[programId]/handoff` explaining that instead.

## Not built yet

BYOT branch (schema and RPCs exist, screens do not), public homepage at `/`, commissioner
registration list and QB supply counter, media upload and tagging UI (tables, storage bucket
and policies exist), highlight reels, open play evaluation, draft room, real payments.
