// @vitest-environment node
import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useDomet, useElementScroll } from "../index";

describe("server rendering", () => {
  it("renders the initial state without a window", () => {
    expect(typeof window).toBe("undefined");

    function Page() {
      const { active, index, progress, direction, scroll, sections, ids, register, link } =
        useDomet({ ids: ["intro", "api"] });
      return (
        <main
          data-active={active}
          data-index={index}
          data-progress={progress}
          data-direction={String(direction)}
          data-y={scroll.y}
          data-sections={Object.keys(sections).length}
          data-ids={ids.join(",")}
        >
          <button {...link("intro")}>intro</button>
          <button {...link("api")}>api</button>
          <section {...register("intro")} />
          <section {...register("api")} />
        </main>
      );
    }

    const html = renderToString(<Page />);

    expect(html).toContain('data-active="intro"');
    expect(html).toContain('data-index="0"');
    expect(html).toContain('data-progress="0"');
    expect(html).toContain('data-direction="null"');
    expect(html).toContain('data-y="0"');
    expect(html).toContain('data-sections="0"');
    expect(html).toContain('data-ids="intro,api"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('id="api"');
    expect(html).toContain('data-domet="api"');
  });

  it("renders selector mode with no resolved section", () => {
    function Page() {
      const { active, ids } = useDomet({ selector: "[data-section]" });
      return <main data-active={String(active)} data-count={ids.length} />;
    }

    const html = renderToString(<Page />);

    expect(html).toContain('data-active="null"');
    expect(html).toContain('data-count="0"');
  });

  it("renders with the debug option without mounting a panel", () => {
    function Page() {
      const { active } = useDomet({ ids: ["intro"], debug: true });
      return <main data-active={active} />;
    }

    expect(renderToString(<Page />)).toContain('data-active="intro"');
  });

  it("ignores scroll requests on the server", () => {
    let scrollTo: ReturnType<typeof useElementScroll>["scrollTo"] | null = null;

    function Page() {
      scrollTo = useElementScroll().scrollTo;
      return <main />;
    }

    renderToString(<Page />);

    expect(() => scrollTo?.(() => null)).not.toThrow();
  });
});
