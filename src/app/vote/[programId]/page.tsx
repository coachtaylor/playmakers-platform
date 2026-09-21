import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Shell } from "@/components/Shell";
import { requireOnboarded } from "@/lib/session";
import { formatLeagueTime, votingStatus, type AwardCategory, type Candidate } from "@/lib/types";
import { BallotForm } from "./BallotForm";

export default async function VotePage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { supabase, profile, isAdmin } = await requireOnboarded();
  if (!profile) notFound();

  const { data: program } = await supabase
    .from("programs")
    .select("id, name, org_id, voting_opens_at, voting_closes_at, results_published_at")
    .eq("id", programId)
    .maybeSingle();
  if (!program) notFound();

  const me = (await supabase.rpc("my_profile")).data?.find(
    (p: { org_id: string }) => p.org_id === program.org_id,
  ) as { member_id: string } | undefined;
  if (!me) notFound();

  const status = votingStatus(program);

  if (status !== "open") {
    return (
      <Shell isAdmin={isAdmin}>
        <Card className="space-y-2">
          <h1 className="font-display text-2xl">All-star voting</h1>
          <p className="text-muted">
            {status === "closed" || status === "published"
              ? "Voting is closed for this league."
              : status === "upcoming"
                ? `Voting opens ${formatLeagueTime(program.voting_opens_at)}.`
                : "Voting isn't open yet."}
          </p>
          <Link href="/home" className="font-semibold text-pmc-red underline">
            Back to home
          </Link>
        </Card>
      </Shell>
    );
  }

  const [{ data: categories }, { data: candidates }, { data: ballot }] = await Promise.all([
    supabase
      .from("award_categories")
      .select("id, program_id, kind, label, slots, eligibility, sort_order")
      .eq("program_id", programId)
      .order("sort_order"),
    supabase.rpc("program_candidates", { p_program: programId }),
    supabase.rpc("my_ballot", { p_program: programId }),
  ]);

  const initial: Record<string, string[]> = {};
  for (const row of (ballot ?? []) as { category_id: string; candidate_member_id: string }[]) {
    (initial[row.category_id] ??= []).push(row.candidate_member_id);
  }

  return (
    <Shell isAdmin={isAdmin}>
      <div className="space-y-6">
        <div className="space-y-1">
          <Link href="/home" className="text-sm text-muted underline">
            Home
          </Link>
          <h1 className="font-display text-3xl">All-star voting</h1>
          <p className="text-muted">
            {program.name}. Closes {formatLeagueTime(program.voting_closes_at)}. Your picks are private; only the
            commissioner sees totals.
          </p>
        </div>
        <BallotForm
          programId={programId}
          myMemberId={me.member_id}
          categories={(categories ?? []) as AwardCategory[]}
          candidates={(candidates ?? []) as Candidate[]}
          initial={initial}
        />
      </div>
    </Shell>
  );
}
