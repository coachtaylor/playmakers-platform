"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; sentTo?: string };

export async function sendLoginLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "Enter the email you used to register for PlayMakers." };
  }

  const h = await headers();
  const origin = h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    // Supabase's built-in email sender is rate limited; say so plainly.
    if (error.status === 429) {
      return { error: "Too many sign-in emails were sent just now. Wait a few minutes and try again." };
    }
    return { error: "We couldn't send your sign-in link. Check the email address and try again." };
  }
  return { sentTo: email };
}
