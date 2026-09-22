"use client";

import { useFormStatus } from "react-dom";
import { buttonGhost, buttonPrimary } from "./form";

/** Primary submit for a form action, disabled with a "Saving…" label while it runs. */
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
  className = "",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "ghost";
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`${variant === "primary" ? buttonPrimary : buttonGhost} ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
