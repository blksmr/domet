type Child = Node | string;

type Attributes = Record<string, string>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const name in attributes) element.setAttribute(name, attributes[name]);
  element.append(...children);
  return element;
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function icon(size: number, path: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  const shape = document.createElementNS(SVG_NS, "path");
  shape.setAttribute("d", path);
  shape.setAttribute("stroke", "currentColor");
  shape.setAttribute("stroke-width", "1.5");
  shape.setAttribute("stroke-linecap", "round");
  shape.setAttribute("stroke-linejoin", "round");
  svg.append(shape);
  return svg;
}

const BUG_PATH =
  "M14,10.5h2.25c.414,0,.75-.336,.75-.75s-.336-.75-.75-.75h-2.25v-1.085c1.57-.345,2.75-1.743,2.75-3.415,0-.414-.336-.75-.75-.75s-.75,.336-.75,.75c0,.962-.683,1.766-1.588,1.956-.348-.647-.942-1.134-1.662-1.339v-.617c0-1.654-1.346-3-3-3s-3,1.346-3,3v.617c-.72,.206-1.313,.692-1.662,1.339-.906-.19-1.588-.995-1.588-1.956,0-.414-.336-.75-.75-.75s-.75,.336-.75,.75c0,1.672,1.18,3.07,2.75,3.415v1.085H1.75c-.414,0-.75,.336-.75,.75s.336,.75,.75,.75h2.25v.5c0,.195,.031,.382,.052,.571-1.597,.324-2.802,1.739-2.802,3.429,0,.414,.336,.75,.75,.75s.75-.336,.75-.75c0-1.001,.742-1.825,1.703-1.97,.685,1.516,2.096,2.635,3.797,2.894v-5.174c0-.414,.336-.75,.75-.75s.75,.336,.75,.75v5.174c1.702-.259,3.112-1.378,3.797-2.894,.961,.145,1.703,.969,1.703,1.97,0,.414,.336,.75,.75,.75s.75-.336,.75-.75c0-1.691-1.206-3.105-2.802-3.429,.022-.189,.052-.375,.052-.571v-.5ZM7.5,5v-.5c0-.827,.673-1.5,1.5-1.5s1.5,.673,1.5,1.5v.5h-3Z";

export function bugIcon(size: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  const shape = document.createElementNS(SVG_NS, "path");
  shape.setAttribute("d", BUG_PATH);
  svg.append(shape);
  return svg;
}

export const ICONS = {
  close: "M4 4l8 8M12 4l-8 8",
  chevron: "M4 10l4-4 4 4",
  caret: "M5 6.5l3 3 3-3",
};

export type Control<T> = {
  element: HTMLElement;
  set: (value: T) => void;
};

export function stat(label: string): Control<string> {
  const value = el("span", { class: "value" });
  return {
    element: el("div", { class: "row" }, el("span", { class: "label" }, label), value),
    set: (next) => {
      if (value.textContent !== next) value.textContent = next;
    },
  };
}

export function action(label: string, onClick: () => void): HTMLButtonElement {
  const button = el("button", { class: "row", type: "button" }, label);
  button.addEventListener("click", onClick);
  return button;
}

type SliderOptions = {
  label: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
};

