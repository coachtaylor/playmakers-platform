// Registration: the shapes the RPCs return, the option lists the form offers, and the
// small formatters the screens share. The option lists are the league's current
// vocabulary; they are placeholders only where the handoff says so (locations, fields).

import { LEAGUE_TZ, type MediaConsent } from "./types";

/* -------------------------------------------------------------------------- */
/* Shapes                                                                      */
/* -------------------------------------------------------------------------- */

export type FormatType = "DRAFT" | "BYOT";
export type QbWilling = "yes" | "reluctant" | "no";
export type RegistrationStatus = "draft" | "pending_payment" | "complete" | "cancelled" | "waitlisted";

export type ProgramFees = {
  currency?: string;
  amount_cents?: number;
  plan?: { installments?: number; amount_cents?: number; second_due_on?: string };
};

/** `program_public()` — readable without a member row, and by signed-out visitors. */
export type ProgramPublic = {
  program_id: string;
  org_id: string;
  org_name: string;
  name: string;
  sport: string;
  format: string | null;
  format_type: FormatType;
  division: "womens" | "mens" | "coed" | null;
  skill_level: string | null;
  blurb: string | null;
  location_name: string | null;
  day_of_week: string | null;
  season_label: string;
  season_starts_on: string | null;
  season_ends_on: string | null;
  game_weeks: number | null;
  open_play_at: string | null;
  draft_at: string | null;
  first_game_at: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  roster_cap: number | null;
  composition_rules: Record<string, number>;
  fees: ProgramFees;
  hero_photo_path: string | null;
  has_payment_url: boolean;
};

export type RegistrationRow = {
  id: string;
  program_id: string;
  member_id: string;
  status: RegistrationStatus;
  last_completed_step: number;
  role_choice: "captain" | "join_team" | "free_agent" | null;
  team_id: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  emergency_relationship: string | null;
  heard_about: string | null;
  payment_plan: "full" | "plan" | null;
  discount_code: string | null;
  amount_due_cents: number | null;
  hold_expires_at: string | null;
  paid_at: string | null;
};

export type RegistrationMember = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  pronouns: string | null;
  phone: string | null;
  date_of_birth: string | null;
  instagram_handle: string | null;
  photo_path: string | null;
  media_consent: MediaConsent | null;
};

export type PlayerProfileRow = {
  id: string;
  registration_id: string;
  positions_played: string[];
  preferred_offense: string | null;
  preferred_defense: string | null;
  qb_willing: QbWilling | null;
  qb_years: string | null;
  years_playing: string | null;
  experience_type: string | null;
  route_familiarity: string | null;
  athletic_history: string | null;
  height_ft: number | null;
  height_in: number | null;
  jersey_name: string | null;
  jersey_number: string | null;
  shirt_size: string | null;
};

export type SubAvailabilityRow = {
  registration_id: string;
  enabled: boolean;
  locations: string[];
  nights: string[];
  notice_hours: number | null;
  positions: string[];
};

export type TeammateRequest = {
  id: string;
  status: "requested" | "invited" | "withdrawn";
  target_member_id: string | null;
  name: string | null;
  initials: string | null;
  mutual: boolean;
  /** What the requester typed, never what the player has on their own record. */
  invite_name: string | null;
  invite_phone: string | null;
  invite_handle: string | null;
  /** Null once the invite is bound, withdrawn, or its contact details changed. */
  invite_token: string | null;
  invite_sent_at: string | null;
  /** An invite by phone or handle that turned out to name someone already registered. */
  matched_from_invite: boolean;
};

/** `invite_preview()` — what an invite link shows before anyone signs in. */
export type InvitePreview = {
  program_id: string;
  requester_name: string;
  requester_initials: string;
  invited_name: string | null;
};

export type Agreement = {
  id: string;
  kind: "liability" | "refund_policy" | "code_of_conduct";
  version_label: string;
  body: string;
  accepted_at: string | null;
};

/** `my_registration()` — everything the steps render from, in one round trip. */
export type RegistrationBundle = {
  registration: RegistrationRow;
  member: RegistrationMember;
  profile: PlayerProfileRow | null;
  sub_availability: SubAvailabilityRow | null;
  teammate_requests: TeammateRequest[];
  agreements: Agreement[];
};

