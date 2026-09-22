# Registration and public site: build handoff

Source of truth for the look: `design/mockups/*.dc.html` (one file per screen, exported from the
design canvas https://claude.ai/artifact/UjHrZxS832Wv4W1Mz29qZH). Each file is plain HTML with
inline styles inside `<x-dc>`; ignore the `support.js` line and the `<script type="text/x-dc">` block.
Source of truth for behavior and data: the project spec (summarized below).

## Design tokens (already in `src/app/globals.css`, reuse, do not redefine)

- `pmc-red` #c8102e, `pmc-red-dark` #9e0c24, `ink` #141414, `muted` #5f6368, `line` #e4e4e7,
  `surface` #fff, `ground` #f5f5f4, `good` #1b7f4c
- Body: Inter (`font-sans`). Display: Oswald 500/600, uppercase, `.font-display`.
- Components to reuse from `src/components/Shell.tsx`: `Shell`, `Card`, `StatusPill`.
- Patterns in the mockups worth turning into shared components: step header with progress bar,
  sticky bottom action bar (Back + primary), chip group (multi-select), option card (radio or
  checkbox with title + detail, `has-[:checked]` styling as in `OnboardingForm.tsx`), avatar tile.

## Screens

Public site: `Main.dc.html` (desktop 1440), `HomeMobile.dc.html` (390). Route: `/` (currently
redirects; make it the marketing page for signed-out users, `/home` stays the player home).

DRAFT flow, route `/register/[programId]`:
1. `Reg-Program.dc.html`: program page, entry point
2. `Draft-1-Identity.dc.html`: identity, pronouns, emergency contact
3. `Draft-2-Profile.dc.html`: player profile (scouting block, height, jersey, photo, social)
4. `Draft-3-Teammates.dc.html`: teammate requests, max 2, registered / invited status
5. `Draft-4-Subs.dc.html`: sub availability, off by default
6. `Draft-5-Agreements.dc.html`: liability waiver, refund policy, media consent (three states)
7. `Draft-6-Payment.dc.html`: summary, pay via LeagueApps (phase one)
8. `Draft-7-Done.dc.html`: confirmation

BYOT flow, same route, branched on `program.format_type`:
1. `Byot-Role.dc.html`: captain / joining a team / free agent
2. `Byot-Captain.dc.html` then `Byot-Code.dc.html`: create team, join code, roster with 6M/4W meter
2. `Byot-Join.dc.html`: join by code (instant) or browse and request (captain approves), waitlist
2. `Byot-FreeAgent.dc.html`: free agent placement
Then steps 3 to 8 of the DRAFT flow are shared.

## Rules that must hold (from the spec)

- Flow branches on `program.format_type` (DRAFT | BYOT). DRAFT never shows a captain or team option.
- `qb_willing` is three states: yes | reluctant | no. Never collapse to boolean.
- Height is two selects (ft, in), stored as integers.
- Teammate requests: max 2 per registration; a request counts only when mutual. Unregistered
  invitees get a link; the request activates when they register.
- Sub availability defaults off. When on: locations[], nights[], notice_hours, positions[].
- Media consent is its own field on member (public | league_only | none), never inside the waiver.
  Any value lets the player register.
- Waivers are versioned; acceptance is recorded by version id with timestamp and IP.
- BYOT: join by code lands on the roster on payment; browse-and-request needs captain approval;
  roster cap and coed composition (kickball 6M/4W) are enforced at join time; full teams expose a
  waitlist. Free agents are visible to captains of teams short on either gender.
- Duplicate jersey numbers are checked within a team.
- Phase one payment: hand off to LeagueApps, hold the spot 15 minutes, return to confirmation.
  Model `credit_ledger` and `refund_request` now, do not process money.

## Data model additions (Supabase; extend, do not rebuild)

registration, player_profile, teammate_request, sub_availability, team.join_code,
roster_spot.source, waiver_version, waiver_acceptance, credit_ledger, refund_request,
program.format_type, program.roster_cap, program.composition_rules, program.fees.
Full field lists are in the registration spec.

## Suggested build order

1. Migration: the tables above plus RLS. RPCs: `start_registration`, `save_registration_step`,
   `request_teammate`, `create_team`, `join_team_by_code`, `request_to_join`, `approve_join`,
   `set_sub_availability`, `accept_waiver`, `complete_registration`.
2. Shared form components (step header, sticky bar, chips, option cards).
3. DRAFT flow end to end against the Fall 26 demo program, saving each step.
4. BYOT branch.
5. Public homepage at `/` reading live programs from the DB.
6. Commissioner: registrations list, QB supply counter (hard Yes vs planned teams, reluctant pool).

## Open placeholders in the mockups

Season dates, open play and draft dates, roster cap (shown as [15]), photos, third program card,
sponsor logos, waiver text. Pull from the program record where one exists, otherwise leave as
labelled placeholders.