export function slider({
  label,
  min,
  max,
  step,
  format,
  onChange,
}: SliderOptions): Control<number> {
  const fill = el("span", { class: "fill" });
  const value = el("span", { class: "value" });
  const element = el(
    "div",
    {
      class: "row slider",
      role: "slider",
      tabindex: "0",
      "aria-label": label,
      "aria-valuemin": String(min),
      "aria-valuemax": String(max),
    },
    fill,
    el("span", { class: "label" }, label),
    value,
  );
  let current = min;

  const set = (next: number) => {
    current = next;
    fill.style.width = `${((next - min) / (max - min)) * 100}%`;
    value.textContent = format(next);
    element.setAttribute("aria-valuenow", String(next));
  };

  const commit = (raw: number) => {
    const snapped = Math.round(raw / step) * step;
    const next = Math.max(min, Math.min(max, Number(snapped.toFixed(4))));
    if (next === current) return;
    set(next);
    onChange(next);
  };

  const fromPointer = (event: PointerEvent) => {
    const bounds = element.getBoundingClientRect();
    commit(min + ((event.clientX - bounds.left) / bounds.width) * (max - min));
  };

  element.addEventListener("pointerdown", (event) => {
    element.setPointerCapture(event.pointerId);
    fromPointer(event);
  });
  element.addEventListener("pointermove", (event) => {
    if (element.hasPointerCapture(event.pointerId)) fromPointer(event);
  });
  element.addEventListener("keydown", (event) => {
    const steps: Record<string, number> = {
      ArrowRight: step,
      ArrowUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
      PageUp: step * 10,
      PageDown: -step * 10,
    };
    if (event.key === "Home") commit(min);
    else if (event.key === "End") commit(max);
    else if (event.key in steps) commit(current + steps[event.key]);
    else return;
    event.preventDefault();
  });

  return { element, set };
}

type ChoiceOptions<T extends string> = {
  label: string;
  options: ReadonlyArray<T>;
  onChange: (value: T) => void;
};

export function select<T extends string>({
  label,
  options,
  onChange,
}: ChoiceOptions<T>): Control<T> {
  const value = el("span", { class: "value" });
  const input = el("select", { "aria-label": label });
  for (const option of options) input.append(el("option", { value: option }, option));
  input.addEventListener("change", () => {
    value.textContent = input.value;
    onChange(input.value as T);
  });

  return {
    element: el(
      "div",
      { class: "row" },
      el("span", { class: "label" }, label),
      el("span", { class: "end" }, value, icon(16, ICONS.caret)),
      input,
    ),
    set: (next) => {
      input.value = next;
      value.textContent = next;
    },
  };
}

export function segmented<T extends string>({
  label,
  options,
  onChange,
}: ChoiceOptions<T>): Control<T> {
  const group = el("div", { class: "segmented", role: "radiogroup", "aria-label": label });
  const buttons = options.map((option) => {
    const button = el("button", { type: "button", role: "radio" }, option);
    button.addEventListener("click", () => {
      set(option);
      onChange(option);
    });
    group.append(button);
    return button;
  });

  const set = (next: T) => {
    buttons.forEach((button, i) => {
      button.setAttribute("aria-checked", String(options[i] === next));
    });
  };

  return {
    element: el("div", { class: "row" }, el("span", { class: "label" }, label), group),
    set,
  };
}

type TextOptions = {
  label: string;
  placeholder: string;
  onChange: (value: string) => boolean;
};

export function text({ label, placeholder, onChange }: TextOptions): Control<string> {
  const input = el("input", {
    type: "text",
    "aria-label": label,
    placeholder,
    autocomplete: "off",
    spellcheck: "false",
  });
  const element = el("label", { class: "row" }, el("span", { class: "label" }, label), input);
  input.addEventListener("input", () => {
    element.dataset.invalid = String(!onChange(input.value));
  });

  return {
    element,
    set: (next) => {
      if (input.matches(":focus")) return;
      input.value = next;
      element.dataset.invalid = "false";
    },
  };
}

type Folder = {
  element: HTMLElement;
  body: HTMLElement;
};

export function folder(title: string, isOpen: boolean, ...children: Child[]): Folder {
  const header = el(
    "button",
    { class: "folder-header", type: "button", "aria-expanded": String(isOpen) },
    title,
    icon(16, ICONS.chevron),
  );
  const body = el("div", { class: "folder-body" }, ...children);
  header.addEventListener("click", () => {
    header.setAttribute(
      "aria-expanded",
      String(header.getAttribute("aria-expanded") !== "true"),
    );
  });
  return { element: el("section", { class: "folder" }, header, body), body };
}