export type TeammateCandidate = {
  member_id: string;
  display_name: string;
  initials: string;
  requested_you: boolean;
  already_requested: boolean;
};

/* -------------------------------------------------------------------------- */
/* Steps                                                                       */
/* -------------------------------------------------------------------------- */

export const REGISTRATION_STEPS = [
  { step: 1, slug: "identity", title: "About you" },
  { step: 2, slug: "profile", title: "Player profile" },
  { step: 3, slug: "teammates", title: "Teammate requests" },
  { step: 4, slug: "subs", title: "Sub availability" },
  { step: 5, slug: "agreements", title: "Agreements" },
  { step: 6, slug: "payment", title: "Payment" },
] as const;

export const TOTAL_STEPS = REGISTRATION_STEPS.length;

export function stepHref(programId: string, step: number) {
  const found = REGISTRATION_STEPS.find((s) => s.step === step);
  return found ? `/register/${programId}/${found.slug}` : `/register/${programId}`;
}

/** Where to send someone who has a registration in progress. */
export function resumeHref(programId: string, bundle: RegistrationBundle | null) {
  if (!bundle) return `/register/${programId}`;
  if (bundle.registration.status === "complete") return `/register/${programId}/done`;
  const next = Math.min(bundle.registration.last_completed_step + 1, TOTAL_STEPS);
  return stepHref(programId, Math.max(next, 1));
}

/* -------------------------------------------------------------------------- */
/* Option lists                                                                */
/* -------------------------------------------------------------------------- */

export const PRONOUN_OPTIONS = ["she/her", "he/him", "they/them"] as const;

export const RELATIONSHIP_OPTIONS = ["Partner", "Parent", "Sibling", "Friend", "Roommate", "Other"] as const;

/** Positions a player can have played. "N/A" is for someone brand new to the sport. */
export const POSITION_OPTIONS = ["QB", "WR", "RB", "CB", "LB", "Safety", "Rusher", "N/A"] as const;

export const OFFENSE_OPTIONS = ["QB", "WR", "RB", "Center", "No preference"] as const;
export const DEFENSE_OPTIONS = ["Rusher", "CB", "Safety", "LB", "No preference"] as const;

export const YEARS_OPTIONS = [
  "None",
  "Less than a year",
  "1 to 2 years",
  "3 to 5 years",
  "More than 5 years",
] as const;

export const EXPERIENCE_OPTIONS = [
  "First time playing",
  "Rec league only",
  "Rec league, some tournaments",
  "Competitive tournaments",
  "College or semi-pro",
] as const;

export const ROUTE_OPTIONS = [
  "New to routes",
  "I know a few",
  "I know most routes by name",
  "I can run a full tree and adjust on the fly",
] as const;

export const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "2XL"] as const;

export const HEIGHT_FEET = [4, 5, 6] as const;

export const HEARD_ABOUT_OPTIONS = [
  "A friend who plays",
  "Instagram",
  "TikTok",
  "Google",
  "A flyer at the field",
  "Another league",
  "Other",
] as const;

/** The league's current fields. Placeholder until the season's locations are set. */
export const SUB_LOCATIONS = [
  "Tempe",
  "Desert Mountain Park",
  "Queen Creek",
  "Encanto",
  "Papago",
  "Cesar Chavez",
] as const;

export const NIGHTS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const NOTICE_OPTIONS = [
  { value: "0", label: "Same day is fine" },
  { value: "24", label: "A day's notice" },
  { value: "48", label: "Two days' notice" },
  { value: "168", label: "A week's notice" },
] as const;

export const SUB_POSITION_OPTIONS = ["Any", "QB", "WR", "RB", "CB", "LB", "Safety", "Rusher"] as const;

export const QB_OPTIONS: { value: QbWilling; title: string; detail?: string }[] = [
  {
    value: "yes",
    title: "Yes",
    detail: "Put me at QB. Counts toward the QB supply for the draft.",
  },
  {
    value: "reluctant",
    title: "Prefer not to, but I will if a team needs one",
    detail: "Backup pool. Captains see this as reluctant.",
  },
  { value: "no", title: "No" },
];

