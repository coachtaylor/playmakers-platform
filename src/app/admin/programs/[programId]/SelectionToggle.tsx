"use client";

import { useOptimistic, useTransition } from "react";
import { toggleSelection } from "./actions";

export function SelectionToggle({
  programId,
  categoryId,
  memberId,
  selected,
  label,
}: {
  programId: string;
  categoryId: string;
  memberId: string;
  selected: boolean;
  label: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(selected);
  const [pending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      aria-label={`Select ${label}`}
      checked={optimistic}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.checked;
        startTransition(async () => {
          setOptimistic(next);
          await toggleSelection(programId, categoryId, memberId, next);
        });
      }}
      className="h-5 w-5 accent-[var(--pmc-red)]"
    />
  );
}
