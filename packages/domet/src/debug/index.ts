import type {
  DebugController,
  DebugEventType,
  DebugHandle,
  DebugOverrides,
  Offset,
  ScrollBehavior,
  ScrollToPosition,
} from "../types";
import {
  ICONS,
  action,
  bugIcon,
  el,
  folder,
  icon,
  segmented,
  select,
  slider,
  stat,
  text,
} from "./controls";
import { MAX_SCORE, REASONS, explain } from "./explain";
import { DEBUG_STYLES } from "./styles";

type Toggle = "off" | "on";
type Lock = "auto" | "on" | "off";
type Position = ScrollToPosition | "auto";

const HOST_ATTRIBUTE = "data-domet-debug";
const OPEN_KEY = "domet-debug-open";
const MAX_EVENTS = 50;
const CARD_HEIGHT = 82;
const CARD_VERDICT = 25;
const OFFSET_HINT = "Invalid format. Use a number (e.g. 100) or percentage (e.g. 10%).";
const BEHAVIORS: ReadonlyArray<ScrollBehavior> = ["auto", "smooth", "instant"];
const POSITIONS: ReadonlyArray<Position> = ["auto", "top", "center", "bottom"];
const LOCKS: ReadonlyArray<Lock> = ["auto", "on", "off"];
const TOGGLES: ReadonlyArray<Toggle> = ["off", "on"];

