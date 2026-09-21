"use client";

import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";
import type { MediaConsent } from "@/lib/types";

const CONSENT_OPTIONS: { value: MediaConsent; title: string; detail: string }[] = [
  {
    value: "public",
    title: "Share me publicly",
    detail: "Photos and videos of you can appear on PlayMakers' Instagram, TikTok and website, and you can share them yourself.",
  },
  {
    value: "league_only",
    title: "League only",
    detail: "Other PlayMakers players can see photos you're in when they sign in here. Nothing of you gets posted publicly.",
  },
  {
    value: "none",
    title: "Don't tag or share me",
    detail: "No one can tag you in photos or videos, and nothing of you gets posted.",
  },
];

export function OnboardingForm({
  firstName,
  preferredName,
  pronouns,
  consent,
}: {
  firstName: string;
  preferredName: string | null;
  pronouns: string | null;
  consent: MediaConsent | null;
}) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="preferred_name" className="block text-sm font-semibold">
            What should we call you?
          </label>
          <input
            id="preferred_name"
            name="preferred_name"
            defaultValue={preferredName ?? firstName}
            className="w-full rounded-md border border-line bg-white px-3 py-2.5"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="pronouns" className="block text-sm font-semibold">
            Pronouns <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="pronouns"
            name="pronouns"
            defaultValue={pronouns ?? ""}
            placeholder="e.g. she/her"
            className="w-full rounded-md border border-line bg-white px-3 py-2.5"
          />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Photos and videos of you</legend>
        <p className="text-sm text-muted">
          A photographer shoots our games. Choose what happens with photos you&apos;re in. You can change this any time.
        </p>
        {CONSENT_OPTIONS.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer gap-3 rounded-md border border-line bg-white p-3 has-[:checked]:border-pmc-red has-[:checked]:bg-pmc-red/5"
          >
            <input
              type="radio"
              name="media_consent"
              value={o.value}
              defaultChecked={consent === o.value}
              required
              className="mt-1 accent-[var(--pmc-red)]"
            />
            <span>
              <span className="block font-semibold">{o.title}</span>
              <span className="block text-sm text-muted">{o.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

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
        {pending ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}
