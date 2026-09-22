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

  return (
    <StepFrame program={program} step={3} exitAsLink>
      <TeammatesForm
        programId={programId}
        bundle={bundle}
        candidates={(data ?? []) as TeammateCandidate[]}
      />
    </StepFrame>
  );
}
