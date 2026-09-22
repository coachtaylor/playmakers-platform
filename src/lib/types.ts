export type MediaConsent = "public" | "league_only" | "none";

export type Profile = {
  member_id: string;
  org_id: string;
  org_name: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  pronouns: string | null;
  media_consent: MediaConsent | null;
  onboarded_at: string | null;
  is_staff: boolean;
  is_admin: boolean;
};

export type MyProgram = {
  program_id: string;
  program_name: string;
  season_label: string;
  team_name: string | null;
  is_rookie: boolean;
  voting_opens_at: string | null;
  voting_closes_at: string | null;
  results_published_at: string | null;
  has_voted: boolean;
};

export type Candidate = {
  member_id: string;
  display_name: string;
  team_name: string | null;
  is_rookie: boolean;
  photo_path: string | null;
  jersey_number: string | null;
  positions: string[];
};

export type AwardCategory = {
  id: string;
  program_id: string;
  kind: "rookie" | "allstar" | "veteran";
  label: string;
  slots: number;
  eligibility: "any" | "rookie" | "veteran";
  sort_order: number;
};

export type Tally = {
  category_id: string;
  category_label: string;
  sort_order: number;
  slots: number;
  member_id: string;
  display_name: string;
  team_name: string | null;
  is_rookie: boolean;
  jersey_number: string | null;
  positions: string[];
  votes: number;
  selected: boolean;
};

export type VotingStatus = "not_set" | "upcoming" | "open" | "closed" | "published";

export function votingStatus(p: {
  voting_opens_at: string | null;
  voting_closes_at: string | null;
  results_published_at: string | null;
}): VotingStatus {
  if (p.results_published_at) return "published";
  if (!p.voting_opens_at) return "not_set";
  const now = Date.now();
  if (now < new Date(p.voting_opens_at).getTime()) return "upcoming";
  if (p.voting_closes_at && now > new Date(p.voting_closes_at).getTime()) return "closed";
  return "open";
}

// Phoenix does not observe daylight saving time, so league times are always UTC-7.
export const LEAGUE_TZ = "America/Phoenix";

export function formatLeagueTime(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: LEAGUE_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function isEligible(c: Candidate, cat: Pick<AwardCategory, "eligibility">) {
  if (cat.eligibility === "rookie") return c.is_rookie;
  if (cat.eligibility === "veteran") return !c.is_rookie;
  return true;
}

/** "WR / CB", or "" when no positions are on file. */
export function formatPositions(positions: string[] | null | undefined) {
  return (positions ?? []).join(" / ");
}
