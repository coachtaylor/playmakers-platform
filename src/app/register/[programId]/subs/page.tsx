import { loadStep } from "../data";
import { StepFrame } from "../StepFrame";
import { SubsForm } from "./SubsForm";

export default async function SubsStep({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { program, bundle } = await loadStep(programId);

  return (
    <StepFrame program={program} step={4}>
      <SubsForm programId={programId} bundle={bundle} />
    </StepFrame>
  );
}
