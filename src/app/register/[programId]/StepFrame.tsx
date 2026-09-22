import Link from "next/link";
import { Shell } from "@/components/Shell";
import { StepHeader } from "@/components/form";
import { REGISTRATION_STEPS, TOTAL_STEPS, programTagline, type ProgramPublic } from "@/lib/registration";

/** The step's one form. "Save and exit" in the header submits it from outside. */
export const STEP_FORM_ID = "step-form";

export function StepFrame({
  program,
  step,
  children,
  exitAsLink = false,
}: {
  program: ProgramPublic;
  step: number;
  children: React.ReactNode;
  /** For a step that saves as you go and has no single form to submit. */
  exitAsLink?: boolean;
}) {
  const meta = REGISTRATION_STEPS.find((s) => s.step === step)!;
  const exitClass = "text-sm font-semibold text-white/80 hover:text-white";

  return (
    <Shell
      padded={false}
      action={
        exitAsLink ? (
          <Link href="/home" className={exitClass}>
            Exit
          </Link>
        ) : (
          <button type="submit" form={STEP_FORM_ID} name="intent" value="exit" className={exitClass}>
            Save and exit
          </button>
        )
      }
    >
      <StepHeader step={step} total={TOTAL_STEPS} title={meta.title} programLabel={programTagline(program)} />
      {children}
    </Shell>
  );
}
