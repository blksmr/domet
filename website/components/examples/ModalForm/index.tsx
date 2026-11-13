"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useDomet, type UseDometReturn } from "domet";
import { cn } from "@/lib/utils";
import {
  ProgressLine,
  fieldInput,
  focusRing,
  navItem,
  primaryButton,
  scrollFadeX,
  secondaryButton,
} from "../shared";

type Field = {
  name: string;
  label: string;
  type?: "email" | "tel" | "password";
  autoComplete: string;
  inputMode?: "numeric";
  placeholder?: string;
};

type Section = {
  id: string;
  title: string;
  description: string;
  fields?: Field[];
  options?: string[];
};

const SECTIONS: Section[] = [
  {
    id: "profile",
    title: "Profile",
    description: "How you appear to your team.",
    fields: [
      { name: "name", label: "Full name", autoComplete: "name", placeholder: "Ada Lovelace" },
      { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "ada@example.com" },
      { name: "phone", label: "Phone", type: "tel", autoComplete: "tel", placeholder: "+44 20 7946 0958" },
    ],
  },
  {
    id: "address",
    title: "Address",
    description: "Used for invoices and deliveries.",
    fields: [
      { name: "street", label: "Street address", autoComplete: "street-address", placeholder: "12 Market Street" },
      { name: "city", label: "City", autoComplete: "address-level2", placeholder: "London" },
      { name: "postal-code", label: "Postal code", autoComplete: "postal-code", placeholder: "EC1A 1BB" },
      { name: "country", label: "Country", autoComplete: "country-name", placeholder: "United Kingdom" },
    ],
  },
  {
    id: "billing",
    title: "Billing",
    description: "The card charged for your plan.",
    fields: [
      { name: "cc-name", label: "Name on card", autoComplete: "cc-name", placeholder: "Ada Lovelace" },
      { name: "cc-number", label: "Card number", autoComplete: "cc-number", inputMode: "numeric", placeholder: "4242 4242 4242 4242" },
      { name: "cc-exp", label: "Expiry", autoComplete: "cc-exp", inputMode: "numeric", placeholder: "08 / 29" },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Choose what reaches your inbox.",
    options: ["Product updates", "Security alerts", "Weekly summary", "Mentions and replies"],
  },
  {
    id: "security",
    title: "Security",
    description: "Change the password for this account.",
    fields: [
      { name: "current-password", label: "Current password", type: "password", autoComplete: "current-password" },
      { name: "new-password", label: "New password", type: "password", autoComplete: "new-password" },
    ],
  },
];

const SECTION_IDS = SECTIONS.map((s) => s.id);

type FormSectionsProps = {
  register: UseDometReturn["register"];
};

const FormSections = memo(function FormSections({ register }: FormSectionsProps) {
  return (
    <>
      {SECTIONS.map(({ id, title, description, fields, options }) => (
        <section
          key={id}
          {...register(id)}
          className="border-t border-border py-6 first:border-t-0"
        >
          <h2 className="text-sm">{title}</h2>
          <p className="mt-0.5 text-sm text-subtle">{description}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {fields?.map(({ name, label, type, autoComplete, inputMode, placeholder }) => (
              <label key={name} className="block text-sm">
                <span className="mb-1 block">{label}</span>
                <input
                  name={name}
                  type={type ?? "text"}
                  autoComplete={autoComplete}
                  inputMode={inputMode}
                  spellCheck={type === "email" ? false : undefined}
                  placeholder={placeholder}
                  className={fieldInput()}
                />
              </label>
            ))}
            {options?.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  defaultChecked
                  className="size-4 accent-text"
                />
                {option}
              </label>
            ))}
          </div>
        </section>
      ))}
    </>
  );
});

type SettingsPanelProps = {
  onClose: () => void;
};

function SettingsPanel({ onClose }: SettingsPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { active, index, scroll, register, link, navRef } = useDomet({
    ids: SECTION_IDS,
    container: containerRef,
    tracking: { offset: 24 },
    scrolling: { offset: 24 },
    debug: true,
  });

  const activeTitle = SECTIONS.find((s) => s.id === active)?.title;

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <aside className="shrink-0 border-b border-border md:w-48 md:border-b-0 md:border-r">
        <div className="hidden px-5 pb-1 pt-4 text-sm font-medium md:block">
          Settings
        </div>
        <nav
          aria-label="Settings sections"
          className={cn(
            "no-scrollbar flex gap-1 overflow-x-auto px-6 py-3 md:flex-col md:px-3",
            scrollFadeX,
          )}
        >
          {SECTIONS.map(({ id, title }) => (
            <button
              key={id}
              type="button"
              ref={navRef(id, { offset: 24 })}
              {...link(id)}
              className={cn(navItem(active === id), "shrink-0")}
            >
              {title}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header>
          <div className="flex items-center justify-between gap-4 py-2 pl-6 pr-2 text-sm">
            <span>
              {activeTitle ?? "Settings"}
              <span className="ml-2 font-mono text-xs tabular-nums text-subtle">
                {index + 1}/{SECTIONS.length}
              </span>
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={cn(
                "flex size-8 items-center justify-center rounded-md text-subtle hover:bg-secondary hover:text-text",
                focusRing,
              )}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path
                  d="M2 2l8 8M10 2l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <ProgressLine value={scroll.progress} />
        </header>

        <div
          ref={containerRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6"
        >
          <FormSections register={register} />
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-6 py-3 max-md:pr-20 [@media(max-height:719px)]:pr-20">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={onClose} className={primaryButton}>
            Save Changes
          </button>
        </footer>
      </div>
    </div>
  );
}

export function ModalForm() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      dialog.focus();
    }
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={primaryButton}
      >
        Open Settings
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Settings"
        tabIndex={-1}
        onClose={() => setIsOpen(false)}
        className="m-auto h-[min(40rem,calc(100dvh-2rem))] max-h-none w-[min(56rem,calc(100vw-2rem))] max-w-none overflow-hidden rounded-lg border border-transparent bg-background p-0 text-text shadow-sm outline-none ring-1 ring-black/10 backdrop:bg-black/30"
      >
        {isOpen && <SettingsPanel onClose={() => setIsOpen(false)} />}
      </dialog>
    </div>
  );
}
