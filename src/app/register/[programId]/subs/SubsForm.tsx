"use client";

import { useActionState, useState } from "react";
import {
  ChipGroup,
  Field,
  FieldSet,
  FormError,
  Section,
  Select,
  StepBody,
  StickyBar,
  Switch,
} from "@/components/form";
import { SubmitButton } from "@/components/SubmitButton";
import {
  NIGHTS,
  NOTICE_OPTIONS,
  SUB_LOCATIONS,
  SUB_POSITION_OPTIONS,
  type RegistrationBundle,
} from "@/lib/registration";
import { saveSubs, type StepState } from "../actions";
import { STEP_FORM_ID } from "../StepFrame";

export function SubsForm({ programId, bundle }: { programId: string; bundle: RegistrationBundle }) {
  const [state, action] = useActionState<StepState, FormData>(saveSubs, {});
  const subs = bundle.sub_availability;
  // Off unless this player has turned it on before.
  const [enabled, setEnabled] = useState(subs?.enabled ?? false);

  return (
    <form id={STEP_FORM_ID} action={action} className="flex flex-1 flex-col">
      <input type="hidden" name="program_id" value={programId} />
      <input type="hidden" name="registration_id" value={bundle.registration.id} />

      <StepBody>
        <FormError>{state.error}</FormError>

        <Switch
          id="sub_enabled"
          name="enabled"
          checked={enabled}
          onChange={setEnabled}
          label="I can sub for other teams"
          detail="Off by default. Turn it on and captains on the nights you pick can message you when they are short a player."
        />

        {enabled && (
          <Section title="Where and when">
            <FieldSet legend="Locations">
              <ChipGroup name="locations" options={SUB_LOCATIONS} selected={subs?.locations ?? []} />
            </FieldSet>
            <FieldSet legend="Nights">
              <ChipGroup name="nights" options={NIGHTS} selected={subs?.nights ?? []} />
            </FieldSet>
            <Field label="How much notice do you need?" htmlFor="notice_hours">
              <Select
                id="notice_hours"
                name="notice_hours"
                options={NOTICE_OPTIONS}
                defaultValue={subs?.notice_hours?.toString() ?? ""}
                placeholder="Choose one"
              />
            </Field>
            <FieldSet legend="Positions you will sub at">
              <ChipGroup name="positions" options={SUB_POSITION_OPTIONS} selected={subs?.positions ?? []} />
            </FieldSet>
          </Section>
        )}
      </StepBody>

      <StickyBar backHref={`/register/${programId}/teammates`}>
        <SubmitButton className="flex-grow">Continue to agreements</SubmitButton>
      </StickyBar>
    </form>
  );
}
