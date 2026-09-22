// Shared form furniture for the multi-step flows: the step header with its progress
// bar, the sticky bottom action bar, chip groups, option cards and avatar tiles.
// Everything here is uncontrolled and server-renderable; selection styling is pure CSS
// (`has-[:checked]`, `peer-checked`) so a step still works before React hydrates.

import Link from "next/link";

/* -------------------------------------------------------------------------- */
/* Step header                                                                 */
/* -------------------------------------------------------------------------- */

export function StepHeader({
  step,
  total,
  title,
  programLabel,
}: {
  step: number;
  total: number;
  title: string;
  programLabel: string;
}) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="flex flex-col gap-2 border-b border-line bg-surface px-4 pb-3.5 pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
          Step {step} of {total}
        </span>
        <span className="truncate text-xs text-muted">{programLabel}</span>
      </div>
      <div
        className="h-1 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Step ${step} of ${total}`}
      >
        <div className="h-1 bg-pmc-red" style={{ width: `${pct}%` }} />
      </div>
      <h1 className="font-display text-[26px] leading-none">{title}</h1>
    </div>
  );
}

/** The scrolling middle of a step. */
export function StepBody({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col gap-4 px-4 pb-6 pt-4">{children}</div>;
}

/** A titled card section, as used on every step. */
export function Section({
  title,
  intro,
  children,
}: {
  title?: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3.5 rounded-lg border border-line bg-surface p-4">
      {title && <h2 className="font-display text-lg leading-none">{title}</h2>}
      {intro && <p className="-mt-1 text-xs leading-relaxed text-muted">{intro}</p>}
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Sticky bottom action bar                                                    */
/* -------------------------------------------------------------------------- */

export function StickyBar({
  backHref,
  backLabel = "Back",
  note,
  children,
}: {
  backHref?: string;
  backLabel?: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-0 mt-auto border-t border-line bg-surface/95 px-4 pb-5 pt-3 backdrop-blur">
      {note && <p className="mb-2.5 text-center text-xs leading-relaxed text-muted">{note}</p>}
      <div className="flex gap-2.5">
        {backHref && (
          <Link href={backHref} className={`${buttonGhost} w-24`}>
            {backLabel}
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}

export const buttonBase =
  "inline-flex h-12 items-center justify-center rounded-md px-5 text-base font-semibold transition";
export const buttonPrimary = `${buttonBase} bg-pmc-red text-white hover:bg-pmc-red-dark disabled:opacity-60`;
export const buttonGhost = `${buttonBase} border border-line bg-surface text-ink hover:bg-ground`;
export const buttonSmall = "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold";

/* -------------------------------------------------------------------------- */
/* Inputs                                                                      */
/* -------------------------------------------------------------------------- */

export const inputClass =
  "h-11 w-full rounded-md border border-line bg-white px-3 text-base text-ink placeholder:text-muted/70";
export const textareaClass =
  "min-h-[88px] w-full resize-y rounded-md border border-line bg-white px-3 py-2.5 text-[15px] text-ink placeholder:text-muted/70";
export const selectClass = "h-11 w-full rounded-md border border-line bg-white px-3 text-base text-ink";

export function Field({
  label,
  htmlFor,
  optional = false,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  optional?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold">
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

/** Same as Field, for a group of controls that has no single input to label. */
export function FieldSet({
  legend,
  optional = false,
  hint,
  children,
}: {
  legend: string;
  optional?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-semibold">
        {legend}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </legend>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p>}
    </fieldset>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`${inputClass} ${className}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea {...rest} className={`${textareaClass} ${className}`} />;
}

/** Native select over a list of values, with an optional "choose one" placeholder. */
export function Select({
  options,
  placeholder,
  className = "",
  ...rest
}: {
  options: readonly (string | { value: string; label: string })[];
  placeholder?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`${selectClass} ${className}`}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const value = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        return (
          <option key={value} value={value}>
            {label}
          </option>
        );
      })}
    </select>
  );
}

/* -------------------------------------------------------------------------- */
/* Chips                                                                       */
/* -------------------------------------------------------------------------- */

const chipClass =
  "inline-flex h-9 cursor-pointer items-center rounded-full border border-line bg-white px-3.5 text-sm font-medium text-ink " +
  "has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white";

export type ChipOption = string | { value: string; label: string };

function chipParts(o: ChipOption) {
  return typeof o === "string" ? { value: o, label: o } : o;
}

/** Multi-select chips. Submits repeated `name` values. */
export function ChipGroup({
  name,
  options,
  selected = [],
}: {
  name: string;
  options: readonly ChipOption[];
  selected?: readonly string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const { value, label } = chipParts(o);
        return (
          <label key={value} className={chipClass}>
            <input
              type="checkbox"
              name={name}
              value={value}
              defaultChecked={selected.includes(value)}
              className="sr-only"
            />
            {label}
          </label>
        );
      })}
    </div>
  );
}

/** Single-select chips. */
export function ChipRadioGroup({
  name,
  options,
  selected,
  required = false,
}: {
  name: string;
  options: readonly ChipOption[];
  selected?: string | null;
  required?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const { value, label } = chipParts(o);
        return (
          <label key={value} className={chipClass}>
            <input
              type="radio"
              name={name}
              value={value}
              defaultChecked={selected === value}
              required={required}
              className="sr-only"
            />
            {label}
          </label>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Option cards                                                                */
/* -------------------------------------------------------------------------- */

export function OptionCard({
  type = "radio",
  name,
  value,
  title,
  detail,
  defaultChecked,
  required,
}: {
  type?: "radio" | "checkbox";
  name: string;
  value: string;
  title: string;
  detail?: React.ReactNode;
  defaultChecked?: boolean;
  required?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-white p-3 has-[:checked]:border-pmc-red has-[:checked]:bg-pmc-red/5">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        required={required}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--pmc-red)]"
      />
      <span className="block">
        <span className="block text-[15px] font-semibold">{title}</span>
        {detail && <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{detail}</span>}
      </span>
    </label>
  );
}

export function OptionCardGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* Switch                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A checkbox drawn as a switch. The track is a sibling of the input, so it follows the
 * checked state in CSS with `peer-checked:`. Works uncontrolled (`defaultChecked`) or
 * controlled (`checked` + `onChange`) when a step needs to reveal dependent fields.
 */
export function Switch({
  id,
  name,
  defaultChecked,
  checked,
  onChange,
  label,
  detail,
}: {
  id: string;
  name: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label: string;
  detail?: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3.5 rounded-lg border border-line bg-surface p-4"
    >
      <input
        id={id}
        name={name}
        type="checkbox"
        value="on"
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="peer sr-only"
        role="switch"
      />
      <span className="flex flex-grow flex-col gap-1">
        <span className="text-[15px] font-semibold">{label}</span>
        {detail && <span className="text-xs leading-relaxed text-muted">{detail}</span>}
      </span>
      <span
        aria-hidden="true"
        className="relative h-8 w-[52px] shrink-0 rounded-full bg-line transition peer-checked:bg-pmc-red peer-checked:[&>span]:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pmc-red"
      >
        <span className="absolute left-[3px] top-[3px] block h-[26px] w-[26px] rounded-full bg-white transition-transform" />
      </span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Avatar                                                                      */
/* -------------------------------------------------------------------------- */

export function Avatar({ initials, muted = false }: { initials: string; muted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[15px] ${
        muted ? "bg-line text-ink" : "bg-ink text-white"
      }`}
    >
      {initials}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                    */
/* -------------------------------------------------------------------------- */

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md bg-pmc-red/10 p-3 text-sm text-pmc-red">
      {children}
    </p>
  );
}
