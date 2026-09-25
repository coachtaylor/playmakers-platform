import { headers } from "next/headers";
import { loadStep } from "../data";
import { StepFrame } from "../StepFrame";
import { TeammatesForm } from "./TeammatesForm";
import type { TeammateCandidate } from "@/lib/registration";

export default async function TeammatesStep({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { supabase, program, bundle } = await loadStep(programId);

  // Registered players in this program: first name and last initial only, no emails.
  const { data } = await supabase.rpc("teammate_candidates", {
    p_registration: bundle.registration.id,
    p_query: null,
  });

  // Invite links have to be pasteable into a text message, so they need the origin.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = host ? `${h.get("x-forwarded-proto") ?? "http"}://${host}` : "";

  return (
    <StepFrame program={program} step={3} exitAsLink>
      <TeammatesForm
        programId={programId}
        bundle={bundle}
        candidates={(data ?? []) as TeammateCandidate[]}
        origin={origin}
      />
    </StepFrame>
  );
}
