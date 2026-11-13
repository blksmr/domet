export const DEBUG_STYLES = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  pointer-events: none;
  color: rgba(255, 255, 255, 0.95);
  font: 500 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  --bg: #212121;
  --surface: rgba(255, 255, 255, 0.05);
  --surface-hover: rgba(255, 255, 255, 0.1);
  --surface-active: rgba(255, 255, 255, 0.11);
  --divider: rgba(255, 255, 255, 0.06);
  --border: rgba(255, 255, 255, 0.1);
  --label: rgba(255, 255, 255, 0.7);
  --dim: rgba(255, 255, 255, 0.6);
  --ring: rgba(255, 255, 255, 0.6);
  --line: #ff4d6d;
  --box: #4d9fff;
  --mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
* { box-sizing: border-box; }
button, input, select { font: inherit; color: inherit; }
button { margin: 0; padding: 0; border: 0; background: none; cursor: pointer; touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
:focus { outline: none; }
:focus-visible { outline: 2px solid var(--ring); outline-offset: 1px; }

.dock {
  position: absolute;
  right: calc(16px + env(safe-area-inset-right, 0px));
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  pointer-events: auto;
}
.launcher {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--bg);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}
.panel {
  display: none;
  flex-direction: column;
  width: min(280px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  max-height: calc(100dvh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  transform-origin: bottom right;
}
.dock[data-open="true"] .launcher { display: none; }
.dock[data-open="true"] .panel { display: flex; animation: enter 200ms cubic-bezier(0.23, 1, 0.32, 1); }
@keyframes enter { from { opacity: 0; transform: scale(0.96); } }

.header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  margin: 0 12px;
  padding: 10px 0 6px;
  border-bottom: 1px solid var(--divider);
}
.title { color: #fff; font-size: 15px; font-weight: 600; }
.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-right: -6px;
  border-radius: 6px;
  color: var(--label);
}
.content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  padding: 12px 12px 10px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}
.content::-webkit-scrollbar { display: none; }

.row {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 36px;
  padding: 0 12px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--surface);
  color: var(--label);
}
.label { position: relative; flex: none; }
.value {
  position: relative;
  min-width: 0;
  overflow: hidden;
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}
button.row { width: 100%; justify-content: center; color: var(--dim); }
button.row:active, .row[role="button"]:active { background: var(--surface-active); }

.slider, .row[role="button"] { cursor: pointer; user-select: none; -webkit-user-select: none; }
.slider { touch-action: pan-y; }
.fill { position: absolute; inset: 0 auto 0 0; background: var(--surface-active); pointer-events: none; }
.row[data-active="true"] { color: #fff; }

.row input[type="text"] {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  font-family: var(--mono);
  text-align: right;
}
.row input[type="text"]:focus-visible { outline: none; color: #fff; }
.row:has(input:focus-visible) { outline: 2px solid var(--ring); outline-offset: 1px; }
.row[data-invalid="true"] { box-shadow: inset 0 0 0 1px var(--line); }
.end .value { text-transform: capitalize; }
.row select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font-size: 16px; }
.row:has(select:focus-visible) { outline: 2px solid var(--ring); outline-offset: 1px; }
.end { position: relative; display: flex; align-items: center; gap: 6px; min-width: 0; }
.chevron { flex: none; opacity: 0.6; }

.segmented { display: flex; margin-right: -8px; padding: 2px; }
.segmented button { padding: 6px 8px; border-radius: 6px; color: var(--label); text-transform: capitalize; }
.segmented button[aria-checked="true"] { background: var(--surface-active); color: #fff; }

.folder { display: flex; flex: none; flex-direction: column; gap: 6px; margin-top: 2px; border-top: 1px solid var(--divider); }
.folder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 36px;
  margin-bottom: -6px;
  border-radius: 6px;
  color: var(--label);
  font-weight: 600;
}
.folder-header svg { transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1); }
.folder-header[aria-expanded="false"] svg { transform: rotate(180deg); }
.folder-header[aria-expanded="false"] + .folder-body { display: none; }
.folder-body { display: flex; flex-direction: column; gap: 6px; }

.hint { margin: 0; padding: 0 2px; color: var(--label); font-size: 12px; font-weight: 400; }
.hint:empty { display: none; }
.log {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 160px;
  padding: 2px;
  overflow-y: auto;
  overscroll-behavior: contain;
  color: var(--label);
  font: 400 11px/1.4 var(--mono);
}
.log time { color: var(--dim); }

.overlay { position: absolute; inset: 0; overflow: hidden; }
.trigger { position: absolute; display: none; height: 0; border-top: 2px dashed var(--line); }
.frame { position: absolute; overflow: hidden; }
.box { position: absolute; border: 1px dashed var(--box); }
.box[data-active="true"] { border-style: solid; }
.box::before { content: ""; position: absolute; inset: 0; background: var(--box); opacity: calc(var(--score, 0) * 0.18); }
.card {
  position: absolute;
  left: 0;
  display: grid;
  grid-template-columns: auto auto;
  padding-bottom: 6px;
  overflow: hidden;
  border-radius: 0 0 8px;
  background: var(--bg);
  color: var(--label);
  font: 400 11px/16px var(--mono);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.card span { padding: 0 8px; }
.card span:nth-child(even) { text-align: right; }
.card span:nth-child(-n+2) { margin-bottom: 4px; padding-block: 4px; color: #fff; font-weight: 600; }
.card[data-active="true"] span:nth-child(-n+2) { background: var(--box); color: #000; }
.frame > .card { bottom: 0; border-radius: 0 8px 0 0; }
.card .verdict { grid-column: 1 / -1; margin: 4px 8px 0; padding: 4px 0 0; border-top: 1px solid var(--border); color: #fff; text-align: left; }
.tag {
  position: absolute;
  top: 0;
  left: 0;
  padding: 1px 4px;
  background: var(--box);
  color: #000;
  font: 500 10px/1.3 var(--mono);
  white-space: nowrap;
}
.trigger .tag { top: 0; left: 8px; background: var(--line); }

@media (hover: hover) and (pointer: fine) {
  button.row:hover, .row[role="button"]:hover { background: var(--surface-hover); color: #fff; }
  .icon-button:hover, .folder-header:hover, .segmented button:hover { color: #fff; }
  .launcher:hover { background: #2a2a2a; }
}
@media (pointer: coarse) {
  .row input[type="text"] { font-size: 16px; }
}
@media (max-width: 520px) {
  .panel { width: calc(100vw - 32px); max-height: 55vh; max-height: 55dvh; }
  .trigger .tag { right: 8px; left: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .dock[data-open="true"] .panel { animation: none; }
  .folder-header svg { transition: none; }
}
`;
