/**
 * Progressive disclosure for the Canvas settings panel.
 *
 * The panel is reorganized in place — every existing control keeps its id and
 * its handlers — so the default view answers only four questions: what are you
 * designing, what kind of space is it, what style should it become, and are
 * you ready to generate. Everything else moves under Customize, and actions
 * that belong to an existing version move out of the settings flow entirely.
 */

const CUSTOMIZE_KEY = "rd_canvas_customize_open";

const byId = (id: string) => document.getElementById(id);

function icons() {
  try {
    (window as any).lucide?.createIcons({});
  } catch (_) {
    /* icons are cosmetic */
  }
}

function on(sel: string): string {
  const el = document.querySelector(sel + ".on") as HTMLElement | null;
  return el?.textContent?.trim() || "";
}

/* ------------------------------------------------------------ summaries */

/** One line describing every optional setting's current value. */
export function customizeSummary(): string {
  const level = on("#rdwLevel .rdw-opt b") || on("#rdwLevel .rdw-opt") || "Restyle";
  const lock = on("#rdwLock .chip") || "Balanced";
  const grade = on("#gradeChips .chip") || "Retail Grade";
  const opts = on("#rdwOpts .chip") || "1";
  const n = Number(opts) || 1;
  return [
    level + " Changes",
    "Reality Lock " + lock,
    grade,
    n + (n === 1 ? " Option" : " Options"),
  ].join(" · ");
}

function levelName(): string {
  const b = document.querySelector("#rdwLevel .rdw-opt.on b") as HTMLElement | null;
  return b?.textContent?.trim() || "Restyle";
}

/** The compact recap shown directly above the sticky footer. */
export function generationSummary(): { line1: string; line2: string; missing: string[] } {
  const room = (byId("fRoom") as HTMLSelectElement | null)?.value || "";
  const styleName =
    (document.querySelector("#canvasStyleField .cs-picked-t b") as HTMLElement | null)?.textContent?.trim() ||
    "";
  const missing: string[] = [];
  if (!room) missing.push("Choose A Room Type");
  if (!styleName && !(byId("canvasStyleField") as HTMLElement | null)?.hidden)
    missing.push("Choose A Design Style");
  return {
    line1: [room, styleName, levelName()].filter(Boolean).join(" · "),
    line2: customizeSummary(),
    missing,
  };
}

/* --------------------------------------------------------- restructure */

function moveInto(host: HTMLElement, ids: string[]) {
  ids.forEach((id) => {
    const el = byId(id);
    if (el && el.parentElement !== host) host.appendChild(el);
  });
}

/** Field wrappers that have no id of their own are found by their label. */
function fieldByLabel(text: string): HTMLElement | null {
  const body = byId("rdwPanelBody");
  if (!body) return null;
  const labels = Array.from(body.querySelectorAll(":scope > .field > label"));
  const hit = labels.find((l) => (l.textContent || "").trim().toLowerCase().startsWith(text.toLowerCase()));
  return (hit?.parentElement as HTMLElement) || null;
}

let built = false;

export function buildCanvasPanel() {
  const body = byId("rdwPanelBody");
  const foot = document.querySelector(".rdw-foot") as HTMLElement | null;
  if (!body || built) return;
  built = true;

  /* 1. Customize: every optional control, collapsed by default. */
  const cust = document.createElement("div");
  cust.className = "rdw-cust";
  cust.id = "rdwCustomize";
  cust.innerHTML =
    '<button type="button" class="rdw-cust-h" id="rdwCustToggle" aria-expanded="false">' +
    '<span class="rdw-cust-t"><b>Customize</b><em>Fine-tune how much changes and what should stay.</em>' +
    '<span class="rdw-cust-s" id="rdwCustSum"></span></span>' +
    '<i data-lucide="chevron-down"></i></button>' +
    '<div class="rdw-cust-b" id="rdwCustBody" hidden></div>';
  body.appendChild(cust);

  const custBody = byId("rdwCustBody") as HTMLElement;
  moveInto(custBody, ["rdwLevelField", "rdwLockField", "rdwStrengthField"]);
  const grade = fieldByLabel("Finish Grade");
  if (grade) custBody.appendChild(grade);
  const instr = fieldByLabel("Additional Instructions");
  if (instr) custBody.appendChild(instr);
  moveInto(custBody, ["rdwOptField", "rdwObjSec"]);

  /* 2. Result actions leave the settings flow for their own bar. */
  const actions = document.querySelector("#rdwDetails .insp-actions") as HTMLElement | null;
  const vers = byId("rdwVers");
  if (actions && vers && vers.parentElement) {
    const bar = document.createElement("div");
    bar.className = "rdw-resbar";
    bar.id = "rdwResBar";
    bar.appendChild(actions);
    vers.parentElement.insertBefore(bar, vers);
  }
  const details = byId("rdwDetails");
  if (details) details.classList.add("rdw-details-quiet");

  /* 3. Generation summary sits just above the sticky footer. */
  const sum = document.createElement("div");
  sum.className = "rdw-gsum";
  sum.id = "rdwGenSum";
  body.appendChild(sum);

  /* 4. One primary action: the duplicate style button leaves the footer. */
  const styleBtn = byId("genStyleBtn");
  if (styleBtn) {
    styleBtn.hidden = true;
    styleBtn.setAttribute("data-retired", "1");
  }
  if (foot) foot.classList.add("rdw-foot-simple");

  const toggle = byId("rdwCustToggle");
  const openSaved = (() => {
    try {
      return localStorage.getItem(CUSTOMIZE_KEY) === "1";
    } catch (_) {
      return false;
    }
  })();
  setCustomizeOpen(openSaved);
  toggle?.addEventListener("click", () => setCustomizeOpen(custBody.hidden));

  /* Any change to a customization keeps both summaries honest. */
  body.addEventListener("click", () => setTimeout(refreshCanvasPanel, 0));
  body.addEventListener("input", () => setTimeout(refreshCanvasPanel, 0));
  document.addEventListener("rd:canvas-style" as any, refreshCanvasPanel);
  window.addEventListener("rd:canvas-style" as any, refreshCanvasPanel);

  refreshCanvasPanel();
  icons();
}

export function setCustomizeOpen(open: boolean) {
  const b = byId("rdwCustBody");
  const t = byId("rdwCustToggle");
  if (!b || !t) return;
  b.hidden = !open;
  t.setAttribute("aria-expanded", open ? "true" : "false");
  t.classList.toggle("on", open);
  try {
    localStorage.setItem(CUSTOMIZE_KEY, open ? "1" : "0");
  } catch (_) {
    /* remembering the state is a convenience */
  }
  refreshCanvasPanel();
}

/** Keep the collapsed summary, the recap and the footer note in step. */
export function refreshCanvasPanel() {
  const custSum = byId("rdwCustSum");
  const b = byId("rdwCustBody");
  if (custSum) {
    custSum.textContent = customizeSummary();
    custSum.hidden = !b?.hidden;
  }
  const host = byId("rdwGenSum");
  if (host) {
    const g = generationSummary();
    host.innerHTML = g.missing.length
      ? '<div class="rdw-gsum-need"><i data-lucide="info"></i><span>' +
        g.missing.join(" · ") +
        "</span></div>"
      : '<div class="rdw-gsum-l1">' +
        g.line1 +
        '</div><div class="rdw-gsum-l2">' +
        g.line2 +
        '<button type="button" class="fb-link" data-edit-customize>Edit</button></div>';
    icons();
  }
}

document.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (t && t.closest && t.closest("[data-edit-customize]")) {
    e.preventDefault();
    setCustomizeOpen(true);
    byId("rdwCustomize")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
});
