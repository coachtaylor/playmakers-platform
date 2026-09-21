import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) return NextResponse.redirect(`${origin}/login?error=link`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=link`);

  // Link any roster rows or staff invites imported after this account was created.
  await supabase.rpc("claim_account");

  const { data } = await supabase.rpc("my_profile");
  const profile = (data ?? [])[0] as { onboarded_at: string | null } | undefined;
  const next = profile && !profile.onboarded_at ? "/onboarding" : "/home";
  return NextResponse.redirect(`${origin}${next}`);
}
