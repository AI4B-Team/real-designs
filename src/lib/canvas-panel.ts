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
  const level = on("#rdwLevel .rdw-opt b") || on("#rdwLevel .rdw-opt") || "Balanced";
  const lock = (on("#rdwLock .chip") || "Balanced").toLowerCase();
  const grade = on("#gradeChips .chip") || "Retail Grade";
  const opts = on("#rdwOpts .chip") || "1";
  const n = Number(opts) || 1;
  return [
    level,
    "Reality Lock " + (lock === "off" ? "Off" : "On"),
    grade,
    n + (n === 1 ? " Option" : " Options"),
  ].join(" · ");
}

function levelName(): string {
  const b = document.querySelector("#rdwLevel .rdw-opt.on b") as HTMLElement | null;
  return b?.textContent?.trim() || "Balanced";
}

type CanvasState = {
  selectedRoomType: string;
  needsStyle: boolean;
  selectedStyleId: string;
  selectedStyleName: string;
};

/** One authoritative read of the panel selection, never scraped from card text. */
export function canvasState(): CanvasState {
  const read = (window as any).__rdCanvasState;
  if (typeof read === "function") {
    try {
      const s = read() || {};
      return {
        selectedRoomType: String(s.selectedRoomType || "").trim(),
        needsStyle: !!s.needsStyle,
        selectedStyleId: String(s.selectedStyleId || "").trim(),
        selectedStyleName: String(s.selectedStyleName || "").trim(),
      };
    } catch (_) {
      /* fall through to the DOM read below */
    }
  }
  const room = (byId("fRoom") as HTMLSelectElement | null)?.value || "";
  const field = byId("canvasStyleField") as HTMLElement | null;
  const name =
    (document.querySelector("#canvasStyleField .cs-picked-t b") as HTMLElement | null)?.textContent?.trim() ||
    "";
  return {
    selectedRoomType: room.trim(),
    needsStyle: !!field && !field.hidden,
    selectedStyleId: name,
    selectedStyleName: name,
  };
}

/** The compact recap shown directly above the sticky footer. */
export function generationSummary(): { line1: string; line2: string; missing: string[] } {
  const st = canvasState();
  const needRoom = !st.selectedRoomType;
  const needStyle = st.needsStyle && !st.selectedStyleId;
  const missing: string[] = [];
  if (needRoom && needStyle) missing.push("Choose A Room And Style To Continue");
  else if (needRoom) missing.push("Choose A Room To Continue");
  else if (needStyle) missing.push("Choose A Style To Continue");
  return {
    line1: [st.selectedRoomType, st.selectedStyleName, levelName()].filter(Boolean).join(" · "),
    line2: customizeSummary(),
    missing,
  };
}

