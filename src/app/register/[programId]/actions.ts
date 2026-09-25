"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stepHref } from "@/lib/registration";

export type StepState = { error?: string };

/**
 * The RPCs raise messages meant for players, and those all start with a capital letter.
 * Anything else is internal, so it gets the house apology instead.
 */
function friendly(message?: string) {
  const m = (message ?? "").trim();
  if (m && /^[A-Z]/.test(m)) return m;
  return "We couldn't save that. Try again, and tell Cheyenne if it keeps happening.";
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function list(formData: FormData, key: string) {
  return formData.getAll(key).filter((v): v is string => typeof v === "string" && v !== "");
}

/** "Save and exit" in the header submits the step form with this intent. */
function nextHref(formData: FormData, programId: string, step: number) {
  return text(formData, "intent") === "exit" ? "/home" : stepHref(programId, step + 1);
}

/* -------------------------------------------------------------------------- */
/* Starting                                                                    */
/* -------------------------------------------------------------------------- */

export async function beginRegistration(prev: StepState, formData: FormData): Promise<StepState> {
  const programId = text(formData, "program_id");
  const supabase = await createClient();
  // The invite token, when they arrived on a teammate's link. An unknown or revoked
  // one is ignored: it must never stand between someone and their own registration.
  const { error } = await supabase.rpc("start_registration", {
    p_program: programId,
    p_invite: text(formData, "invite") || null,
  });
  if (error) return { error: friendly(error.message) };
  redirect(stepHref(programId, 1));
}

/** For someone who already had a registration open when the invite link arrived. */
export async function claimInvite(prev: StepState, formData: FormData): Promise<StepState> {
  const programId = text(formData, "program_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_invite", {
    p_registration: text(formData, "registration_id"),
    p_invite: text(formData, "invite"),
  });
  if (error) return { error: friendly(error.message) };

  const next = text(formData, "next");
  redirect(next.startsWith(`/register/${programId}`) ? next : `/register/${programId}`);
}

/* -------------------------------------------------------------------------- */
/* Step 1: about you                                                           */
/* -------------------------------------------------------------------------- */

export async function saveIdentity(prev: StepState, formData: FormData): Promise<StepState> {
  const programId = text(formData, "program_id");
  const chosen = text(formData, "pronouns");
  const pronouns = chosen === "other" ? text(formData, "pronouns_other") : chosen;

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_registration_step", {
    p_registration: text(formData, "registration_id"),
    p_step: 1,
    p_data: {
      first_name: text(formData, "first_name"),
      last_name: text(formData, "last_name"),
      preferred_name: text(formData, "preferred_name"),
      pronouns,
      phone: text(formData, "phone"),
      date_of_birth: text(formData, "date_of_birth"),
      emergency_name: text(formData, "emergency_name"),
      emergency_phone: text(formData, "emergency_phone"),
      emergency_relationship: text(formData, "emergency_relationship"),
    },
  });
  if (error) return { error: friendly(error.message) };
  redirect(nextHref(formData, programId, 1));
}

/* -------------------------------------------------------------------------- */
/* Step 2: player profile                                                      */
/* -------------------------------------------------------------------------- */

export async function saveProfile(prev: StepState, formData: FormData): Promise<StepState> {
  const programId = text(formData, "program_id");
  const registrationId = text(formData, "registration_id");
  const supabase = await createClient();

  const { error } = await supabase.rpc("save_registration_step", {
    p_registration: registrationId,
    p_step: 2,
    p_data: {
      positions_played: list(formData, "positions_played"),
      preferred_offense: text(formData, "preferred_offense"),
      preferred_defense: text(formData, "preferred_defense"),
      qb_willing: text(formData, "qb_willing") || null,
      qb_years: text(formData, "qb_years"),
      years_playing: text(formData, "years_playing"),
      experience_type: text(formData, "experience_type"),
      route_familiarity: text(formData, "route_familiarity"),
      athletic_history: text(formData, "athletic_history"),
      height_ft: text(formData, "height_ft"),
      height_in: text(formData, "height_in"),
      jersey_name: text(formData, "jersey_name"),
      jersey_number: text(formData, "jersey_number"),
      shirt_size: text(formData, "shirt_size"),
      instagram_handle: text(formData, "instagram_handle"),
      heard_about: text(formData, "heard_about"),
    },
  });
  if (error) return { error: friendly(error.message) };

  const photoError = await uploadHeadshot(supabase, formData, registrationId);
  if (photoError) return { error: photoError };

  redirect(nextHref(formData, programId, 2));
}

const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

