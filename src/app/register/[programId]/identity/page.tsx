import { loadStep } from "../data";
import { StepFrame } from "../StepFrame";
import { IdentityForm } from "./IdentityForm";

export default async function IdentityStep({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { program, bundle } = await loadStep(programId);

  return (
    <StepFrame program={program} step={1}>
      <IdentityForm programId={programId} bundle={bundle} />
    </StepFrame>
  );
}
