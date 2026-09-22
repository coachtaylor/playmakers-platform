"use client";

import { useActionState } from "react";
import {
  ChipGroup,
  ChipRadioGroup,
  Field,
  FieldSet,
  FormError,
  OptionCard,
  OptionCardGroup,
  Section,
  Select,
  StepBody,
  StickyBar,
  Textarea,
  TextInput,
} from "@/components/form";
import { SubmitButton } from "@/components/SubmitButton";
import {
  DEFENSE_OPTIONS,
  EXPERIENCE_OPTIONS,
  HEARD_ABOUT_OPTIONS,
  HEIGHT_FEET,
  OFFENSE_OPTIONS,
  POSITION_OPTIONS,
  QB_OPTIONS,
  ROUTE_OPTIONS,
  SHIRT_SIZES,
  YEARS_OPTIONS,
  type RegistrationBundle,
} from "@/lib/registration";
import { saveProfile, type StepState } from "../actions";
import { STEP_FORM_ID } from "../StepFrame";

const INCHES = Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: `${i} in` }));
const FEET = HEIGHT_FEET.map((f) => ({ value: String(f), label: `${f} ft` }));

export function ProfileForm({
  programId,
  orgId,
  bundle,
  photoUrl,
}: {
  programId: string;
  orgId: string;
  bundle: RegistrationBundle;
  photoUrl: string | null;
}) {
  const [state, action] = useActionState<StepState, FormData>(saveProfile, {});
  const { registration, member, profile } = bundle;

  return (
    <form id={STEP_FORM_ID} action={action} className="flex flex-1 flex-col">
      <input type="hidden" name="program_id" value={programId} />
      <input type="hidden" name="registration_id" value={registration.id} />
      <input type="hidden" name="org_id" value={orgId} />
      <input type="hidden" name="member_id" value={member.id} />

      <StepBody>
        <FormError>{state.error}</FormError>

        <p className="text-xs leading-relaxed text-muted">
          This is your draft card. Captains see your answers when they pick teams; they never see a number you
          did not give them.
        </p>

        <Section title="Positions">
          <FieldSet legend="Positions I have played" hint="Pick every one that applies.">
            <ChipGroup
              name="positions_played"
              options={POSITION_OPTIONS}
              selected={profile?.positions_played ?? []}
            />
          </FieldSet>
          <Field label="Preferred position, offense" htmlFor="preferred_offense">
            <Select
              id="preferred_offense"
              name="preferred_offense"
              options={OFFENSE_OPTIONS}
              defaultValue={profile?.preferred_offense ?? ""}
              placeholder="Choose one"
            />
          </Field>
          <Field label="Preferred position, defense" htmlFor="preferred_defense">
            <Select
              id="preferred_defense"
              name="preferred_defense"
              options={DEFENSE_OPTIONS}
              defaultValue={profile?.preferred_defense ?? ""}
              placeholder="Choose one"
            />
          </Field>
        </Section>

        <Section title="Quarterback">
          <FieldSet legend="Would you be a designated QB this season?">
            <OptionCardGroup>
              {QB_OPTIONS.map((o) => (
                <OptionCard
                  key={o.value}
                  name="qb_willing"
                  value={o.value}
                  title={o.title}
                  detail={o.detail}
                  defaultChecked={profile?.qb_willing === o.value}
                />
              ))}
            </OptionCardGroup>
          </FieldSet>
          <Field label="Years playing QB" htmlFor="qb_years">
            <Select
              id="qb_years"
              name="qb_years"
              options={YEARS_OPTIONS}
              defaultValue={profile?.qb_years ?? ""}
              placeholder="Choose one"
            />
          </Field>
        </Section>

        <Section title="Experience">
          <Field label="Years playing flag football" htmlFor="years_playing">
            <Select
              id="years_playing"
              name="years_playing"
              options={YEARS_OPTIONS}
              defaultValue={profile?.years_playing ?? ""}
              placeholder="Choose one"
            />
          </Field>
          <Field label="Experience type" htmlFor="experience_type">
            <Select
              id="experience_type"
              name="experience_type"
              options={EXPERIENCE_OPTIONS}
              defaultValue={profile?.experience_type ?? ""}
              placeholder="Choose one"
            />
          </Field>
          <Field label="Route tree familiarity" htmlFor="route_familiarity">
            <Select
              id="route_familiarity"
              name="route_familiarity"
              options={ROUTE_OPTIONS}
              defaultValue={profile?.route_familiarity ?? ""}
              placeholder="Choose one"
            />
          </Field>
          <Field label="Athletic history" htmlFor="athletic_history" optional>
            <Textarea
              id="athletic_history"
              name="athletic_history"
              defaultValue={profile?.athletic_history ?? ""}
              placeholder="Sports you played, at what level, anything a captain should know"
            />
          </Field>
        </Section>

        <Section title="Height and jersey">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Height, feet" htmlFor="height_ft">
              <Select
                id="height_ft"
                name="height_ft"
                options={FEET}
                defaultValue={profile?.height_ft?.toString() ?? ""}
                placeholder="—"
              />
            </Field>
            <Field label="Inches" htmlFor="height_in">
              <Select
                id="height_in"
                name="height_in"
                options={INCHES}
                defaultValue={profile?.height_in?.toString() ?? ""}
                placeholder="—"
              />
            </Field>
          </div>
          <div className="grid grid-cols-[2fr_1fr] gap-2.5">
            <Field label="Jersey name" htmlFor="jersey_name">
              <TextInput
                id="jersey_name"
                name="jersey_name"
                defaultValue={profile?.jersey_name ?? member.last_name.toUpperCase()}
                maxLength={14}
              />
            </Field>
            <Field label="Number" htmlFor="jersey_number">
              <TextInput
                id="jersey_number"
                name="jersey_number"
                inputMode="numeric"
                pattern="[0-9]{1,3}"
                maxLength={3}
                defaultValue={profile?.jersey_number ?? ""}
              />
            </Field>
          </div>
          <p className="-mt-1.5 text-xs leading-relaxed text-muted">
            Numbers are checked for duplicates once you are on a team.
          </p>
          <FieldSet legend="Shirt size">
            <ChipRadioGroup name="shirt_size" options={SHIRT_SIZES} selected={profile?.shirt_size} />
          </FieldSet>
        </Section>

        <Section title="Photo">
          <div className="flex items-center gap-3.5">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt="Your headshot"
                className="h-22 w-22 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-22 w-22 shrink-0 items-center justify-center rounded-lg bg-ink text-center text-[11px] text-white/70">
                [Headshot]
              </div>
            )}
            <div className="flex flex-col gap-2">
              <input
                type="file"
                name="photo"
                accept="image/jpeg,image/png,image/webp"
                aria-label={photoUrl ? "Replace your photo" : "Upload a photo"}
                className="text-sm file:mr-3 file:h-10 file:rounded-md file:border file:border-line file:bg-surface file:px-4 file:text-sm file:font-semibold file:text-ink"
              />
              <span className="text-xs leading-relaxed text-muted">
                Used on your draft card, the all-star ballot and your profile. Face visible, no sunglasses.
              </span>
            </div>
          </div>
        </Section>

        <Section title="Social">
          <Field
            label="Instagram handle"
            htmlFor="instagram_handle"
            optional
            hint="So we can tag you in game photos, if your media setting allows it."
          >
            <TextInput
              id="instagram_handle"
              name="instagram_handle"
              defaultValue={member.instagram_handle ? `@${member.instagram_handle}` : ""}
              placeholder="@yourhandle"
            />
          </Field>
          <Field label="How did you hear about us?" htmlFor="heard_about">
            <Select
              id="heard_about"
              name="heard_about"
              options={HEARD_ABOUT_OPTIONS}
              defaultValue={registration.heard_about ?? ""}
              placeholder="Choose one"
            />
          </Field>
        </Section>
      </StepBody>

      <StickyBar backHref={`/register/${programId}/identity`}>
        <SubmitButton className="flex-grow">Continue to teammates</SubmitButton>
      </StickyBar>
    </form>
  );
}
