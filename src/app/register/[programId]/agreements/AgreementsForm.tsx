"use client";

import { useActionState } from "react";
import {
  FormError,
  OptionCard,
  OptionCardGroup,
  Section,
  StepBody,
  StickyBar,
} from "@/components/form";
import { SubmitButton } from "@/components/SubmitButton";
import { MEDIA_CONSENT_OPTIONS, type Agreement, type RegistrationBundle } from "@/lib/registration";
import { saveAgreements, type StepState } from "../actions";
import { STEP_FORM_ID } from "../StepFrame";

const TITLES: Record<Agreement["kind"], { heading: string; accept: string }> = {
  liability: { heading: "Liability waiver", accept: "I have read and accept the liability waiver" },
  refund_policy: { heading: "Refund policy", accept: "I accept the refund policy" },
  code_of_conduct: { heading: "Code of conduct", accept: "I accept the code of conduct" },
};

export function AgreementsForm({ programId, bundle }: { programId: string; bundle: RegistrationBundle }) {
  const [state, action] = useActionState<StepState, FormData>(saveAgreements, {});
  const { agreements, member } = bundle;

  return (
    <form id={STEP_FORM_ID} action={action} className="flex flex-1 flex-col">
      <input type="hidden" name="program_id" value={programId} />
      <input type="hidden" name="registration_id" value={bundle.registration.id} />

      <StepBody>
        <FormError>{state.error}</FormError>

        {agreements.length === 0 && (
          <Section title="Agreements">
            <p className="text-sm text-muted">
              No agreements are on file for this league yet. Ask the commissioner to add the liability waiver
              and refund policy before players register.
            </p>
          </Section>
        )}

        {agreements.map((a) => (
          <Section key={a.id} title={TITLES[a.kind].heading}>
            {/* Only the liability waiver shows its text in a scroll box, as in the design. */}
            {a.kind === "liability" && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-line bg-ground p-3 text-[13px] leading-relaxed whitespace-pre-line text-muted">
                {a.body}
              </div>
            )}
            <input type="hidden" name="required_version" value={a.id} />
            <OptionCardGroup>
              <OptionCard
                type="checkbox"
                name="accept_version"
                value={a.id}
                title={TITLES[a.kind].accept}
                detail={
                  a.kind === "liability" ? (
                    <>Version {a.version_label}. We keep a record of which version you accepted.</>
                  ) : (
                    a.body
                  )
                }
                defaultChecked={Boolean(a.accepted_at)}
              />
            </OptionCardGroup>
          </Section>
        ))}

        <Section
          title="Photos and videos of you"
          intro="This is separate from the waiver. Any choice lets you play, and you can change it any time from your profile."
        >
          <fieldset>
            <legend className="sr-only">Photos and videos of you</legend>
            <OptionCardGroup>
              {MEDIA_CONSENT_OPTIONS.map((o) => (
                <OptionCard
                  key={o.value}
                  name="media_consent"
                  value={o.value}
                  title={o.title}
                  detail={o.detail}
                  defaultChecked={member.media_consent === o.value}
                  required
                />
              ))}
            </OptionCardGroup>
          </fieldset>
        </Section>
      </StepBody>

      <StickyBar backHref={`/register/${programId}/subs`}>
        <SubmitButton className="flex-grow">Continue to payment</SubmitButton>
      </StickyBar>
    </form>
  );
}