/** Briefly highlight whatever is still missing when Generate is pressed. */
export function flashMissing() {
  const st = canvasState();
  const flash = (el: HTMLElement | null) => {
    if (!el) return;
    el.classList.add("cs-flash");
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(() => el.classList.remove("cs-flash"), 1200);
  };
  if (!st.selectedRoomType) flash(byId("rdwRoomField"));
  if (st.needsStyle && !st.selectedStyleId) flash(byId("canvasStyleField"));
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

/** An empty Version History stays one quiet row instead of a big empty box. */
export function refreshVersionRail() {
  const vers = byId("rdwVers");
  const list = byId("vars");
  if (!vers || !list) return;
  const n = list.querySelectorAll(":scope > *").length;
  vers.classList.toggle("rdw-vers-empty", n === 0);
  const count = byId("rdwVersN");
  if (count) count.textContent = n === 0 ? "No versions yet" : n === 1 ? "1 version" : n + " versions";
}

let built = false;


export function buildCanvasPanel() {
  const body = byId("rdwPanelBody");
  const foot = document.querySelector(".rdw-foot") as HTMLElement | null;
  if (!body || built) return;
  built = true;

  /* 0. The left tool rail already names the active tool: the panel never
     repeats it. Header, description, breadcrumb and the persistent Reset link
     all leave the top of the panel. */
  document.getElementById("rdwPanel")?.classList.add("rdw-panel-quiet");
  /* The space control opens the panel as a compact icon row: the three
     choices read faster than a label plus three words. */
  const spaceLabel = document.querySelector("#rdwSpaceField > label") as HTMLElement | null;
  if (spaceLabel) spaceLabel.hidden = true;
  byId("rdwSpaceField")?.classList.add("rdw-space-icons");
  const SPACE_ICON: Record<string, string> = {
    interior: "sofa",
    exterior: "home",
    landscape: "trees",
  };
  document.querySelectorAll<HTMLElement>("#spChips .chip").forEach((chip) => {
    const key = chip.getAttribute("data-sp") || "";
    if (chip.querySelector("i")) return;
    chip.insertAdjacentHTML(
      "afterbegin",
      '<i data-lucide="' + (SPACE_ICON[key] || "square") + '"></i>',
    );
  });

  /* 1. "Describe What You Want" stays in the main flow: it is the one free
     text people reach for, so it never hides under Customize. */
  const instr = fieldByLabel("Additional Instructions");
  if (instr) {
    instr.id = "rdwNoteField";
    const lab = instr.querySelector("label") as HTMLElement | null;
    if (lab)
      lab.innerHTML =
        'Describe What You Want<span class="rdw-opt-tag">Optional</span>';
    const ta = instr.querySelector("textarea") as HTMLTextAreaElement | null;
    if (ta) ta.placeholder = "Keep the flooring, lighten the cabinets, and add an island.";
    body.appendChild(instr);
  }

  /* 2. Customize: every remaining optional control, collapsed by default. */
  const cust = document.createElement("div");
  cust.className = "rdw-cust";
  cust.id = "rdwCustomize";
  cust.innerHTML =
    '<button type="button" class="rdw-cust-h" id="rdwCustToggle" aria-expanded="false">' +
    '<span class="rdw-cust-t"><b>Customize</b>' +
    '<span class="rdw-cust-s" id="rdwCustSum"></span></span>' +
    '<i data-lucide="chevron-down"></i></button>' +
    '<div class="rdw-cust-b" id="rdwCustBody" hidden></div>';
  body.appendChild(cust);

  const custBody = byId("rdwCustBody") as HTMLElement;
  /* Tool-specific advanced controls live under Customize too. */
  let caps = byId("rdwCaps");
  if (!caps) {
    caps = document.createElement("div");
    caps.id = "rdwCaps";
    caps.className = "rdw-caps";
    caps.hidden = true;
  }
  custBody.appendChild(caps);
  moveInto(custBody, ["rdwLevelField", "rdwLockField", "rdwStrengthField"]);
  /* One advanced strength control: "Change Level" replaces the old Redesign
     Level wording so it no longer reads like a second style choice. */
  const lvlField = byId("rdwLevelField");
  const lvlLab = lvlField?.querySelector("label") as HTMLElement | null;
  if (lvlLab) lvlLab.textContent = "Change Level";
  const LVL_NAME: Record<string, string> = { "0": "Subtle", "1": "Balanced", "3": "Bold" };
  document.querySelectorAll<HTMLElement>("#rdwLevel .rdw-opt").forEach((opt) => {
    const b = opt.querySelector("b");
    const name = LVL_NAME[opt.getAttribute("data-b") || ""];
    if (b && name) b.textContent = name;
  });
  const grade = fieldByLabel("Finish Grade");
  if (grade) custBody.appendChild(grade);
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

  /* 2b. Version History keeps one job: listing versions. Clear Canvas moves to
     the settings menu, and the Hide link becomes a chevron. */
  const clearBtn = byId("clearLocks");
  if (clearBtn) clearBtn.hidden = true;
  const versT = byId("rdwVersToggle");
  if (versT) {
    versT.classList.add("rdw-vers-chev");
    versT.setAttribute("aria-label", "Toggle Version History");
    versT.innerHTML = '<i data-lucide="chevron-down"></i>';
  }
  refreshVersionRail();

  /* 3. Generation summary and the settings overflow live in the sticky
     footer, next to the single primary action. */
  const sum = document.createElement("div");
  sum.className = "rdw-gsum";
  sum.id = "rdwGenSum";
  if (foot) {
    const row = document.createElement("div");
    row.className = "rdw-foot-top";
    row.appendChild(sum);
    row.insertAdjacentHTML(
      "beforeend",
      '<div class="rdw-more-wrap"><button type="button" class="rdw-more" id="rdwMore" ' +
        'aria-haspopup="true" aria-expanded="false" data-tt="Settings" aria-label="Settings">' +
        '<i data-lucide="more-vertical"></i></button>' +
        '<div class="rdw-more-m" id="rdwMoreMenu" hidden>' +
        '<button type="button" class="acct-i" data-panel-reset="clear">Clear Canvas</button>' +
        '<button type="button" class="acct-i" data-panel-reset="tool">Reset This Tool</button>' +
        '<button type="button" class="acct-i" data-panel-reset="all">Reset All Settings</button>' +
        '<button type="button" class="acct-i" data-panel-reset="over">Start Over</button>' +
        "</div></div>",
    );
    foot.insertBefore(row, foot.firstChild);
  } else {
    body.appendChild(sum);
  }

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
  toggle?.addEventListener("click", () => setCustomizeOpen(!!custBody.hidden));

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
  refreshVersionRail();
  if (false) {
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

/* A disabled Generate swallows clicks, so listen on the way down and point at
   whatever is still missing. */
document.addEventListener(
  "pointerdown",
  (e) => {
    const t = e.target as HTMLElement;
    if (!t || !t.closest) return;
    const btn = t.closest("#genBtn") as HTMLButtonElement | null;
    if (!btn) return;
    if (generationSummary().missing.length) flashMissing();
  },
  true,
);


/* ------------------------------------------------- settings overflow menu */

function closeMoreMenu() {
  const m = byId("rdwMoreMenu");
  if (m) m.hidden = true;
  byId("rdwMore")?.setAttribute("aria-expanded", "false");
}

function clickAll(sel: string) {
  document.querySelectorAll<HTMLElement>(sel).forEach((el) => el.click());
}

/** Puts every optional control back to the value it ships with. */
function resetCustomize() {
  const first = (id: string) =>
    (document.querySelector(id + " .chip, " + id + " .rdw-opt") as HTMLElement | null);
  document.querySelector("#rdwLevel .rdw-opt[data-b='1']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  document.querySelector("#rdwLock .chip[data-lock='balanced']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  document.querySelector("#gradeChips .chip[data-g='retail']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  document.querySelector("#rdwOpts .chip[data-n='1']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  const note = byId("agentNote") as HTMLTextAreaElement | null;
  if (note) note.value = "";
  void first;
  refreshCanvasPanel();
}

document.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (!t || !t.closest) return;
  if (t.closest("#rdwMore")) {
    e.preventDefault();
    const m = byId("rdwMoreMenu");
    if (!m) return;
    const open = !!m.hidden;
    m.hidden = !open;
    byId("rdwMore")?.setAttribute("aria-expanded", open ? "true" : "false");
    return;
  }
  const act = t.closest("[data-panel-reset]") as HTMLElement | null;
  if (act) {
    e.preventDefault();
    closeMoreMenu();
    const kind = act.getAttribute("data-panel-reset");
    if (kind === "tool") {
      resetCustomize();
    } else if (kind === "all") {
      resetCustomize();
      document.querySelector("#canvasStyleField .cs-clear")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    } else if (kind === "over") {
      const ok = window.confirm(
        "Start Over clears the photos and settings in this workspace. Saved designs stay in Version History. Continue?",
      );
      if (!ok) return;
      resetCustomize();
      clickAll("#clearLocks");
      document.dispatchEvent(new CustomEvent("rd:canvas-start-over"));
      const go = (window as any).__rdGo;
      if (typeof go === "function") go("studio");
    }
    return;
  }
  if (!t.closest("#rdwMoreMenu")) closeMoreMenu();
});
