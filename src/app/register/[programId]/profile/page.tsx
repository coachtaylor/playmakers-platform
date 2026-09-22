import { loadStep, signedMediaUrl } from "../data";
import { StepFrame } from "../StepFrame";
import { ProfileForm } from "./ProfileForm";

export default async function ProfileStep({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { supabase, program, bundle } = await loadStep(programId);
  const photoUrl = await signedMediaUrl(supabase, bundle.member.photo_path);

  return (
    <StepFrame program={program} step={2}>
      <ProfileForm programId={programId} orgId={program.org_id} bundle={bundle} photoUrl={photoUrl} />
    </StepFrame>
  );
}
