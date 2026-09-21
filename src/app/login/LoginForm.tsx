"use client";

import { useActionState } from "react";
import { sendLoginLink, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendLoginLink, {});

  if (state.sentTo) {
    return (
      <div className="space-y-2" role="status">
        <p className="text-lg font-semibold">Check your email</p>
        <p className="text-muted">
          We sent a sign-in link to <strong className="text-ink">{state.sentTo}</strong>. Open it on this device. The
          link works once and expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-semibold">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="the email you registered with"
          className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-base"
        />
      </div>
      {state.error && (
        <p className="text-sm text-pmc-red" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-pmc-red px-4 py-3 font-semibold text-white hover:bg-pmc-red-dark disabled:opacity-60"
      >
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
