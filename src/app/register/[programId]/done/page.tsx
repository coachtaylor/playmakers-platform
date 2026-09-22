import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell, Card, StatusPill } from "@/components/Shell";
import { Avatar, buttonPrimary } from "@/components/form";
import {
  dateOrPlaceholder,
  programTitle,
  programWhere,
  resumeHref,
} from "@/lib/registration";
import { loadStep } from "../data";

const CONSENT_WORDS = {
  public: {
    label: "public",
    detail: "Your photos and clips can be posted publicly and you can be tagged.",
  },
  league_only: {
    label: "league only",
    detail: "Your photos and clips are shared inside the league, not publicly.",
  },
  none: { label: "don't tag or share me", detail: "You are kept out of shared media." },
} as const;

export default async function DonePage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { program, bundle } = await loadStep(programId);

  // Not finished paying yet? Send them back to where they left off.
  if (bundle.registration.status !== "complete") redirect(resumeHref(programId, bundle));

  const isDraft = program.format_type === "DRAFT";
  const consent = bundle.member.media_consent ? CONSENT_WORDS[bundle.member.media_consent] : null;
  const requests = bundle.teammate_requests;

  return (
    <Shell>
      <div className="space-y-4">
        <div className="space-y-2">
          <StatusPill tone="green">Registered</StatusPill>
          <h1 className="font-display text-4xl leading-none">
            {isDraft ? "You're in the draft pool." : "You're registered."}
          </h1>
          <p className="text-[15px] leading-relaxed text-muted">
            {programTitle(program)} · {programWhere(program)}. Receipt sent to {bundle.member.email}.
          </p>
        </div>

        <Card className="space-y-3">
          <h2 className="font-display text-lg">What happens next</h2>
          <ol className="flex list-decimal flex-col gap-1.5 pl-4.5 text-sm leading-relaxed">
            {isDraft && (
              <li>
                <strong>Open play, {dateOrPlaceholder(program.open_play_at)}.</strong> Come so captains can see
                you play. Add it to your calendar.
              </li>
            )}
            {isDraft && (
              <li>
                <strong>Draft night, {dateOrPlaceholder(program.draft_at)}.</strong> Captains pick from the
                pool. You will get a text with your team.
              </li>
            )}
            <li>
              <strong>First game, {dateOrPlaceholder(program.first_game_at)}.</strong> Jersey pickup at the
              field.
            </li>
          </ol>
        </Card>

        {requests.length > 0 && (
          <Card className="space-y-2.5">
            <h2 className="font-display text-lg">Your teammate requests</h2>
            {requests.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5">
                <Avatar initials={r.initials ?? "?"} muted={r.status === "invited"} />
                <span className="flex-grow text-sm">{r.name}</span>
                {r.mutual ? (
                  <StatusPill tone="green">Mutual</StatusPill>
                ) : r.status === "invited" ? (
                  <StatusPill tone="gray">Invited</StatusPill>
                ) : (
                  <StatusPill tone="gray">Waiting</StatusPill>
                )}
              </div>
            ))}
            <Link
              href={`/register/${programId}/teammates`}
              className="text-sm font-semibold text-pmc-red underline"
            >
              Change requests
            </Link>
          </Card>
        )}

        {consent && (
          <Card className="space-y-1.5">
            <span className="text-sm font-semibold">Media: {consent.label}</span>
            <span className="block text-xs leading-relaxed text-muted">
              {consent.detail}{" "}
              <Link href={`/register/${programId}/agreements`} className="underline">
                Change
              </Link>
            </span>
          </Card>
        )}

        <Link href="/home" className={`${buttonPrimary} w-full`}>
          Go to my home
        </Link>
      </div>
    </Shell>
  );
}
