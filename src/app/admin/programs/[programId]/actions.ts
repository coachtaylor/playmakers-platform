"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function paths(programId: string) {
  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath("/admin");
  revalidatePath("/home");
}

// datetime-local values have no zone. League time is Phoenix, which is always UTC-7.
function phoenixToIso(value: FormDataEntryValue | null) {
  const v = String(value ?? "").trim();
  return v ? new Date(`${v}:00-07:00`).toISOString() : null;
}

export async function saveVotingWindow(programId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_voting_window", {
    p_program: programId,
    p_opens: phoenixToIso(formData.get("opens")),
    p_closes: phoenixToIso(formData.get("closes")),
  });
  if (error) throw new Error(error.message);
  paths(programId);
}

export async function toggleSelection(programId: string, categoryId: string, memberId: string, selected: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_award_selection", {
    p_category: categoryId,
    p_member: memberId,
    p_selected: selected,
  });
  if (error) throw new Error(error.message);
  paths(programId);
}

export async function setPublished(programId: string, published: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_results_published", { p_program: programId, p_published: published });
  if (error) throw new Error(error.message);
  paths(programId);
  revalidatePath(`/results/${programId}`);
}

export type ImportRow = {
  email: string;
  first_name: string;
  last_name: string;
  team: string;
  role: string;
  is_rookie: boolean;
};

export async function importRoster(programId: string, rows: ImportRow[]) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_roster", { p_program: programId, p_rows: rows });
  if (error) return { error: error.message };
  paths(programId);
  return { result: data as { added: number; updated: number; skipped: number } };
}
