import { loadStep } from "../data";
import { StepFrame } from "../StepFrame";
import { PaymentForm } from "./PaymentForm";

export default async function PaymentStep({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const { program, bundle } = await loadStep(programId);

  return (
    <StepFrame program={program} step={6}>
      <PaymentForm programId={programId} program={program} bundle={bundle} />
    </StepFrame>
  );
}