export const MEDIA_CONSENT_OPTIONS: { value: MediaConsent; title: string; detail: string }[] = [
  {
    value: "public",
    title: "Public",
    detail:
      "PMC can post photos and clips of me on Instagram, TikTok and the website, and tag me.",
  },
  {
    value: "league_only",
    title: "League only",
    detail: "Share my photos and clips with players in the league and with me. Nothing public, no tags.",
  },
  {
    value: "none",
    title: "Don't tag or share me",
    detail: "Keep me out of shared media. I can still see my own game photos.",
  },
];

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

const SPORT_LABELS: Record<string, string> = {
  flag_football: "Flag Football",
  kickball: "Kickball",
  basketball: "Basketball",
  pickleball: "Pickleball",
};

const DIVISION_LABELS: Record<string, string> = {
  womens: "Women's",
  mens: "Men's",
  coed: "Coed",
};

export function sportLabel(sport: string) {
  return SPORT_LABELS[sport] ?? sport.replace(/_/g, " ");
}

export function divisionLabel(division: string | null) {
  return division ? (DIVISION_LABELS[division] ?? division) : "";
}

/** "Women's 5v5 Flag Football" — built from the fields, not the admin-facing name. */
export function programTitle(p: ProgramPublic) {
  return [divisionLabel(p.division), p.format, sportLabel(p.sport)].filter(Boolean).join(" ");
}

/** "Benedict Sports Complex, Tempe · Wednesdays · Fall 26" */
export function programWhere(p: ProgramPublic) {
  const day = p.day_of_week ? `${p.day_of_week}s` : null;
  return [p.location_name, day, p.season_label].filter(Boolean).join(" · ");
}

/** "Women's 5v5 · Tempe Wed · Fall 26" — the short label in the step header. */
export function programTagline(p: ProgramPublic) {
  const city = p.location_name?.includes(",")
    ? p.location_name.split(",").pop()!.trim()
    : p.location_name;
  const place = [city, p.day_of_week?.slice(0, 3)].filter(Boolean).join(" ");
  return [[divisionLabel(p.division), p.format].filter(Boolean).join(" "), place, p.season_label]
    .filter(Boolean)
    .join(" · ");
}

export function formatMoney(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** "$79" when it is a whole number of dollars, "$79.50" when it is not. */
export function formatMoneyShort(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return cents % 100 === 0 ? `$${cents / 100}` : formatMoney(cents);
}

/** "Wed, Sep 30" in league time. */
export function formatLeagueDate(value: string | null | undefined) {
  if (!value) return "";
  const iso = value.length === 10 ? `${value}T12:00:00Z` : value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: LEAGUE_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

/** "Sep 30" in league time, for tighter spots. */
export function formatLeagueDayMonth(value: string | null | undefined) {
  if (!value) return "";
  const iso = value.length === 10 ? `${value}T12:00:00Z` : value;
  return new Intl.DateTimeFormat("en-US", { timeZone: LEAGUE_TZ, month: "short", day: "numeric" }).format(
    new Date(iso),
  );
}

/** A labelled placeholder, so an unset program date reads as missing, not as blank. */
export function dateOrPlaceholder(value: string | null | undefined, placeholder = "[Date]") {
  return value ? formatLeagueDate(value) : placeholder;
}

export function registrationIsOpen(p: ProgramPublic, now = Date.now()) {
  const opens = p.registration_opens_at ? new Date(p.registration_opens_at).getTime() : null;
  const closes = p.registration_closes_at ? new Date(p.registration_closes_at).getTime() : null;
  if (opens !== null && now < opens) return false;
  if (closes !== null && now > closes) return false;
  return true;
}

/** "(602) 555-0100" for a ten digit number, and whatever was stored for anything else. */
export function formatPhone(digits: string | null | undefined) {
  if (!digits) return "";
  const d = digits.replace(/\D/g, "");
  if (d.length !== 10) return digits;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** The link an invited teammate opens. One token per invite, revoked when it changes. */
export function invitePath(programId: string, token: string) {
  return `/register/${programId}?invite=${encodeURIComponent(token)}`;
}

export function heightLabel(ft: number | null, inches: number | null) {
  if (ft === null) return "";
  return `${ft}′${inches ?? 0}″`;
}
