"use client";

import { useActionState } from "react";
import {
  FormError,
  OptionCard,
  OptionCardGroup,
  Section,
  StepBody,
  StickyBar,
  TextInput,
} from "@/components/form";
import { SubmitButton } from "@/components/SubmitButton";
import {
  formatLeagueDate,
  formatMoney,
  formatMoneyShort,
  programTitle,
  programWhere,
  type ProgramPublic,
  type RegistrationBundle,
} from "@/lib/registration";
import { startPayment, type StepState } from "../actions";
import { STEP_FORM_ID } from "../StepFrame";

export function PaymentForm({
  programId,
  program,
  bundle,
}: {
  programId: string;
  program: ProgramPublic;
  bundle: RegistrationBundle;
}) {
  const [state, action] = useActionState<StepState, FormData>(startPayment, {});
  const fee = program.fees?.amount_cents ?? null;
  const plan = program.fees?.plan;

  return (
    <form id={STEP_FORM_ID} action={action} className="flex flex-1 flex-col">
      <input type="hidden" name="program_id" value={programId} />
      <input type="hidden" name="registration_id" value={bundle.registration.id} />

      <StepBody>
        <FormError>{state.error}</FormError>

        <Section title="Summary">
          <div className="flex justify-between text-sm">
            <span>{programTitle(program)}</span>
            <span className="font-semibold">{fee ? formatMoney(fee) : "[Fee]"}</span>
          </div>
          <div className="flex justify-between text-sm text-muted">
            <span>{programWhere(program)}</span>
          </div>
          <div className="flex items-center gap-2">
            <TextInput
              name="discount_code"
              aria-label="Discount or payment plan code"
              placeholder="Discount or payment plan code"
              defaultValue={bundle.registration.discount_code ?? ""}
              className="h-10 text-sm"
            />
            <span className="shrink-0 text-xs leading-snug text-muted">
              Codes are applied
              <br />
              at checkout
            </span>
          </div>
          <div className="flex justify-between border-t border-line pt-2.5 text-base font-bold">
            <span>Total due</span>
            <span>{fee ? formatMoney(fee) : "[Fee]"}</span>
          </div>
        </Section>

        <Section title="Pay">
          <fieldset>
            <legend className="sr-only">How you want to pay</legend>
            <OptionCardGroup>
              <OptionCard
                name="payment_plan"
                value="full"
                title="Pay in full"
                detail={fee ? `${formatMoney(fee)} today` : undefined}
                defaultChecked={bundle.registration.payment_plan !== "plan"}
                required
              />
              {plan && (
                <OptionCard
                  name="payment_plan"
                  value="plan"
                  title="Payment plan"
                  detail={
                    <>
                      {plan.installments ?? 2} payments of {formatMoney(plan.amount_cents)}
                      {plan.second_due_on ? `, second on ${formatLeagueDate(plan.second_due_on)}` : ""}
                    </>
                  }
                  defaultChecked={bundle.registration.payment_plan === "plan"}
                />
              )}
            </OptionCardGroup>
          </fieldset>
          <p className="text-xs leading-relaxed text-muted">
            Payment is processed by LeagueApps this season. You will come back here automatically when it is
            done, and your spot is held for 15 minutes while you pay.
          </p>
        </Section>

        <Section>
          <span className="text-sm font-semibold">Optional add-ons</span>
          <span className="text-xs leading-relaxed text-muted">
            [Refund Protection and Accident Medical appear here only if PMC chooses to offer them.]
          </span>
        </Section>
      </StepBody>

      <StickyBar backHref={`/register/${programId}/agreements`}>
        <SubmitButton className="flex-grow" pendingLabel="Sending you to LeagueApps…">
          {fee ? `Pay ${formatMoneyShort(fee)} and finish` : "Continue to payment"}
        </SubmitButton>
      </StickyBar>
    </form>
  );
}