function parseOffset(input: string, percentPattern: RegExp): Offset | null {
  const trimmed = input.trim();
  if (trimmed === "") return 0;
  if (percentPattern.test(trimmed)) return trimmed as Offset;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function readOpenState(): boolean {
  try {
    return sessionStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeOpenState(isOpen: boolean): void {
  try {
    sessionStorage.setItem(OPEN_KEY, isOpen ? "1" : "0");
  } catch {
    return;
  }
}

function isModal(dialog: HTMLDialogElement): boolean {
  try {
    return dialog.matches(":modal");
  } catch {
    return false;
  }
}

function formatTime(date: Date): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  return `${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export function mountDebug(controller: DebugController): DebugHandle {
  const host = el("div", { [HOST_ATTRIBUTE]: "" });
  const root = host.attachShadow({ mode: "open" });
  const overrides: Required<DebugOverrides> = { tracking: {}, scrolling: {} };
  let showTrigger = false;
  let showSections = false;
  let showScores = false;
  let frame: number | null = null;
  let copyTimer: ReturnType<typeof setTimeout> | null = null;
  let watchedDialog: HTMLDialogElement | null = null;
  const dialogObserver = new MutationObserver(() => place());

  function place(): void {
    const dialog = controller.getView()?.container?.closest("dialog") ?? null;
    if (dialog !== watchedDialog) {
      dialogObserver.disconnect();
      watchedDialog = dialog;
      if (dialog) {
        dialogObserver.observe(dialog, {
          attributes: true,
          attributeFilter: ["open"],
        });
      }
    }
    const parent = dialog && isModal(dialog) ? dialog : document.body;
    if (host.parentNode !== parent) parent.append(host);
  }

  const apply = () => {
    controller.setOverrides({
      tracking: { ...overrides.tracking },
      scrolling: { ...overrides.scrolling },
    });
  };

  const stats = {
    active: stat("Active"),
    index: stat("Index"),
    progress: stat("Progress"),
    direction: stat("Direction"),
    velocity: stat("Velocity"),
    scrolling: stat("Scrolling"),
    position: stat("Scroll Y"),
    viewport: stat("Viewport"),
    triggerLine: stat("Trigger Line"),
  };

  const offsetHint = el("p", { class: "hint", role: "status" });
  const offset = text({
    label: "Offset",
    placeholder: "100 or 10%",
    onChange: (input) => {
      const parsed = parseOffset(input, controller.percentPattern);
      offsetHint.textContent = parsed === null ? OFFSET_HINT : "";
      if (parsed === null) return false;
      overrides.tracking.offset = parsed;
      apply();
      return true;
    },
  });
  const threshold = slider({
    label: "Threshold",
    ...controller.limits.threshold,
    step: 0.05,
    format: (value) => value.toFixed(2),
    onChange: (value) => {
      overrides.tracking.threshold = value;
      apply();
    },
  });
  const hysteresis = slider({
    label: "Hysteresis",
    ...controller.limits.hysteresis,
    step: 10,
    format: String,
    onChange: (value) => {
      overrides.tracking.hysteresis = value;
      apply();
    },
  });

  const behavior = select<ScrollBehavior>({
    label: "Behavior",
    options: BEHAVIORS,
    onChange: (value) => {
      overrides.scrolling.behavior = value;
      apply();
    },
  });
  const position = select<Position>({
    label: "Position",
    options: POSITIONS,
    onChange: (value) => {
      overrides.scrolling.position = value === "auto" ? undefined : value;
      apply();
    },
  });
  const lockActive = segmented<Lock>({
    label: "Lock Active",
    options: LOCKS,
    onChange: (value) => {
      overrides.scrolling.lockActive = value === "auto" ? undefined : value === "on";
      apply();
    },
  });

  const trigger = el("div", { class: "trigger" });
  const triggerTag = el("span", { class: "tag" });
  trigger.append(triggerTag);
  const boxes = el("div", { class: "frame" });
  const overlay = el("div", { class: "overlay" }, trigger, boxes);

  const triggerToggle = segmented<Toggle>({
    label: "Trigger Line",
    options: TOGGLES,
    onChange: (value) => {
      showTrigger = value === "on";
      schedule();
    },
  });
  const sectionsToggle = segmented<Toggle>({
    label: "Section Outlines",
    options: TOGGLES,
    onChange: (value) => {
      showSections = value === "on";
      schedule();
    },
  });
  const scoresToggle = segmented<Toggle>({
    label: "Section Scores",
    options: TOGGLES,
    onChange: (value) => {
      showScores = value === "on";
      schedule();
    },
  });
  triggerToggle.set("off");
  sectionsToggle.set("off");
  scoresToggle.set("off");

  const sectionRows = new Map<
    string,
    { row: HTMLElement; fill: HTMLElement; value: HTMLElement }
  >();
  const sectionList = folder("Sections", false);
  const eventList = el("div", { class: "log", role: "log", "aria-label": "Events" });
  const emptyEvents = el("span", {}, "No events yet.");
  eventList.append(emptyEvents);

  const copyButton = action("Copy Options", () => {
    const view = controller.getView();
    const scrolling = Object.entries(view.scrolling)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(", ");
    const snippet = [
      `tracking: { offset: ${JSON.stringify(view.tracking.offset)}, threshold: ${view.tracking.threshold}, hysteresis: ${view.tracking.hysteresis} },`,
      `scrolling: { ${scrolling} },`,
    ].join("\n");
    const done = (label: string) => {
      copyButton.textContent = label;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copyButton.textContent = "Copy Options";
      }, 1500);
    };
    (navigator.clipboard?.writeText(snippet) ?? Promise.reject()).then(
      () => done("Copied"),
      () => done("Copy failed. Clipboard access was denied."),
    );
  });
  const resetButton = action("Reset", () => {
    overrides.tracking = {};
    overrides.scrolling = {};
    offsetHint.textContent = "";
    controller.setOverrides(null);
  });

  const closeButton = el(
    "button",
    { class: "icon-button", type: "button", "aria-label": "Close debug panel" },
    icon(16, ICONS.close),
  );
  const launcher = el(
    "button",
    {
      class: "launcher",
      type: "button",
      "aria-label": "Open Domet debug panel",
      "aria-expanded": "false",
    },
    bugIcon(18),
  );
  const panel = el(
    "div",
    { class: "panel", role: "region", "aria-label": "Domet debug" },
    el("div", { class: "header" }, el("span", { class: "title" }, "Domet"), closeButton),
    el(
      "div",
      { class: "content" },
      copyButton,
      resetButton,
      folder("State", true, ...Object.values(stats).map((item) => item.element)).element,
      folder("Tracking", true, offset.element, offsetHint, threshold.element, hysteresis.element)
        .element,
      folder("Scrolling", false, behavior.element, position.element, lockActive.element).element,
      folder(
        "Overlays",
        true,
        triggerToggle.element,
        sectionsToggle.element,
        scoresToggle.element,
      ).element,
      sectionList.element,
      folder("Events", false, eventList, action("Clear", () => eventList.replaceChildren(emptyEvents)))
        .element,
    ),
  );
  const dock = el("div", { class: "dock", "data-open": "false" }, launcher, panel);

  const setOpen = (isOpen: boolean, moveFocus: boolean) => {
    dock.dataset.open = String(isOpen);
    launcher.setAttribute("aria-expanded", String(isOpen));
    writeOpenState(isOpen);
    if (moveFocus) (isOpen ? closeButton : launcher).focus();
    if (isOpen) schedule();
  };
  launcher.addEventListener("click", () => setOpen(true, true));
  closeButton.addEventListener("click", () => setOpen(false, true));
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false, true);
  });

  let syncedIds: string[] | null = null;
  const syncSections = (ids: string[]) => {
    if (ids === syncedIds) return;
    syncedIds = ids;
    for (const [id, { row }] of sectionRows) {
      if (!ids.includes(id)) {
        row.remove();
        sectionRows.delete(id);
      }
    }
    for (const id of ids) {
      if (sectionRows.has(id)) continue;
      const fill = el("span", { class: "fill" });
      const value = el("span", { class: "value" });
      const row = el(
        "div",
        { class: "row", role: "button", tabindex: "0", "aria-label": `Scroll to ${id}` },
        fill,
        el("span", { class: "label value" }, id),
        value,
      );
      const go = () => controller.getView().scrollTo(id);
      row.addEventListener("click", go);
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        go();
      });
      sectionRows.set(id, { row, fill, value });
    }
    sectionList.body.replaceChildren(...ids.map((id) => sectionRows.get(id)!.row));
  };

  const percent = (ratio: number) => `${Math.floor(ratio * 100 + 1e-6)}%`;

  const card = (
    rows: Array<[string, number | string]>,
    verdict: string,
    isActive: boolean,
  ) =>
    el(
      "div",
      { class: "card", "data-active": String(isActive) },
      ...rows.flatMap(([name, points]) => [
        el("span", {}, name),
        el("span", {}, String(points)),
      ]),
      ...(verdict ? [el("span", { class: "verdict" }, verdict)] : []),
    );

  const renderOverlay = () => {
    const showBoxes = showSections || showScores;
    trigger.style.display = showTrigger ? "block" : "none";
    if (!showBoxes) boxes.replaceChildren();
    if (!showTrigger && !showBoxes) return;

    const view = controller.getView();
    const scroll = controller.getScroll();
    const frameRect = view.container?.getBoundingClientRect();
    const top = frameRect ? frameRect.top + (view.container?.clientTop ?? 0) : 0;
    const left = frameRect ? frameRect.left : 0;
    const width = frameRect ? frameRect.width : window.innerWidth;

    if (showTrigger) {
      trigger.style.transform = `translate(${left}px, ${top + scroll.triggerLine}px)`;
      trigger.style.width = `${width}px`;
      triggerTag.textContent = `trigger ${scroll.triggerLine}px`;
    }
    if (!showBoxes) return;

    const sections = controller.getSections();
    const { threshold, hysteresis } = view.tracking;
    const explanation = showScores
      ? explain({ ids: view.ids, sections, scroll, threshold, hysteresis, active: view.active })
      : null;
    const verdict = explanation ? `active · ${REASONS[explanation.reason]}` : "";
    boxes.style.transform = `translate(${left}px, ${top}px)`;
    boxes.style.width = `${width}px`;
    boxes.style.height = `${scroll.viewportHeight}px`;
    boxes.replaceChildren(
      ...view.ids.flatMap((id) => {
        const state = sections[id];
        if (!state?.rect || !state.inView) return [];
        const { rect } = state;
        const part = explanation?.parts.find((item) => item.id === id);
        let label = el("span", { class: "tag" }, id);
        let height = 0;
        if (explanation && part) {
          const outcome = state.active
            ? verdict
            : explanation.toBeat === null
              ? ""
              : `takes over above ${Math.round(explanation.toBeat)}`;
          label = card(
            [
              [id, part.total],
              [
                `visible ${percent(part.ratio)} ${part.ratio >= threshold ? "≥" : "<"} ${percent(threshold)}`,
                part.visibility,
              ],
              ["trigger line", part.trigger],
              [`center ${Math.round(part.distance)}px from line`, part.proximity],
            ],
            outcome,
            state.active,
          );
          height = CARD_HEIGHT + (outcome ? CARD_VERDICT : 0);
        }
        const box = el("div", { class: "box", "data-active": String(state.active) }, label);
        box.style.setProperty("--score", String((part?.total ?? 0) / MAX_SCORE));
        label.style.top = `${Math.max(0, Math.min(-rect.top, rect.height - height))}px`;
        box.style.transform = `translate(${rect.left - left}px, ${rect.top}px)`;
        box.style.width = `${rect.width}px`;
        box.style.height = `${rect.height}px`;
        return [box];
      }),
    );
    if (explanation && view.active && !sections[view.active]?.inView) {
      boxes.append(card([[view.active, ""]], verdict, true));
    }
  };

  const render = () => {
    frame = null;
    const view = controller.getView();
    if (!view) return;
    renderOverlay();
    if (dock.dataset.open !== "true") return;

    const scroll = controller.getScroll();
    stats.active.set(String(view.active));
    stats.index.set(String(view.index));
    stats.progress.set(scroll.progress.toFixed(3));
    stats.direction.set(String(scroll.direction));
    stats.velocity.set(`${scroll.velocity} px/ms`);
    stats.scrolling.set(String(scroll.scrolling));
    stats.position.set(`${scroll.y} / ${scroll.maxScroll}`);
    stats.viewport.set(`${scroll.viewportHeight}px`);
    stats.triggerLine.set(`${scroll.triggerLine}px`);

    const sections = controller.getSections();
    for (const [id, { row, fill, value }] of sectionRows) {
      const visibility = sections[id]?.visibility ?? 0;
      fill.style.width = `${visibility * 100}%`;
      value.textContent = `${Math.round(visibility * 100)}%`;
      row.dataset.active = String(id === view.active);
    }
  };

  function schedule(): void {
    if (frame === null) frame = requestAnimationFrame(render);
  }

  const update = () => {
    const view = controller.getView();
    if (!view) return;
    place();
    offset.set(String(view.tracking.offset));
    threshold.set(view.tracking.threshold);
    hysteresis.set(view.tracking.hysteresis);
    behavior.set(view.scrolling.behavior ?? "auto");
    position.set(view.scrolling.position ?? "auto");
    lockActive.set(
      view.scrolling.lockActive === undefined
        ? "auto"
        : view.scrolling.lockActive
          ? "on"
          : "off",
    );
    syncSections(view.ids);
    schedule();
  };

  const event = (type: DebugEventType, args: unknown[]) => {
    const detail = type === "active" ? `${args[1]} → ${args[0]}` : args.join(" ");
    emptyEvents.remove();
    eventList.prepend(
      el("div", {}, el("time", {}, formatTime(new Date())), ` ${type} ${detail}`),
    );
    while (eventList.childElementCount > MAX_EVENTS) eventList.lastElementChild?.remove();
  };

  root.append(el("style", {}, DEBUG_STYLES), overlay, dock);
  place();
  const unsubscribe = controller.subscribe(schedule);
  window.addEventListener("scroll", schedule, { passive: true, capture: true });
  window.addEventListener("resize", schedule, { passive: true });
  setOpen(readOpenState(), false);
  update();

  return {
    update,
    event,
    destroy: () => {
      unsubscribe();
      dialogObserver.disconnect();
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      if (frame !== null) cancelAnimationFrame(frame);
      if (copyTimer) clearTimeout(copyTimer);
      host.remove();
    },
  };
}
