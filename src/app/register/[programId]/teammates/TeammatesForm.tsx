"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Avatar,
  Field,
  FormError,
  StepBody,
  StickyBar,
  TextInput,
  buttonGhost,
  buttonSmall,
  inputClass,
} from "@/components/form";
import { SubmitButton } from "@/components/SubmitButton";
import type { RegistrationBundle, TeammateCandidate } from "@/lib/registration";
import { addTeammate, finishTeammates, removeTeammate, type StepState } from "../actions";
import { STEP_FORM_ID } from "../StepFrame";

const MAX_REQUESTS = 2;

export function TeammatesForm({
  programId,
  bundle,
  candidates,
}: {
  programId: string;
  bundle: RegistrationBundle;
  candidates: TeammateCandidate[];
}) {
  const registrationId = bundle.registration.id;
  const requests = bundle.teammate_requests;
  const used = requests.length;
  const full = used >= MAX_REQUESTS;

  const [query, setQuery] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [finishState, finishAction] = useActionState<StepState, FormData>(finishTeammates, {});

  const q = query.trim().toLowerCase();
  const matches = q
    ? candidates.filter((c) => !c.already_requested && c.display_name.toLowerCase().includes(q)).slice(0, 6)
    : [];

  function submit(fields: Record<string, string>, after?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const data = new FormData();
      data.set("program_id", programId);
      data.set("registration_id", registrationId);
      for (const [k, v] of Object.entries(fields)) data.set(k, v);
      const result = fields.request_id
        ? await removeTeammate({}, data)
        : await addTeammate({}, data);
      if (result.error) setError(result.error);
      else after?.();
    });
  }

  return (
    <>
      <StepBody>
        <p className="text-xs leading-relaxed text-muted">
          Pick up to 2 people you want to be drafted with. Captains draft you as a unit when they can.
          Requests only count when both of you list each other.
        </p>

        <FormError>{error ?? finishState.error}</FormError>

        {!full && (
          <div>
            <Field label="Search registered players" htmlFor="teammate-search">
              <input
                id="teammate-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name or Instagram handle"
                className={inputClass}
              />
            </Field>
            {q && matches.length === 0 && (
              <p className="mt-2 text-xs text-muted">
                No registered player matches that. If they haven&apos;t registered yet, invite them below.
              </p>
            )}
            {matches.length > 0 && (
              <ul className="mt-2 flex flex-col gap-2">
                {matches.map((c) => (
                  <li
                    key={c.member_id}
                    className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3"
                  >
                    <Avatar initials={c.initials} />
                    <span className="flex min-w-0 flex-grow flex-col">
                      <span className="text-[15px] font-semibold">{c.display_name}</span>
                      <span className="text-xs text-muted">
                        {c.requested_you ? "Registered · requested you already" : "Registered"}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => submit({ target_member_id: c.member_id }, () => setQuery(""))}
                      className={`${buttonSmall} border border-line bg-surface hover:bg-ground disabled:opacity-60`}
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <section className="flex flex-col gap-2.5">
          {requests.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3"
            >
              <Avatar initials={r.initials ?? "?"} muted={r.status === "invited"} />
              <span className="flex min-w-0 flex-grow flex-col">
                <span className="text-[15px] font-semibold">{r.name}</span>
                <span
                  className={`text-xs ${r.mutual ? "font-semibold text-good" : "text-muted"}`}
                >
                  {r.status === "invited"
                    ? "Not registered yet · we will text them a link"
                    : r.mutual
                      ? "Registered · requested you back"
                      : "Registered · waiting for them to request you back"}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${r.name}`}
                disabled={pending}
                onClick={() => submit({ request_id: r.id })}
                className="h-10 w-10 text-xl text-muted hover:text-ink disabled:opacity-60"
              >
                ×
              </button>
            </div>
          ))}
          {used > 0 && (
            <p className="text-right text-xs text-muted">
              {used} of {MAX_REQUESTS} requests used
            </p>
          )}
        </section>

        {!full && (
          <section className="flex flex-col gap-1.5 rounded-lg border border-line bg-ground p-4">
            <span className="text-sm font-semibold">Not registered yet?</span>
            <span className="text-xs leading-relaxed text-muted">
              Add them by phone number or handle. They get a text with the program link, and the request
              activates when they register.
            </span>
            {inviting ? (
              <div className="mt-1 flex flex-col gap-2">
                <TextInput name="invite_name" id="invite_name" placeholder="Their name" aria-label="Their name" />
                <TextInput
                  id="invite_phone"
                  name="invite_phone"
                  type="tel"
                  placeholder="(602) 000-0000"
                  aria-label="Their phone number"
                />
                <TextInput
                  id="invite_handle"
                  name="invite_handle"
                  placeholder="@theirhandle (optional)"
                  aria-label="Their Instagram handle"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const value = (id: string) =>
                        (document.getElementById(id) as HTMLInputElement | null)?.value ?? "";
                      submit(
                        {
                          invite_name: value("invite_name"),
                          invite_phone: value("invite_phone"),
                          invite_handle: value("invite_handle"),
                        },
                        () => setInviting(false),
                      );
                    }}
                    className={`${buttonSmall} bg-pmc-red text-white hover:bg-pmc-red-dark disabled:opacity-60`}
                  >
                    Send the invite
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviting(false)}
                    className={`${buttonSmall} border border-line bg-surface`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setInviting(true)}
                className={`${buttonGhost} mt-1 h-10 self-start px-4 text-sm`}
              >
                Invite by phone
              </button>
            )}
          </section>
        )}
      </StepBody>

      <form id={STEP_FORM_ID} action={finishAction}>
        <input type="hidden" name="program_id" value={programId} />
        <input type="hidden" name="registration_id" value={registrationId} />
        <StickyBar
          backHref={`/register/${programId}/profile`}
          note="You can skip this. You can change requests until registration closes."
        >
          <SubmitButton className="flex-grow">Continue</SubmitButton>
        </StickyBar>
      </form>
    </>
  );
}
