import Link from "next/link";
import { Shell, StatusPill } from "@/components/Shell";
import { buttonPrimary } from "@/components/form";
import {
  dateOrPlaceholder,
  formatLeagueDate,
  formatMoneyShort,
  programTitle,
  programWhere,
  registrationIsOpen,
  resumeHref,
  divisionLabel,
  type RegistrationBundle,
} from "@/lib/registration";
import { loadProgram } from "./data";
import { RegisterButton } from "./RegisterButton";

export default async function ProgramPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { supabase, program, user } = await loadProgram(programId);

  // Signed in? Pick up where they left off rather than starting again.
  let bundle: RegistrationBundle | null = null;
  if (user) {
    const { data } = await supabase.rpc("my_registration", { p_program: programId });
    bundle = (data as RegistrationBundle | null) ?? null;
  }

  const open = registrationIsOpen(program);
  const isDraft = program.format_type === "DRAFT";
  const fee = program.fees?.amount_cents ?? null;
  const plan = program.fees?.plan;
  const done = bundle?.registration.status === "complete";

  return (
    <Shell
      padded={false}
      signedIn={Boolean(user)}
      action={
        user ? undefined : (
          <Link
            href={`/login?next=${encodeURIComponent(`/register/${programId}`)}`}
            className="text-sm font-semibold text-white/80 hover:text-white"
          >
            Sign in
          </Link>
        )
      }
    >
      <div className="flex h-45 items-end bg-ink p-3 text-xs uppercase tracking-wider text-white/70">
        [Photo: {program.location_name ?? "the field"}
        {program.day_of_week ? `, ${program.day_of_week} night` : ""}]
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-6 pt-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <StatusPill tone="red">{isDraft ? "Draft league" : "Bring your own team"}</StatusPill>
            {program.division && <StatusPill tone="gray">{divisionLabel(program.division)}</StatusPill>}
            {program.format && <StatusPill tone="gray">{program.format}</StatusPill>}
            {program.skill_level && <StatusPill tone="gray">{program.skill_level}</StatusPill>}
          </div>
          <h1 className="font-display text-3xl leading-none">{programTitle(program)}</h1>
          <p className="text-sm text-muted">{programWhere(program)}</p>
        </div>

        <section className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface p-4">
          <Fact label="Season">
            {program.season_starts_on
              ? `${formatLeagueDate(program.season_starts_on)} to ${formatLeagueDate(program.season_ends_on)}`
              : "[Start] to [End]"}
          </Fact>
          <Fact label="Games">
            {program.game_weeks ? `${program.game_weeks} weeks + playoffs` : "[N] weeks + playoffs"}
          </Fact>
          <Fact label={isDraft ? "Open play" : "First game"}>
            {isDraft
              ? `${dateOrPlaceholder(program.open_play_at)}${program.draft_at ? ", before the draft" : ""}`
              : dateOrPlaceholder(program.first_game_at)}
          </Fact>
          <Fact label="Registration closes" accent>
            {dateOrPlaceholder(program.registration_closes_at)}
          </Fact>
        </section>

        <section className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-4">
          <h2 className="font-display text-lg leading-none">
            {isDraft ? "How the draft works" : "How it works"}
          </h2>
          <p className="text-sm leading-relaxed text-muted">
            {program.blurb ??
              "You register on your own, then captains draft balanced teams on draft night."}
          </p>
        </section>

        <section className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-4">
          <h2 className="font-display text-lg leading-none">What&apos;s included</h2>
          <ul className="list-disc space-y-1 pl-4.5 text-sm leading-relaxed text-muted">
            <li>Jersey with your name and number</li>
            <li>Referees, fields and lights</li>
            <li>Tagged game photos and clips</li>
            <li>All-star voting and the end-of-season party</li>
          </ul>
        </section>

        <p className="text-xs leading-relaxed text-muted">
          Refund policy: full refund within 72 hours of purchase if 48+ hours before start; site credit on a
          sliding scale after that. You&apos;ll read the full policy before you pay.
        </p>
      </div>

      <div className="sticky bottom-0 mt-auto flex items-center gap-4 border-t border-line bg-surface/95 px-4 pb-5 pt-3 backdrop-blur">
        <div className="flex flex-col">
          <span className="text-[22px] font-bold leading-none">{fee ? formatMoneyShort(fee) : "[Fee]"}</span>
          <span className="text-xs text-muted">per player{plan ? " · payment plans" : ""}</span>
        </div>

        {done ? (
          <Link href={`/register/${programId}/done`} className={`${buttonPrimary} flex-grow`}>
            You&apos;re registered
          </Link>
        ) : !open ? (
          <span className="flex-grow text-sm text-muted">
            Registration {program.registration_closes_at && Date.now() > new Date(program.registration_closes_at).getTime()
              ? "has closed"
              : `opens ${dateOrPlaceholder(program.registration_opens_at)}`}
            .
          </span>
        ) : !user ? (
          <Link
            href={`/login?next=${encodeURIComponent(`/register/${programId}`)}`}
            className={`${buttonPrimary} flex-grow`}
          >
            Sign in to register
          </Link>
        ) : bundle ? (
          <Link href={resumeHref(programId, bundle)} className={`${buttonPrimary} flex-grow`}>
            Finish registering
          </Link>
        ) : (
          <RegisterButton programId={programId} label="Register" />
        )}
      </div>
    </Shell>
  );
}

function Fact({
  label,
  children,
  accent = false,
}: {
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-sm font-semibold ${accent ? "text-pmc-red" : ""}`}>{children}</span>
    </div>
  );
}
