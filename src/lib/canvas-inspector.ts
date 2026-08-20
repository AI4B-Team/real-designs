/**
 * Room Canvas inspector: one pane at a time (Objects / Versions / Details)
 * plus a collapse toggle that hands the released width back to the Canvas.
 * The panes only move existing controls, so every original handler survives.
 */
const KEY = "rd_canvas_inspector";

type Pane = "objects" | "versions" | "details";

function board(): HTMLElement | null {
  return document.querySelector("#v-studio .studio");
}

function readPref(): { pane: Pane; collapsed: boolean } {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    const pane: Pane = ["objects", "versions", "details"].includes(raw.pane)
      ? raw.pane
      : "objects";
    return { pane, collapsed: !!raw.collapsed };
  } catch (_) {
    return { pane: "objects", collapsed: false };
  }
}

function writePref(next: Partial<{ pane: Pane; collapsed: boolean }>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readPref(), ...next }));
  } catch (_) {}
}

export function showInspectorPane(pane: Pane) {
  const host = document.getElementById("stInspector");
  if (!host) return;
  host.querySelectorAll<HTMLElement>(".insp-tab").forEach((t) => {
    const on = t.dataset["insp"] === pane;
    t.classList.toggle("on", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
  });
  host.querySelectorAll<HTMLElement>(".insp-pane").forEach((p) => {
    p.classList.toggle("on", p.dataset["pane"] === pane);
  });
  writePref({ pane });
}

export function setInspectorCollapsed(collapsed: boolean) {
  const b = board();
  if (b) b.classList.toggle("insp-off", collapsed);
  writePref({ collapsed });
}

export function initCanvasInspector() {
  const host = document.getElementById("stInspector");
  if (!host || (host as any).__rdInsp) return;
  (host as any).__rdInsp = true;

  host.querySelectorAll<HTMLElement>(".insp-tab").forEach((t) => {
    t.addEventListener("click", () => showInspectorPane((t.dataset["insp"] || "objects") as Pane));
  });
  document
    .getElementById("inspCollapse")
    ?.addEventListener("click", () => setInspectorCollapsed(true));
  document
    .getElementById("inspToggle")
    ?.addEventListener("click", () => setInspectorCollapsed(false));

  /* Command/Control + Shift + I is taken by browser devtools, so the app
     shortcut is Alt + I (documented in the control tooltips). */
  if (!(window as any).__rdInspKeys) {
    (window as any).__rdInspKeys = true;
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (String(e.key).toLowerCase() !== "i") return;
      const b = board();
      if (!b) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
      e.preventDefault();
      setInspectorCollapsed(!b.classList.contains("insp-off"));
    });
  }

  const pref = readPref();
  /* Narrow desktops start with the Canvas at full width. */
  const collapsed = pref.collapsed || window.innerWidth < 1441;
  showInspectorPane(pref.pane);
  setInspectorCollapsed(collapsed);

  (window as any).rdInspectorShow = (p: Pane) => {
    setInspectorCollapsed(false);
    showInspectorPane(p);
  };
}

