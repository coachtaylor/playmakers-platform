import Link from "next/link";
import { Shell, StatusPill } from "@/components/Shell";
import { Avatar, buttonPrimary } from "@/components/form";
import {
  dateOrPlaceholder,
  formatLeagueDate,
  formatMoneyShort,
  invitePath,
  programTitle,
  programWhere,
  registrationIsOpen,
  resumeHref,
  divisionLabel,
  stepHref,
  type InvitePreview,
  type RegistrationBundle,
} from "@/lib/registration";
import { loadProgram } from "./data";
import { ClaimInviteButton, RegisterButton } from "./RegisterButton";

export default async function ProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const { programId } = await params;
  const { invite: raw } = await searchParams;
  const token = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
  const { supabase, program, user } = await loadProgram(programId);

  // A teammate's invite link. A revoked or unknown token reads as null here, which the
  // page says plainly and then gets out of the way: it never blocks someone's own
  // registration.
  let preview: InvitePreview | null = null;
  if (token) {
    const { data } = await supabase.rpc("invite_preview", { p_token: token });
    preview = (data as InvitePreview | null) ?? null;
  }
  const invite = preview?.program_id === programId ? token : null;

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
  // Signing in comes back here, invite and all.
  const signInHref = `/login?next=${encodeURIComponent(
    invite ? invitePath(programId, invite) : `/register/${programId}`,
  )}`;

  return (
    <Shell
      padded={false}
      signedIn={Boolean(user)}
      action={
        user ? undefined : (
          <Link href={signInHref} className="text-sm font-semibold text-white/80 hover:text-white">
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
        {invite && preview ? (
          <section className="flex items-center gap-3 rounded-lg border border-pmc-red/30 bg-pmc-red/5 p-3.5">
            <Avatar initials={preview.requester_initials} />
            <div className="flex flex-col gap-1">
              <p className="text-sm leading-relaxed">
                <span className="font-semibold">{preview.requester_name}</span> wants to be drafted with
                you. Register and we&apos;ll put the request together.
              </p>
              {preview.invited_name && (
                <p className="text-xs leading-relaxed text-muted">
                  Sent to {preview.invited_name} — if that isn&apos;t you, register on your own and ignore
                  the request.
                </p>
              )}
            </div>
          </section>
        ) : token && preview ? (
          <section className="rounded-lg border border-line bg-ground p-3.5 text-sm leading-relaxed">
            That invite is for a different league.{" "}
            <Link href={`/register/${preview.program_id}`} className="font-semibold text-pmc-red underline">
              Open it here
            </Link>
            , or read about this one below.
          </section>
        ) : token ? (
          <section className="rounded-lg border border-line bg-ground p-3.5 text-sm leading-relaxed text-muted">
            That invite link is no longer active — whoever sent it may have corrected the number. You can
            still register below, and they can ask you again.
          </section>
        ) : null}

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

        {bundle && invite ? (
          // They already had a registration, so the token attaches on its own.
          <ClaimInviteButton
            programId={programId}
            registrationId={bundle.registration.id}
            invite={invite}
            next={done ? stepHref(programId, 3) : resumeHref(programId, bundle)}
            label={done ? "Add the request" : "Accept and keep going"}
          />
        ) : done ? (
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
          <Link href={signInHref} className={`${buttonPrimary} flex-grow`}>
            Sign in to register
          </Link>
        ) : bundle ? (
          <Link href={resumeHref(programId, bundle)} className={`${buttonPrimary} flex-grow`}>
            Finish registering
          </Link>
        ) : (
          <RegisterButton programId={programId} label="Register" invite={invite} />
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
