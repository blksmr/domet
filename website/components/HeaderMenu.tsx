"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import Link from "next/link";

const PROJECT_LINKS = [
  { name: "GitHub", href: "https://github.com/blksmr/domet" },
  { name: "X (Twitter)", href: "https://x.com/blkasmir" },
  { name: "NPM", href: "https://www.npmjs.com/package/domet" },
  { name: "llms.txt", href: "/llms.txt" },
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

const itemClass =
  "block px-2 text-black rounded-md py-1 text-sm no-underline transition-colors duration-200 outline-none data-[highlighted]:bg-secondary data-[highlighted]:text-hover";

export function HeaderMenu() {
  return (
    <DropdownMenu.Root modal>
      <DropdownMenu.Trigger className="flex items-center text-muted gap-1 text-sm hover:text-hover transition-colors duration-200 outline-none">
        Links
        <ChevronDownIcon className="transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="w-36 p-1 bg-background border border-border rounded-lg shadow-sm z-50 origin-[var(--radix-dropdown-menu-content-transform-origin)] data-[state=open]:animate-dropdown-in data-[state=closed]:animate-dropdown-out"
        >
          {PROJECT_LINKS.map((link) => (
            <DropdownMenu.Item key={link.name} asChild>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={itemClass}
              >
                {link.name}
              </a>
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator className="my-1 border-t border-border" />

          {EXAMPLES.map((example) => (
            <DropdownMenu.Item key={example.href} asChild>
              <Link href={example.href} target="_blank" className={itemClass}>
                {example.name}
              </Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
