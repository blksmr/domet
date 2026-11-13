"use client";

import { Link2Icon } from "@radix-ui/react-icons"

type DemoProps = {
  src: string;
  caption?: string;
};

export function Demo({ src, caption = "" }: DemoProps) {
  const fullSrc = src.startsWith("/") ? src : `/${src}`;

  return (
    <figure className="relative">
      <iframe
        src={fullSrc}
        className="relative block w-full aspect-[640/720] sm:aspect-[640/470] overflow-y-auto overflow-x-hidden border border-border rounded-lg isolate no-scrollbar"
        title={caption}
      />
      <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-5rem)] items-center gap-2">
        {caption && (
          <figcaption className="px-2 bg-black/30 backdrop-blur-sm text-white rounded-full text-xs select-none truncate min-w-0">
            {caption}
          </figcaption>
        )}
      <a
        href={fullSrc}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1 bg-fd-background/80 backdrop-blur-sm border border-border rounded-full text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-background transition-colors"
        title="Ouvrir dans un nouvel onglet"
        >
        <Link2Icon />
      </a>
        </div>
    </figure>
  );
}
