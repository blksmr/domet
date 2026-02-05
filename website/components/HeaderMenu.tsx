"use client";

import { useState, useRef, useEffect } from "react";
import { GitHubLogoIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import Link from "next/link";

const PROJECT_LINKS = [
  {
    name: "GitHub",
    href: "https://github.com/blksmr/domet",
    icon: GitHubLogoIcon,
    external: true,
  },
  {
    name: "npm",
    href: "https://www.npmjs.com/package/domet",
    external: true,
  },
  {
    name: "llms.txt",
    href: "/llms.txt",
    external: true,
  },
];

const EXAMPLES = [
  { name: "Basic", href: "/examples/basic" },
  { name: "Container", href: "/examples/container" },
  { name: "Dynamic Offset", href: "/examples/dynamicoffset" },
  { name: "Modal Form", href: "/examples/modalform" },
  { name: "Playground", href: "/examples/playground" },
  { name: "Progress", href: "/examples/progress" },
  { name: "Reveal", href: "/examples/reveal" },
  { name: "Tick Indicator", href: "/examples/tickindicator" },
  { name: "Table of Contents", href: "/examples/toc" },
  { name: "Tree View", href: "/examples/treeview" },
];

export function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-muted hover:text-hover transition-colors duration-200"
        aria-expanded={open}
        aria-haspopup="true"
      >
        Links
        <ChevronDownIcon
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 py-1 bg-background border border-border rounded-lg shadow-sm z-50">
          {PROJECT_LINKS.map((link) => (
            <a
              key={link.name}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted hover:text-hover hover:bg-secondary no-underline transition-colors duration-200"
              onClick={() => setOpen(false)}
            >
              {link.icon && <link.icon className="size-3.5" />}
              {link.name}
            </a>
          ))}

          <div className="my-1 border-t border-border" />

          <div className="max-h-64 overflow-y-auto">
            {EXAMPLES.map((example) => (
              <Link
                key={example.href}
                href={example.href}
                target="_blank"
                className="block px-3 py-1.5 text-xs text-muted hover:text-hover hover:bg-secondary no-underline transition-colors duration-200"
                onClick={() => setOpen(false)}
              >
                {example.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
