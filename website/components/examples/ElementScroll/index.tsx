"use client";

import { useRef, useState } from "react";
import { useElementScroll } from "domet";
import { fieldInput, primaryButton } from "../shared";

type Field = {
  name: string;
  label: string;
  placeholder: string;
  type?: "email";
  autoComplete?: string;
  inputMode?: "numeric";
  optional?: boolean;
};

const FIELDS: Field[] = [
  { name: "name", label: "Full name", placeholder: "Ada Lovelace", autoComplete: "name" },
  { name: "email", label: "Email", placeholder: "ada@example.com", type: "email", autoComplete: "email" },
  { name: "company", label: "Company", placeholder: "Analytical Engines", autoComplete: "organization", optional: true },
  { name: "address", label: "Street address", placeholder: "12 Market Street", autoComplete: "street-address" },
  { name: "city", label: "City", placeholder: "London", autoComplete: "address-level2" },
  { name: "zip", label: "Postal code", placeholder: "EC1A 1BB", autoComplete: "postal-code" },
  { name: "card", label: "Card number", placeholder: "4242 4242 4242 4242", autoComplete: "cc-number", inputMode: "numeric" },
  { name: "notes", label: "Delivery notes", placeholder: "Leave at the door", autoComplete: "off", optional: true },
];

type FieldValues = Record<string, string>;

const PREFILLED = ["name", "email", "company", "address"];

const INITIAL_VALUES: FieldValues = Object.fromEntries(
  FIELDS.map(({ name, placeholder }) => [
    name,
    PREFILLED.includes(name) ? placeholder : "",
  ]),
);

function validate(values: FieldValues): string[] {
  return FIELDS.filter(
    ({ name, optional }) => !optional && values[name].trim() === "",
  ).map(({ name }) => name);
}

export function ElementScroll() {
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<FieldValues>(INITIAL_VALUES);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const { scrollTo } = useElementScroll({ position: "center" });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextInvalidFields = validate(values);
    setInvalidFields(nextInvalidFields);
    setSubmitted(nextInvalidFields.length === 0);

    if (nextInvalidFields.length > 0) {
      formRef.current
        ?.querySelector<HTMLInputElement>(`#field-${nextInvalidFields[0]}`)
        ?.focus({ preventScroll: true });
      scrollTo(() =>
        formRef.current?.querySelector<HTMLElement>("[data-invalid]"),
      );
    }
  };

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setInvalidFields((prev) => prev.filter((field) => field !== name));
    setSubmitted(false);
  };

  const status = submitted
    ? "Order placed."
    : invalidFields.length > 0
      ? `${invalidFields.length} ${invalidFields.length === 1 ? "field needs" : "fields need"} attention.`
      : "Fill in the required fields.";

  return (
    <div className="flex h-dvh items-center justify-center p-4">
      <div className="flex max-h-full w-full max-w-lg flex-col rounded-lg border border-border md:max-h-[34rem]">
        <header className="border-b border-border px-6 py-4">
          <h1 className="text-sm">Checkout</h1>
          <p className="mt-0.5 text-sm text-subtle">
            Place the order as it is: the first missing field is scrolled into
            view inside this panel.
          </p>
        </header>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-5">
            {FIELDS.map(
              ({ name, label, placeholder, type, autoComplete, inputMode, optional }) => {
                const isInvalid = invalidFields.includes(name);

                return (
                  <div key={name}>
                    <label
                      htmlFor={`field-${name}`}
                      className="mb-1 flex items-baseline justify-between text-sm"
                    >
                      {label}
                      {optional && (
                        <span className="text-xs text-subtle">Optional</span>
                      )}
                    </label>
                    <input
                      id={`field-${name}`}
                      name={name}
                      type={type ?? "text"}
                      autoComplete={autoComplete}
                      inputMode={inputMode}
                      spellCheck={type === "email" ? false : undefined}
                      value={values[name]}
                      placeholder={placeholder}
                      onChange={(event) => handleChange(name, event.target.value)}
                      aria-invalid={isInvalid}
                      aria-describedby={isInvalid ? `error-${name}` : undefined}
                      className={fieldInput(isInvalid)}
                    />
                    {isInvalid && (
                      <p
                        id={`error-${name}`}
                        data-invalid
                        className="mt-1 text-xs text-danger"
                      >
                        This field is required.
                      </p>
                    )}
                  </div>
                );
              },
            )}
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border px-6 py-3">
            <span role="status" className="text-xs text-subtle">
              {status}
            </span>
            <button type="submit" className={primaryButton}>
              Place Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
