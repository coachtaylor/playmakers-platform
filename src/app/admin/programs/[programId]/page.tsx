import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, Shell, StatusPill } from "@/components/Shell";
import { requireSession } from "@/lib/session";
import { LEAGUE_TZ, formatLeagueTime, formatPositions, votingStatus, type Tally } from "@/lib/types";
import { saveVotingWindow, setPublished } from "./actions";
import { SelectionToggle } from "./SelectionToggle";

// ISO -> value for <input type="datetime-local"> in Phoenix time.
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LEAGUE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

export default async function AdminProgramPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { supabase, isAdmin } = await requireSession();
  if (!isAdmin) redirect("/home");

  const { data: program } = await supabase
    .from("programs")
    .select("id, name, voting_opens_at, voting_closes_at, results_published_at")
    .eq("id", programId)
    .maybeSingle();
  if (!program) notFound();

  const [{ data: turnoutData }, { data: tallyData }] = await Promise.all([
    supabase.rpc("program_turnout", { p_program: programId }),
    supabase.rpc("award_tallies", { p_program: programId }),
  ]);
  const turnout = (turnoutData ?? { rostered: 0, logged_in: 0, ballots: 0 }) as {
    rostered: number;
    logged_in: number;
    ballots: number;
  };
  const tallies = (tallyData ?? []) as Tally[];

  const categories = new Map<string, { label: string; slots: number; rows: Tally[] }>();
  for (const t of tallies) {
    const c = categories.get(t.category_id) ?? { label: t.category_label, slots: t.slots, rows: [] };
    c.rows.push(t);
    categories.set(t.category_id, c);
  }

  const status = votingStatus(program);
  const saveWindow = saveVotingWindow.bind(null, programId);
  const publish = setPublished.bind(null, programId, true);
  const unpublish = setPublished.bind(null, programId, false);

  return (
    <Shell isAdmin>
      <div className="space-y-6">
        <div className="space-y-1">
          <Link href="/admin" className="text-sm text-muted underline">
            All leagues
          </Link>
          <h1 className="text-2xl font-semibold leading-tight">{program.name}</h1>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href={`/admin/programs/${programId}/import`} className="font-semibold text-pmc-red underline">
              Import roster
            </Link>
            <Link href={`/results/${programId}`} className="font-semibold text-pmc-red underline">
              Preview results page
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
          {[
            ["Rostered", turnout.rostered],
            ["Signed in", turnout.logged_in],
            ["Ballots", turnout.ballots],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
              <p className="font-display text-3xl tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl">Voting window</h2>
            <StatusPill tone={status === "open" ? "red" : status === "published" ? "green" : "gray"}>{status.replace("_", " ")}</StatusPill>
          </div>
          <form action={saveWindow} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1">
              <label htmlFor="opens" className="block text-sm font-semibold">
                Opens (Phoenix time)
              </label>
              <input
                id="opens"
                name="opens"
                type="datetime-local"
                defaultValue={toLocalInput(program.voting_opens_at)}
                className="w-full rounded-md border border-line px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="closes" className="block text-sm font-semibold">
                Closes (Phoenix time)
              </label>
              <input
                id="closes"
                name="closes"
                type="datetime-local"
                defaultValue={toLocalInput(program.voting_closes_at)}
                className="w-full rounded-md border border-line px-3 py-2"
              />
            </div>
            <button className="rounded-md bg-ink px-4 py-2 font-semibold text-white">Save window</button>
          </form>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-xl">Results</h2>
          {program.results_published_at ? (
            <>
              <p className="text-sm text-muted">
                Published {formatLeagueTime(program.results_published_at)}. Players can see the selections.
              </p>
              <form action={unpublish}>
                <button className="rounded-md border border-line px-4 py-2 font-semibold">Hide results again</button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                Votes inform your call; you make the final selections below. Players see nothing until you publish, so
                you can announce at the party first.
              </p>
              <form action={publish}>
                <button className="rounded-md bg-pmc-red px-4 py-2 font-semibold text-white hover:bg-pmc-red-dark">
                  Publish results to players
                </button>
              </form>
            </>
          )}
        </Card>

        {[...categories.entries()].map(([categoryId, c]) => {
          const selectedCount = c.rows.filter((r) => r.selected).length;
          return (
            <Card key={categoryId} className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xl">{c.label}</h2>
                <span className={`text-sm font-semibold tabular-nums ${selectedCount === c.slots ? "text-good" : "text-muted"}`}>
                  {selectedCount} of {c.slots} selected
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 pr-2 font-semibold">Pick</th>
                      <th className="py-2 pr-2 font-semibold">#</th>
                      <th className="py-2 pr-2 font-semibold">Player</th>
                      <th className="py-2 pr-2 font-semibold">Team</th>
                      <th className="py-2 text-right font-semibold">Votes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.rows.map((r) => (
                      <tr key={r.member_id} className="border-b border-line last:border-0">
                        <td className="py-2 pr-2">
                          <SelectionToggle
                            programId={programId}
                            categoryId={categoryId}
                            memberId={r.member_id}
                            selected={r.selected}
                            label={r.display_name}
                          />
                        </td>
                        <td className="py-2 pr-2 tabular-nums text-muted">{r.jersey_number ?? ""}</td>
                        <td className="py-2 pr-2">
                          <span className="font-medium">{r.display_name}</span>
                          {r.is_rookie && <span className="ml-1 text-xs text-muted">R</span>}
                          {r.positions?.length > 0 && (
                            <span className="block text-xs text-muted">{formatPositions(r.positions)}</span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-muted">{r.team_name}</td>
                        <td className="py-2 text-right tabular-nums">{r.votes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>
    </Shell>
  );
}
