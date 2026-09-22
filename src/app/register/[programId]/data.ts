import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProgramPublic, RegistrationBundle } from "@/lib/registration";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The program page's data. Works for signed-out visitors: program_public() is public. */
export async function loadProgram(programId: string) {
  if (!UUID.test(programId)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("program_public", { p_program: programId });
  const program = ((data ?? []) as ProgramPublic[])[0];
  if (error || !program) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, program, user };
}

/**
 * A step's data. Sends a signed-out visitor to sign in (coming back here), and anyone
 * without a registration back to the program page to start one.
 */
export async function loadStep(programId: string) {
  const { supabase, program, user } = await loadProgram(programId);
  if (!user) redirect(`/login?next=${encodeURIComponent(`/register/${programId}`)}`);

  const { data } = await supabase.rpc("my_registration", { p_program: programId });
  const bundle = data as RegistrationBundle | null;
  if (!bundle) redirect(`/register/${programId}`);

  return { supabase, program, bundle };
}

/** A short-lived URL for a private file in the media bucket. */
export async function signedMediaUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
) {
  if (!path) return null;
  const { data } = await supabase.storage.from("media").createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}
