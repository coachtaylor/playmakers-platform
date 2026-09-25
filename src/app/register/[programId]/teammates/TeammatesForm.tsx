"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  Avatar,
  Field,
  FormError,
  StepBody,
  StickyBar,
  TextInput,
  buttonGhost,
  buttonSmall,
  inputClass,
} from "@/components/form";
import { SubmitButton } from "@/components/SubmitButton";
import {
  formatPhone,
  invitePath,
  type RegistrationBundle,
  type TeammateCandidate,
  type TeammateRequest,
} from "@/lib/registration";
import {
  addTeammate,
  editTeammate,
  finishTeammates,
  markInviteSent,
  removeTeammate,
  type StepState,
} from "../actions";
import { STEP_FORM_ID } from "../StepFrame";

const MAX_REQUESTS = 2;

type Action = (prev: StepState, data: FormData) => Promise<StepState>;

export function TeammatesForm({
  programId,
  bundle,
  candidates,
  origin: serverOrigin,
}: {
  programId: string;
  bundle: RegistrationBundle;
  candidates: TeammateCandidate[];
  /** Read from the request headers, so a link is whole before React hydrates. */
  origin: string;
}) {
  const registrationId = bundle.registration.id;
  const requests = bundle.teammate_requests;
  const used = requests.length;
  const full = used >= MAX_REQUESTS;

  const [query, setQuery] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [finishState, finishAction] = useActionState<StepState, FormData>(finishTeammates, {});

  // Behind a proxy that rewrites the host, trust the browser once it is running.
  const [origin, setOrigin] = useState(serverOrigin);
  useEffect(() => setOrigin(window.location.origin), []);

  const q = query.trim().toLowerCase();
  const matches = q
    ? candidates.filter((c) => !c.already_requested && c.display_name.toLowerCase().includes(q)).slice(0, 6)
    : [];

  function run(action: Action, fields: Record<string, string>, after?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const data = new FormData();
      data.set("program_id", programId);
      data.set("registration_id", registrationId);
      for (const [k, v] of Object.entries(fields)) data.set(k, v);
      const result = await action({}, data);
      if (result.error) setError(result.error);
      else after?.();
    });
  }

  return (
    <>
      <StepBody>
        <p className="text-xs leading-relaxed text-muted">
          Pick up to 2 people you want to be drafted with. Captains draft you as a unit when they can.
          Requests only count when both of you list each other.
        </p>

        <FormError>{error ?? finishState.error}</FormError>

        {!full && (
          <div>
            <Field label="Search registered players" htmlFor="teammate-search">
              <input
                id="teammate-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name or Instagram handle"
                className={inputClass}
              />
            </Field>
            {q && matches.length === 0 && (
              <p className="mt-2 text-xs text-muted">
                No registered player matches that. If they haven&apos;t registered yet, invite them below.
              </p>
            )}
            {matches.length > 0 && (
              <ul className="mt-2 flex flex-col gap-2">
                {matches.map((c) => (
                  <li
                    key={c.member_id}
                    className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3"
                  >
                    <Avatar initials={c.initials} />
                    <span className="flex min-w-0 flex-grow flex-col">
                      <span className="text-[15px] font-semibold">{c.display_name}</span>
                      <span className="text-xs text-muted">
                        {c.requested_you ? "Registered · requested you already" : "Registered"}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(addTeammate, { target_member_id: c.member_id }, () => setQuery(""))
                      }
                      className={`${buttonSmall} border border-line bg-surface hover:bg-ground disabled:opacity-60`}
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <section className="flex flex-col gap-2.5">
          {requests.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              programId={programId}
              origin={origin}
              pending={pending}
              onSave={(fields, after) => run(editTeammate, { request_id: r.id, ...fields }, after)}
              onRemove={() => run(removeTeammate, { request_id: r.id })}
              onSent={() => run(markInviteSent, { request_id: r.id })}
            />
          ))}
          {used > 0 && (
            <p className="text-right text-xs text-muted">
              {used} of {MAX_REQUESTS} requests used
            </p>
          )}
        </section>

        {!full && (
          <section className="flex flex-col gap-1.5 rounded-lg border border-line bg-ground p-4">
            <span className="text-sm font-semibold">Not registered yet?</span>
            <span className="text-xs leading-relaxed text-muted">
              Add them by phone number or handle. You get a link to send them, and the request activates
              when they register. If they turn out to be registered already, we&apos;ll say so.
            </span>
            {inviting ? (
              <div className="mt-1 flex flex-col gap-2">
                <TextInput name="invite_name" id="invite_name" placeholder="Their name" aria-label="Their name" />
                <TextInput
                  id="invite_phone"
                  name="invite_phone"
                  type="tel"
                  placeholder="(602) 000-0000"
                  aria-label="Their phone number"
                />
                <TextInput
                  id="invite_handle"
                  name="invite_handle"
                  placeholder="@theirhandle (optional)"
                  aria-label="Their Instagram handle"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const value = (id: string) =>
                        (document.getElementById(id) as HTMLInputElement | null)?.value ?? "";
                      run(
                        addTeammate,
                        {
                          invite_name: value("invite_name"),
                          invite_phone: value("invite_phone"),
                          invite_handle: value("invite_handle"),
                        },
                        () => setInviting(false),
                      );
                    }}
                    className={`${buttonSmall} bg-pmc-red text-white hover:bg-pmc-red-dark disabled:opacity-60`}
                  >
                    Add them
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviting(false)}
                    className={`${buttonSmall} border border-line bg-surface`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setInviting(true)}
                className={`${buttonGhost} mt-1 h-10 self-start px-4 text-sm`}
              >
                Invite by phone
              </button>
            )}
          </section>
        )}
      </StepBody>

      <form id={STEP_FORM_ID} action={finishAction}>
        <input type="hidden" name="program_id" value={programId} />
        <input type="hidden" name="registration_id" value={registrationId} />
        <StickyBar
          backHref={`/register/${programId}/profile`}
          note="You can skip this. You can change requests until registration closes."
        >
          <SubmitButton className="flex-grow">Continue</SubmitButton>
        </StickyBar>
      </form>
    </>
  );
}

