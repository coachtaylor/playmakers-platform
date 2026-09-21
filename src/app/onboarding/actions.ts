"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error?: string };

export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const consent = String(formData.get("media_consent") ?? "");
  if (!["public", "league_only", "none"].includes(consent)) {
    return { error: "Choose how your photos and videos can be shared." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", {
    p_preferred_name: String(formData.get("preferred_name") ?? ""),
    p_pronouns: String(formData.get("pronouns") ?? ""),
    p_media_consent: consent,
  });
  if (error) return { error: "We couldn't save that. Try again, and tell Cheyenne if it keeps happening." };

  redirect("/home");
}
