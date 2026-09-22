"use client";

import { useActionState, useState } from "react";
import {
  Field,
  FieldSet,
  FormError,
  Section,
  Select,
  StepBody,
  StickyBar,
  TextInput,
  inputClass,
} from "@/components/form";
import { SubmitButton } from "@/components/SubmitButton";
import { PRONOUN_OPTIONS, RELATIONSHIP_OPTIONS, type RegistrationBundle } from "@/lib/registration";
import { saveIdentity, type StepState } from "../actions";
import { STEP_FORM_ID } from "../StepFrame";

export function IdentityForm({ programId, bundle }: { programId: string; bundle: RegistrationBundle }) {
  const [state, action] = useActionState<StepState, FormData>(saveIdentity, {});
  const { member, registration } = bundle;

  const known = member.pronouns && (PRONOUN_OPTIONS as readonly string[]).includes(member.pronouns);
  const [pronouns, setPronouns] = useState(member.pronouns ? (known ? member.pronouns : "other") : "");

  return (
    <form id={STEP_FORM_ID} action={action} className="flex flex-1 flex-col">
      <input type="hidden" name="program_id" value={programId} />
      <input type="hidden" name="registration_id" value={registration.id} />

      <StepBody>
        <FormError>{state.error}</FormError>

        <Section title="Identity">
          <Field label="First name" htmlFor="first_name">
            <TextInput
              id="first_name"
              name="first_name"
              defaultValue={member.first_name}
              autoComplete="given-name"
              required
            />
          </Field>
          <Field label="Last name" htmlFor="last_name">
            <TextInput
              id="last_name"
              name="last_name"
              defaultValue={member.last_name}
              autoComplete="family-name"
            />
          </Field>
          <Field label="Preferred name" htmlFor="preferred_name" optional>
            <TextInput
              id="preferred_name"
              name="preferred_name"
              defaultValue={member.preferred_name ?? ""}
              placeholder="What captains and teammates call you"
            />
          </Field>

          <FieldSet legend="Pronouns" optional>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {[...PRONOUN_OPTIONS, "other"].map((value) => (
                  <label
                    key={value}
                    className="inline-flex h-9 cursor-pointer items-center rounded-full border border-line bg-white px-3.5 text-sm font-medium text-ink has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white"
                  >
                    <input
                      type="radio"
                      name="pronouns"
                      value={value}
                      checked={pronouns === value}
                      onChange={() => setPronouns(value)}
                      className="sr-only"
                    />
                    {value === "other" ? "Other" : value}
                  </label>
                ))}
              </div>
              {pronouns === "other" && (
                <TextInput
                  name="pronouns_other"
                  aria-label="Your pronouns"
                  defaultValue={known ? "" : (member.pronouns ?? "")}
                  placeholder="Type your pronouns"
                />
              )}
            </div>
          </FieldSet>

          <Field label="Email" hint="Your sign-in link and game updates go here.">
            <input
              value={member.email}
              readOnly
              aria-label="Email"
              className={`${inputClass} bg-ground text-muted`}
            />
          </Field>
          <Field label="Mobile" htmlFor="phone">
            <TextInput
              id="phone"
              name="phone"
              type="tel"
              defaultValue={member.phone ?? ""}
              placeholder="(602) 000-0000"
              autoComplete="tel"
            />
          </Field>
          <Field label="Date of birth" htmlFor="date_of_birth" hint="You must be 18 or older to play.">
            <TextInput
              id="date_of_birth"
              name="date_of_birth"
              type="date"
              defaultValue={member.date_of_birth ?? ""}
              required
            />
          </Field>
        </Section>

        <Section
          title="Emergency contact"
          intro="Your captain can reach this person from the roster without an admin login."
        >
          <Field label="Name" htmlFor="emergency_name">
            <TextInput
              id="emergency_name"
              name="emergency_name"
              defaultValue={registration.emergency_name ?? ""}
              placeholder="Full name"
              required
            />
          </Field>
          <Field label="Phone" htmlFor="emergency_phone">
            <TextInput
              id="emergency_phone"
              name="emergency_phone"
              type="tel"
              defaultValue={registration.emergency_phone ?? ""}
              placeholder="(602) 000-0000"
              required
            />
          </Field>
          <Field label="Relationship" htmlFor="emergency_relationship">
            <Select
              id="emergency_relationship"
              name="emergency_relationship"
              options={RELATIONSHIP_OPTIONS}
              defaultValue={registration.emergency_relationship ?? ""}
              placeholder="Choose one"
            />
          </Field>
        </Section>
      </StepBody>

      <StickyBar backHref={`/register/${programId}`}>
        <SubmitButton className="flex-grow">Continue to player profile</SubmitButton>
      </StickyBar>
    </form>
  );
}