/** Writes the file to {org_id}/profiles/ and records the path on the member row. */
async function uploadHeadshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  registrationId: string,
) {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return null;
  if (photo.size > 8 * 1024 * 1024) return "That photo is larger than 8 MB. Try a smaller one.";

  const ext = PHOTO_TYPES[photo.type];
  if (!ext) return "Use a JPEG, PNG or WebP photo.";

  const orgId = text(formData, "org_id");
  const memberId = text(formData, "member_id");
  const path = `${orgId}/profiles/${memberId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("media").upload(path, photo, {
    contentType: photo.type,
  });
  if (uploadError) return "We couldn't upload that photo. Try again, or add it later from your profile.";

  const { error } = await supabase.rpc("set_profile_photo", {
    p_registration: registrationId,
    p_path: path,
  });
  if (error) return friendly(error.message);
  return null;
}

/* -------------------------------------------------------------------------- */
/* Step 3: teammate requests                                                   */
/* -------------------------------------------------------------------------- */

export async function addTeammate(prev: StepState, formData: FormData): Promise<StepState> {
  const programId = text(formData, "program_id");
  const supabase = await createClient();
  const target = text(formData, "target_member_id");

  const { error } = await supabase.rpc("request_teammate", {
    p_registration: text(formData, "registration_id"),
    p_target_member: target || null,
    p_name: text(formData, "invite_name") || null,
    p_phone: text(formData, "invite_phone") || null,
    p_handle: text(formData, "invite_handle") || null,
  });
  if (error) return { error: friendly(error.message) };

  revalidatePath(`/register/${programId}/teammates`);
  return {};
}

/**
 * Correcting an invited teammate's details. Changing the number or the handle mints a
 * new token, so the message already sent stops working — the point of the whole design.
 * A player who is registered is not editable; the RPC refuses it.
 */
export async function editTeammate(prev: StepState, formData: FormData): Promise<StepState> {
  const programId = text(formData, "program_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_teammate_invite", {
    p_request: text(formData, "request_id"),
    p_name: text(formData, "invite_name") || null,
    p_phone: text(formData, "invite_phone") || null,
    p_handle: text(formData, "invite_handle") || null,
  });
  if (error) return { error: friendly(error.message) };

  revalidatePath(`/register/${programId}/teammates`);
  return {};
}

/** Records that the player sent the link themselves, since we don't text it for them. */
export async function markInviteSent(prev: StepState, formData: FormData): Promise<StepState> {
  const programId = text(formData, "program_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_invite_sent", {
    p_request: text(formData, "request_id"),
  });
  if (error) return { error: friendly(error.message) };

  revalidatePath(`/register/${programId}/teammates`);
  return {};
}

export async function removeTeammate(prev: StepState, formData: FormData): Promise<StepState> {
  const programId = text(formData, "program_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_teammate_request", {
    p_request: text(formData, "request_id"),
  });
  if (error) return { error: friendly(error.message) };

  revalidatePath(`/register/${programId}/teammates`);
  return {};
}

/** Step 3 has no fields of its own: it records that the step was seen and moves on. */
export async function finishTeammates(prev: StepState, formData: FormData): Promise<StepState> {
  const programId = text(formData, "program_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_registration_step", {
    p_registration: text(formData, "registration_id"),
    p_step: 3,
    p_data: {},
  });
  if (error) return { error: friendly(error.message) };
  redirect(nextHref(formData, programId, 3));
}

/* -------------------------------------------------------------------------- */
/* Step 4: sub availability                                                    */
/* -------------------------------------------------------------------------- */

export async function saveSubs(prev: StepState, formData: FormData): Promise<StepState> {
  const programId = text(formData, "program_id");
  const enabled = formData.get("enabled") === "on";
  const notice = text(formData, "notice_hours");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_sub_availability", {
    p_registration: text(formData, "registration_id"),
    p_enabled: enabled,
    p_locations: list(formData, "locations"),
    p_nights: list(formData, "nights"),
    p_notice_hours: notice === "" ? null : Number(notice),
    p_positions: list(formData, "positions"),
  });
  if (error) return { error: friendly(error.message) };
  redirect(nextHref(formData, programId, 4));
}

/* -------------------------------------------------------------------------- */
/* Step 5: agreements                                                          */
/* -------------------------------------------------------------------------- */

export async function saveAgreements(prev: StepState, formData: FormData): Promise<StepState> {
  const programId = text(formData, "program_id");
  const registrationId = text(formData, "registration_id");
  const versions = list(formData, "accept_version");
  const required = list(formData, "required_version");

  const missing = required.filter((id) => !versions.includes(id));
  if (missing.length > 0) {
    return { error: "Accept the liability waiver and the refund policy to keep going." };
  }

  const supabase = await createClient();
  // Recorded with the version, the time and the IP, as the spec requires.
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim();

  const { error: waiverError } = await supabase.rpc("accept_waiver", {
    p_registration: registrationId,
    p_versions: versions,
    p_ip: ip || null,
    p_user_agent: h.get("user-agent"),
  });
  if (waiverError) return { error: friendly(waiverError.message) };

  // Media consent is the member's own field, never part of the waiver.
  const { error } = await supabase.rpc("save_registration_step", {
    p_registration: registrationId,
    p_step: 5,
    p_data: { media_consent: text(formData, "media_consent") },
  });
  if (error) return { error: friendly(error.message) };

  redirect(nextHref(formData, programId, 5));
}

/* -------------------------------------------------------------------------- */
/* Step 6: payment handoff                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Phase one: PlayMakers takes no money here. This records the plan, holds the spot for
 * 15 minutes and sends the player to LeagueApps to pay. They come back to /return.
 */
export async function startPayment(prev: StepState, formData: FormData): Promise<StepState> {
  const programId = text(formData, "program_id");
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("begin_payment_handoff", {
    p_registration: text(formData, "registration_id"),
    p_plan: text(formData, "payment_plan") || "full",
    p_discount_code: text(formData, "discount_code") || null,
  });
  if (error) return { error: friendly(error.message) };

  const handoff = data as { payment_url: string | null } | null;
  const returnTo = `/register/${programId}/return`;

  if (handoff?.payment_url) {
    const url = new URL(handoff.payment_url);
    const h = await headers();
    const origin = h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;
    if (origin) url.searchParams.set("return_url", `${origin}${returnTo}`);
    redirect(url.toString());
  }

  // No LeagueApps link on the program yet: show what the handoff will do instead.
  redirect(`/register/${programId}/handoff`);
}

/** The return leg of the handoff. No payment is verified in phase one. */
export async function finishRegistration(prev: StepState, formData: FormData): Promise<StepState> {
  const programId = text(formData, "program_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_registration", {
    p_registration: text(formData, "registration_id"),
    p_payment_reference: text(formData, "payment_reference") || null,
  });
  if (error) return { error: friendly(error.message) };
  redirect(`/register/${programId}/done`);
}
