import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Signed-in user plus their player profile(s). Redirects to /login when signed out. */
export async function requireSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.rpc("my_profile");
  const profiles = (data ?? []) as Profile[];
  const profile = profiles[0] ?? null;
  const isAdmin = profiles.some((p) => p.is_admin);
  return { supabase, user, profile, profiles, isAdmin };
}

/** Same as requireSession, and sends players who haven't finished setup to onboarding. */
export async function requireOnboarded() {
  const session = await requireSession();
  if (session.profile && !session.profile.onboarded_at) redirect("/onboarding");
  return session;
}