/**
 * One request. An invited person's details are editable and carry their own link;
 * a registered player's are shown but not editable — they are that player's to change.
 */
function RequestCard({
  request,
  programId,
  origin,
  pending,
  onSave,
  onRemove,
  onSent,
}: {
  request: TeammateRequest;
  programId: string;
  origin: string;
  pending: boolean;
  onSave: (fields: Record<string, string>, after: () => void) => void;
  onRemove: () => void;
  onSent: () => void;
}) {
  const registered = request.target_member_id !== null;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(request.invite_name ?? "");
  const [phone, setPhone] = useState(formatPhone(request.invite_phone));
  const [handle, setHandle] = useState(request.invite_handle ? `@${request.invite_handle}` : "");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const link = request.invite_token ? `${origin}${invitePath(programId, request.invite_token)}` : null;
  const contact = [formatPhone(request.invite_phone), request.invite_handle ? `@${request.invite_handle}` : ""]
    .filter(Boolean)
    .join(" · ");

  const status = registered
    ? request.mutual
      ? "Registered · requested you back"
      : "Registered · waiting for them to request you back"
    : request.invite_sent_at
      ? "Not registered yet · link sent"
      : "Not registered yet · send them the link";

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setCopyFailed(false);
      onSent();
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center gap-3">
        <Avatar initials={request.initials ?? "?"} muted={!registered} />
        <span className="flex min-w-0 flex-grow flex-col">
          <span className="text-[15px] font-semibold">{request.name}</span>
          {contact && <span className="truncate text-xs text-muted">{contact}</span>}
          <span className={`text-xs ${request.mutual ? "font-semibold text-good" : "text-muted"}`}>
            {status}
          </span>
        </span>
        {!registered && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`${buttonSmall} border border-line bg-surface hover:bg-ground`}
          >
            Edit
          </button>
        )}
        <button
          type="button"
          aria-label={`Remove ${request.name}`}
          disabled={pending}
          onClick={onRemove}
          className="h-10 w-10 shrink-0 text-xl text-muted hover:text-ink disabled:opacity-60"
        >
          ×
        </button>
      </div>

      {registered && request.matched_from_invite && (
        <p className="rounded-md bg-ground px-3 py-2 text-xs leading-relaxed">
          <span className="font-semibold text-good">We found a match.</span> This player is already
          registered for this league, so their name and number stay as they have them.
        </p>
      )}

      {editing && (
        <div className="flex flex-col gap-2 rounded-md bg-ground p-3">
          <TextInput
            aria-label="Their name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Their name"
          />
          <TextInput
            aria-label="Their phone number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(602) 000-0000"
          />
          <TextInput
            aria-label="Their Instagram handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@theirhandle (optional)"
          />
          <p className="text-xs leading-relaxed text-muted">
            Changing the number or handle gives them a new link and stops the old one working, in case the
            first message went to the wrong person.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                onSave({ invite_name: name, invite_phone: phone, invite_handle: handle }, () =>
                  setEditing(false),
                )
              }
              className={`${buttonSmall} bg-pmc-red text-white hover:bg-pmc-red-dark disabled:opacity-60`}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setName(request.invite_name ?? "");
                setPhone(formatPhone(request.invite_phone));
                setHandle(request.invite_handle ? `@${request.invite_handle}` : "");
                setEditing(false);
              }}
              className={`${buttonSmall} border border-line bg-surface`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!registered && !editing && link && (
        <div className="flex flex-col gap-2 rounded-md bg-ground p-3">
          <span className="text-xs font-semibold">Their invite link</span>
          <code className="break-all text-xs leading-relaxed text-muted">{link}</code>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className={`${buttonSmall} border border-line bg-surface hover:bg-pmc-red/5`}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            {copyFailed && <span className="text-xs text-muted">Copy it from above.</span>}
          </div>
          <span className="text-xs leading-relaxed text-muted">
            Text it to them yourself — we don&apos;t send it for you yet. It only works for this invite.
          </span>
        </div>
      )}
    </div>
  );
}
