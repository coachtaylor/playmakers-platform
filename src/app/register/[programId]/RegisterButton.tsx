"use client";

import { useActionState } from "react";
import { beginRegistration, claimInvite, type StepState } from "./actions";
import { buttonPrimary } from "@/components/form";

export function RegisterButton({
  programId,
  label,
  invite,
}: {
  programId: string;
  label: string;
  invite?: string | null;
}) {
  const [state, action, pending] = useActionState<StepState, FormData>(beginRegistration, {});

  return (
    <form action={action} className="flex-grow">
      <input type="hidden" name="program_id" value={programId} />
      {invite && <input type="hidden" name="invite" value={invite} />}
      {state.error && (
        <p role="alert" className="mb-2 text-sm text-pmc-red">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${buttonPrimary} w-full`}>
        {pending ? "One moment…" : label}
      </button>
    </form>
  );
}

/**
 * The same link, opened by someone who had already started registering. Their
 * registration exists, so the token is attached on its own instead of at the start.
 */
export function ClaimInviteButton({
  programId,
  registrationId,
  invite,
  next,
  label,
}: {
  programId: string;
  registrationId: string;
  invite: string;
  next: string;
  label: string;
}) {
  const [state, action, pending] = useActionState<StepState, FormData>(claimInvite, {});

  return (
    <form action={action} className="flex-grow">
      <input type="hidden" name="program_id" value={programId} />
      <input type="hidden" name="registration_id" value={registrationId} />
      <input type="hidden" name="invite" value={invite} />
      <input type="hidden" name="next" value={next} />
      {state.error && (
        <p role="alert" className="mb-2 text-sm text-pmc-red">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${buttonPrimary} w-full`}>
        {pending ? "One moment…" : label}
      </button>
    </form>
  );
}
