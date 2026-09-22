"use client";

import { useActionState } from "react";
import { beginRegistration, type StepState } from "./actions";
import { buttonPrimary } from "@/components/form";

export function RegisterButton({ programId, label }: { programId: string; label: string }) {
  const [state, action, pending] = useActionState<StepState, FormData>(beginRegistration, {});

  return (
    <form action={action} className="flex-grow">
      <input type="hidden" name="program_id" value={programId} />
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
