"use client";

import { useDomet } from "domet";

const SECTIONS = [
  { id: "introduction", title: "Introduction" },
  { id: "getting-started", title: "Getting Started" },
  { id: "configuration", title: "Configuration" },
  { id: "api-reference", title: "API Reference" },
  { id: "examples", title: "Examples" },
  { id: "troubleshooting", title: "Troubleshooting" },
];

const SECTION_IDS = SECTIONS.map((s) => s.id);

const SKELETON_WIDTHS = ["92%", "78%", "85%", "71%"];

export function Toc() {
  const { active, register, link, sections } = useDomet({ ids: SECTION_IDS });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-dashed border-gray-300 bg-white p-6">
        <div className="mb-6 text-xs font-medium uppercase tracking-wider text-gray-400">
          Table of Contents
        </div>
        <nav className="flex flex-col gap-1">
          {SECTIONS.map(({ id, title }) => {
            const isActive = active === id;
            const visibility = sections[id]?.visibility ?? 0;

            return (
              <button
                key={id}
                {...link(id)}
                className={`group flex items-center gap-3 rounded px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-current transition-opacity"
                  style={{ opacity: isActive ? 1 : visibility * 0.5 }}
                />
                {title}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="ml-64 flex-1 p-12">
        {SECTIONS.map(({ id, title }) => (
          <section
            key={id}
            {...register(id)}
            className="mb-8 min-h-[60vh] rounded border border-dashed border-gray-300 bg-white p-8"
          >
            <h2 className="mb-4 text-xl font-medium text-gray-900">{title}</h2>
            <div className="space-y-3">
              {SKELETON_WIDTHS.map((width, i) => (
                <div
                  key={i}
                  className="h-4 rounded bg-gray-100"
                  style={{ width }}
                />
              ))}
            </div>
            <div className="mt-6 text-xs text-gray-400">
              Section: {id}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
