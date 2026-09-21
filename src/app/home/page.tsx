import Link from "next/link";
import { Card, Shell, StatusPill } from "@/components/Shell";
import { NoPlayerRecord } from "@/components/NoPlayerRecord";
import { requireOnboarded } from "@/lib/session";
import { formatLeagueTime, votingStatus, type MyProgram } from "@/lib/types";

export default async function HomePage() {
  const { supabase, profile, isAdmin, user } = await requireOnboarded();

  if (!profile) {
    return (
      <Shell isAdmin={isAdmin}>
        {isAdmin ? (
          <Card>
            <p>
              You&apos;re signed in as a commissioner but aren&apos;t on a roster.{" "}
              <Link href="/admin" className="font-semibold text-pmc-red underline">
                Go to the commissioner view
              </Link>
              .
            </p>
          </Card>
        ) : (
          <NoPlayerRecord email={user.email ?? ""} />
        )}
      </Shell>
    );
  }

  const { data } = await supabase.rpc("my_programs");
  const programs = (data ?? []) as MyProgram[];

  return (
    <Shell isAdmin={isAdmin}>
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-sm text-muted">{profile.org_name}</p>
          <h1 className="font-display text-3xl">Hey, {profile.preferred_name ?? profile.first_name}</h1>
        </div>

        {programs.length === 0 && (
          <Card>
            <p className="text-muted">You&apos;re not on a roster this season yet.</p>
          </Card>
        )}

        {programs.map((p) => (
          <ProgramCard key={p.program_id} program={p} />
        ))}

        <p className="text-sm text-muted">
          Media sharing:{" "}
          <strong className="text-ink">
            {profile.media_consent === "public"
              ? "public"
              : profile.media_consent === "league_only"
                ? "league only"
                : "don't tag or share me"}
          </strong>
          .{" "}
          <Link href="/onboarding" className="underline">
            Change
          </Link>
        </p>
      </div>
    </Shell>
  );
}

function ProgramCard({ program: p }: { program: MyProgram }) {
  const status = votingStatus(p);
  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted">{p.season_label}</p>
        <h2 className="text-lg font-semibold leading-snug">{p.program_name}</h2>
        <p className="text-sm text-muted">
          {p.team_name ? `Team ${p.team_name}` : "No team yet"}
          {p.is_rookie ? " · Rookie" : ""}
        </p>
      </div>

      <div className="rounded-md bg-ground p-4">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="font-display text-base">All-star voting</h3>
          {status === "open" && <StatusPill tone={p.has_voted ? "green" : "red"}>{p.has_voted ? "Voted" : "Open"}</StatusPill>}
          {status === "published" && <StatusPill tone="green">Results are in</StatusPill>}
          {(status === "closed" || status === "upcoming" || status === "not_set") && (
            <StatusPill tone="gray">{status === "closed" ? "Closed" : "Not open yet"}</StatusPill>
          )}
        </div>

        {status === "open" && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {p.has_voted ? "You can change your picks until " : "Vote for rookie, all-star and veteran teams. Closes "}
              {formatLeagueTime(p.voting_closes_at)}.
            </p>
            <Link
              href={`/vote/${p.program_id}`}
              className="inline-block rounded-md bg-pmc-red px-4 py-2.5 font-semibold text-white hover:bg-pmc-red-dark"
            >
              {p.has_voted ? "Edit my ballot" : "Cast my vote"}
            </Link>
          </div>
        )}
        {status === "upcoming" && (
          <p className="text-sm text-muted">Voting opens {formatLeagueTime(p.voting_opens_at)}.</p>
        )}
        {status === "not_set" && <p className="text-sm text-muted">Voting opens near the end of the season.</p>}
        {status === "closed" && (
          <p className="text-sm text-muted">Voting is closed. Selections are announced at the end-of-season party.</p>
        )}
        {status === "published" && (
          <Link href={`/results/${p.program_id}`} className="font-semibold text-pmc-red underline">
            See the all-star teams
          </Link>
        )}
      </div>
    </Card>
  );
}
