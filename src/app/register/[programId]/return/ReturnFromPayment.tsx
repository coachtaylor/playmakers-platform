"use client";

import { useActionState } from "react";
import { buttonPrimary, FormError } from "@/components/form";
import { finishRegistration, type StepState } from "../actions";

/** The return leg of the LeagueApps handoff. No payment is verified in phase one. */
export function ReturnFromPayment({
  programId,
  registrationId,
  paymentReference,
  label = "Finish registering",
}: {
  programId: string;
  registrationId: string;
  paymentReference?: string;
  label?: string;
}) {
  const [state, action, pending] = useActionState<StepState, FormData>(finishRegistration, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="program_id" value={programId} />
      <input type="hidden" name="registration_id" value={registrationId} />
      {paymentReference && <input type="hidden" name="payment_reference" value={paymentReference} />}
      <FormError>{state.error}</FormError>
      <button type="submit" disabled={pending} className={`${buttonPrimary} w-full`}>
        {pending ? "Finishing…" : label}
      </button>
    </form>
  );
}
