"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BallotChoices = { category_id: string; member_ids: string[] }[];
export type BallotResult = { ok?: true; error?: string };

export async function submitBallot(programId: string, choices: BallotChoices): Promise<BallotResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_ballot", { p_program: programId, p_choices: choices });
  if (error) {
    // Messages raised by submit_ballot are written for players; pass them through.
    return { error: error.message || "We couldn't save your ballot. Try again." };
  }
  revalidatePath("/home");
  revalidatePath(`/vote/${programId}`);
  return { ok: true };
}
