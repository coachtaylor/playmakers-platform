"use client";

import { useEffect, useState } from "react";

/**
 * Supabase reports a failed email link in the URL fragment (`#error=…`), which never
 * reaches the server. Without this the page renders as if nothing happened — or, worse,
 * still showing whatever went wrong last time.
 */
export function LinkError() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const params = new URLSearchParams(hash);
    if (!params.get("error") && !params.get("error_code")) return;

    setMessage(
      params.get("error_code") === "otp_expired"
        ? "That sign-in link had already been used, or a newer one replaced it. Each email works once. Send yourself a fresh link below and open it on this device."
        : "That sign-in link didn't work. Send yourself a fresh one below.",
    );

    // Don't leave the error in the URL for the next reload.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  if (!message) return null;

  return (
    <p className="rounded-md bg-pmc-red/10 p-3 text-sm text-pmc-red" role="alert">
      {message}
    </p>
  );
}
