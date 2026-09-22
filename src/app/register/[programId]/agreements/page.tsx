import { loadStep } from "../data";
import { StepFrame } from "../StepFrame";
import { AgreementsForm } from "./AgreementsForm";

export default async function AgreementsStep({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { program, bundle } = await loadStep(programId);

  return (
    <StepFrame program={program} step={5}>
      <AgreementsForm programId={programId} bundle={bundle} />
    </StepFrame>
  );
}
