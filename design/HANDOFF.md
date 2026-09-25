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
  invitees get their own revocable link — see "Teammate invites" below.
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

Added for teammate invites: `teammate_request.invite_token`, `.invite_sent_at`.

## Teammate invites (agreed 2026-09-25, not built)

Step 3 shipped with an invite you cannot see a number for or correct, and with an invited
person's contact details hidden. Both are wrong. The model below replaces phone matching as
the way an invite binds.

**Each invite gets its own token.** Generated when the request is created. The message carries
`/register/{programId}?invite={token}`. Binding happens on the token, so a mistyped number can
never attach a stranger: attaching requires someone to have opened that particular link.

**Changing the number or handle, or removing the request, revokes the token.** The already-sent
message becomes a dead link. This is the point of the whole design — a text that went to the
wrong person must stop working the moment the player notices.

**A dead or unknown token still lets the person register.** Show "this invite is no longer
active" and carry on to a normal program page. Revoking an invite must never block a stranger's
own registration.

**Phone and handle matching stays as a fallback**, because most people will not tap the link;
they will go to the site and sign up. It stays safe because both paths read the current row,
so changing the number kills both at once.

**Fix while in here:** matching only runs inside `start_registration` today, so an invite sent
to someone who *already* registered never activates — it sits as "not registered yet" forever
and burns one of the two slots. `request_teammate` should match an existing member at insert.

Screen behaviour on step 3:

- Show the phone number (and handle) on an invited person's card. Name, phone and handle are
  editable while they are unregistered.
- When the contact matches someone already registered: "This player is already registered for
  this league", with the option to select them. Name and phone display, neither is editable.
- Match on the exact number only, show the same "First L." form used everywhere else, and echo
  back *the number the requester typed*, never the one on the member's record. Otherwise this
  becomes a lookup that turns phone numbers into league members, and someone can enumerate
  numbers to find out who is playing.
- Selecting a registered player just creates the request. They already see "requested you" on
  their own step 3. No member-to-member texting: it costs money per message, needs opt-out
  handling, and lets anyone text anyone by adding and removing a request.

**SMS is not part of this.** No provider is wired up, and doing it properly means an account,
a number and opt-out compliance. Until then, show the invite link on the card with a copy
button so a player can send it themselves — which also makes the whole token path testable.

## Suggested build order

1. ~~Migration: the tables above plus RLS. RPCs: `start_registration`, `save_registration_step`,
   `request_teammate`, `create_team`, `join_team_by_code`, `request_to_join`, `approve_join`,
   `set_sub_availability`, `accept_waiver`, `complete_registration`.~~ Done.
2. ~~Shared form components (step header, sticky bar, chips, option cards).~~ Done, in
   `src/components/form.tsx`.
3. ~~DRAFT flow end to end against the Fall 26 demo program, saving each step.~~ Done.
4. Teammate invites: tokens, revocation, the registered-player match. Section above.
5. BYOT branch. Schema and RPCs exist; only the screens are missing.
6. Public homepage at `/` reading live programs from the DB.
7. Commissioner: registrations list, QB supply counter (hard Yes vs planned teams, reluctant pool).

## Open placeholders in the mockups

Season dates, open play and draft dates, roster cap (shown as [15]), photos, third program card,
sponsor logos, waiver text. Pull from the program record where one exists, otherwise leave as
labelled placeholders.
