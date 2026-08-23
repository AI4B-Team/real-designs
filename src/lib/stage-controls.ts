/**
 * Virtual Stage controls.
 *
 * One section inside the existing Canvas settings panel owns everything the
 * Stage tool needs: the room-understanding card (with corrections), the
 * staging mode, the staging settings, zone painting, the variation plan, the
 * brief the user confirms before any credit is spent, and the post-generation
 * quality report.
 *
 * Nothing here decides money or prompts: it only reads and writes the state
 * that @/lib/stage-brief turns into a brief.
 */

import { createIcons, icons as lucideIcons } from "lucide";
import {
  FEATURE_LABEL,
  MLS_DISCLOSURE,
  OCCUPANCY_LEVELS,
  PALETTES,
  PURPOSES,
  STAGE_MODES,
  VARIATION_CHOICES,
  VIRTUALLY_STAGED_LABEL,
  ZONE_COLS,
  ZONE_ROWS,
  costSentence,
  buildRuns,
  emptyAnalysis,
  furnitureCategories,
  modeFit,
  occupancyLabel,
  roomOptions,
  zoneCellId,
  type DetectedFeatureId,
  type Occupancy,
  type QualityReport,
  type RoomAnalysis,
  type StageBrief,
  type StageModeId,
} from "@/lib/stage-brief";

const byId = (id: string) => document.getElementById(id);

function icons() {
  try {
    createIcons({ icons: lucideIcons });
  } catch (_) {
    /* icons are cosmetic */
  }
}

function esc(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}

/* ------------------------------------------------------------- state */

type ZoneMode = "off" | "free" | "preferred";

const state = {
  analysis: null as RoomAnalysis | null,
  analyzing: false,
  analyzeError: null as string | null,
  /** Features the user switched off because the detection was wrong. */
  rejectedFeatures: new Set<string>(),
  zoneMode: "off" as ZoneMode,
  freeZones: new Set<string>(),
  preferredZones: new Set<string>(),
  /** Property-wide direction and the rooms already staged in this property. */
  propertyDirection: null as string | null,
  consistencyWith: [] as string[],
};

export function stageAnalysis(): RoomAnalysis | null {
  if (!state.analysis) return null;
  return {
    ...state.analysis,
    features: state.analysis.features.filter((f) => !state.rejectedFeatures.has(f)),
    occupancy: readOccupancyOverride() || state.analysis.occupancy,
    roomType: state.analysis.roomType,
  };
}

export function resetStageAnalysis() {
  state.analysis = null;
  state.analyzeError = null;
  state.rejectedFeatures.clear();
  paintDetection();
}

export function setPropertyStagingContext(direction: string | null, rooms: string[]) {
  state.propertyDirection = direction && direction.trim() ? direction.trim() : null;
  state.consistencyWith = (rooms || []).filter(Boolean).slice(0, 10);
}

/* -------------------------------------------------------------- panel */

let onChangeCb: (() => void) | null = null;
let analyzeCb: (() => void) | null = null;

function change() {
  paintSummary();
  try {
    onChangeCb?.();
  } catch (_) {
    /* the panel repaints on its own next tick */
  }
}

function chipRow(name: string, items: Array<{ id: string; label: string; tip?: string }>, on: string) {
  return (
    '<div class="rd-stage-chips" data-group="' +
    name +
    '">' +
    items
      .map(
        (i) =>
          '<button type="button" class="rd-stage-chip' +
          (i.id === on ? " on" : "") +
          '" data-' +
          name +
          '="' +
          esc(i.id) +
          '"' +
          (i.tip ? ' title="' + Esc(i.tip) + '"' : "") +
          ">" +
          esc(i.label) +
          "</button>",
      )
      .join("") +
    "</div>"
  );
}

export function mountStagePanel(opts?: { onChange?: () => void; onAnalyze?: () => void }) {
  onChangeCb = opts?.onChange || null;
  analyzeCb = opts?.onAnalyze || null;
  if (byId("rdStageSec")) return;
  const body = byId("rdwPanelBody");
  if (!body) return;

  const sec = document.createElement("div");
  sec.id = "rdStageSec";
  sec.className = "rd-stage";
  sec.hidden = true;
  sec.innerHTML =
    /* room understanding */
    '<div class="rd-stage-block" id="rdStageDetectBlock">' +
    '<div class="rd-stage-h"><b>Room Understanding</b>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdStageAnalyze">Analyze Photo</button></div>' +
    '<div class="rd-stage-detect" id="rdStageDetect"></div>' +
    "</div>" +
    /* mode */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Staging Mode</b></div>' +
    '<div class="rd-stage-modes" id="rdStageModes">' +
    STAGE_MODES.map(
      (m, i) =>
        '<button type="button" class="rd-stage-mode' +
        (i === 0 ? " on" : "") +
        '" data-mode="' +
        m.id +
        '"><b>' +
        esc(m.label) +
        "</b><span>" +
        esc(m.blurb) +
        "</span></button>",
    ).join("") +
    "</div>" +
    '<p class="rd-stage-fit" id="rdStageFit" hidden></p>' +
    "</div>" +
    /* settings */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Staging Settings</b></div>' +
    '<label class="rd-stage-lab">Occupancy</label>' +
    chipRow(
      "occ",
      OCCUPANCY_LEVELS.map((o) => ({ id: o.id, label: o.label, tip: o.blurb })),
      "balanced",
    ) +
    '<label class="rd-stage-lab">Purpose</label>' +
    chipRow(
      "purpose",
      PURPOSES.map((p) => ({ id: p.id, label: p.label })),
      "mls",
    ) +
    '<label class="rd-stage-lab">Color Palette</label>' +
    chipRow(
      "palette",
      PALETTES.map((p) => ({ id: p.id, label: p.label })),
      "auto",
    ) +
    '<div id="rdStageRoomOpts"></div>' +
    '<label class="rd-stage-lab">Furniture Categories</label>' +
    '<div class="rd-stage-cats" id="rdStageCats"></div>' +
    "</div>" +
    /* items */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Items</b></div>' +
    '<div class="rd-stage-items" id="rdStageItems">' +
    ["keep", "remove", "avoid"]
      .map(
        (k) =>
          '<div class="rd-stage-item" data-list="' +
          k +
          '"><label class="rd-stage-lab">' +
          (k === "keep" ? "Items To Keep" : k === "remove" ? "Items To Remove" : "Items To Avoid") +
          '</label><div class="rd-stage-tags" id="rdStageTags-' +
          k +
          '"></div>' +
          '<div class="rd-stage-add"><input type="text" data-add="' +
          k +
          '" placeholder="' +
          (k === "keep"
            ? "Example: the existing sofa"
            : k === "remove"
              ? "Example: the recliner"
              : "Example: bunk beds") +
          '" aria-label="Add item"><button type="button" class="btn btn-ghost btn-xs" data-addbtn="' +
          k +
          '">Add</button></div></div>',
      )
      .join("") +
    "</div></div>" +
    /* zones */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Placement Zones</b>' +
    '<span class="rd-stage-note">Optional</span></div>' +
    '<div class="rd-stage-zonebtns">' +
    '<button type="button" class="rd-stage-chip" data-zone="free">Paint Furniture-Free</button>' +
    '<button type="button" class="rd-stage-chip" data-zone="preferred">Paint Preferred</button>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdStageZoneClear">Clear</button>' +
    "</div>" +
    '<div class="rd-stage-grid" id="rdStageGrid"></div>' +
    "</div>" +
    /* variations */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Results</b></div>' +
    '<div class="rd-stage-vars" id="rdStageVars">' +
    VARIATION_CHOICES.map(
      (v) =>
        '<label class="rd-stage-var"><input type="checkbox" data-var="' +
        v.id +
        '"><span><b>' +
        esc(v.label) +
        "</b><em>" +
        esc(v.blurb) +
        "</em></span></label>",
    ).join("") +
    "</div>" +
    '<p class="rd-stage-cost" id="rdStageCost"></p>' +
    "</div>";

  const anchor = byId("rdwCustomize");
  if (anchor && anchor.parentElement === body) body.insertBefore(sec, anchor);
  else body.appendChild(sec);

  buildGrid();
  paintRoomOptions();
  paintCategories();
  paintDetection();
  paintSummary();

  sec.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const mode = t.closest("[data-mode]") as HTMLElement | null;
    if (mode) {
      sec.querySelectorAll(".rd-stage-mode").forEach((x) => x.classList.remove("on"));
      mode.classList.add("on");
      change();
      return;
    }
    const chip = t.closest(".rd-stage-chip[data-occ],.rd-stage-chip[data-purpose],.rd-stage-chip[data-palette]") as HTMLElement | null;
    if (chip) {
      chip.parentElement?.querySelectorAll(".rd-stage-chip").forEach((x) => x.classList.remove("on"));
      chip.classList.add("on");
      change();
      return;
    }
    const cat = t.closest("[data-cat]") as HTMLElement | null;
    if (cat) {
      cat.classList.toggle("on");
      change();
      return;
    }
    const zone = t.closest("[data-zone]") as HTMLElement | null;
    if (zone) {
      const want = zone.getAttribute("data-zone") as ZoneMode;
      state.zoneMode = state.zoneMode === want ? "off" : want;
      sec
        .querySelectorAll<HTMLElement>("[data-zone]")
        .forEach((b) => b.classList.toggle("on", b.getAttribute("data-zone") === state.zoneMode));
      byId("rdStageGrid")?.classList.toggle("painting", state.zoneMode !== "off");
      return;
    }
    if (t.closest("#rdStageZoneClear")) {
      state.freeZones.clear();
      state.preferredZones.clear();
      paintGrid();
      change();
      return;
    }
    const cell = t.closest("[data-cell]") as HTMLElement | null;
    if (cell) {
      if (state.zoneMode === "off") return;
      const id = cell.getAttribute("data-cell") || "";
      const set = state.zoneMode === "free" ? state.freeZones : state.preferredZones;
      const other = state.zoneMode === "free" ? state.preferredZones : state.freeZones;
      if (set.has(id)) set.delete(id);
      else {
        set.add(id);
        other.delete(id);
      }
      paintGrid();
      change();
      return;
    }
    const addBtn = t.closest("[data-addbtn]") as HTMLElement | null;
    if (addBtn) {
      addItem(addBtn.getAttribute("data-addbtn") || "keep");
      return;
    }
    const tag = t.closest("[data-tagdel]") as HTMLElement | null;
    if (tag) {
      const list = tag.getAttribute("data-list") || "keep";
      const val = tag.getAttribute("data-tagdel") || "";
      items[list] = (items[list] || []).filter((v) => v !== val);
      paintTags(list);
      change();
      return;
    }
    if (t.closest("#rdStageAnalyze")) {
      analyzeCb?.();
      return;
    }
    const fix = t.closest("[data-feature]") as HTMLElement | null;
    if (fix) {
      const id = fix.getAttribute("data-feature") || "";
      if (state.rejectedFeatures.has(id)) state.rejectedFeatures.delete(id);
      else state.rejectedFeatures.add(id);
      fix.classList.toggle("off", state.rejectedFeatures.has(id));
      change();
      return;
    }
  });

  sec.addEventListener("change", (e) => {
    const t = e.target as HTMLElement;
    if (t.matches("[data-var]") || t.matches("[data-roomopt]") || t.matches("#rdStageOcc")) change();
  });

  sec.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if ((e as KeyboardEvent).key === "Enter" && t.matches("[data-add]")) {
      e.preventDefault();
      addItem(t.getAttribute("data-add") || "keep");
    }
  });

  icons();
}

/** Shows the Stage section only while Virtual Stage is the active tool. */
export function setStagePanelVisible(on: boolean) {
  const sec = byId("rdStageSec");
  if (sec) sec.hidden = !on;
}

/* --------------------------------------------------------- sub-painters */

const items: Record<string, string[]> = { keep: [], remove: [], avoid: [] };

function addItem(list: string) {
  const input = document.querySelector<HTMLInputElement>('[data-add="' + list + '"]');
  const val = (input?.value || "").trim();
  if (!val) return;
  if (!items[list]) items[list] = [];
  if (!items[list]!.some((v) => v.toLowerCase() === val.toLowerCase())) items[list]!.push(val);
  if (input) input.value = "";
  paintTags(list);
  change();
}

/** Adds an item from outside the panel, e.g. a detected piece the user taps. */
export function addStageItem(list: "keep" | "remove" | "avoid", label: string) {
  const val = String(label || "").trim();
  if (!val) return;
  if (!items[list]!.some((v) => v.toLowerCase() === val.toLowerCase())) items[list]!.push(val);
  paintTags(list);
  change();
}

function paintTags(list: string) {
  const host = byId("rdStageTags-" + list);
  if (!host) return;
  host.innerHTML = (items[list] || [])
    .map(
      (v) =>
        '<button type="button" class="rd-stage-tag" data-list="' +
        list +
        '" data-tagdel="' +
        esc(v) +
        '">' +
        esc(v) +
        '<i data-lucide="x"></i></button>',
    )
    .join("");
  icons();
}

function buildGrid() {
  const host = byId("rdStageGrid");
  if (!host) return;
  const cells: string[] = [];
  for (let r = 1; r <= ZONE_ROWS; r++)
    for (let c = 1; c <= ZONE_COLS; c++)
      cells.push('<button type="button" class="rd-stage-cell" data-cell="' + zoneCellId(c, r) + '"></button>');
  host.style.setProperty("--rd-zone-cols", String(ZONE_COLS));
  host.innerHTML = cells.join("");
  paintGrid();
}

function paintGrid() {
  const host = byId("rdStageGrid");
  if (!host) return;
  /* The grid sits over a thumbnail of the actual source photo. */
  const img = document.querySelector("#cBefore img") as HTMLImageElement | null;
  const src = img?.currentSrc || img?.src || "";
  host.style.backgroundImage = src ? 'url("' + src + '")' : "none";
  host.querySelectorAll<HTMLElement>("[data-cell]").forEach((cell) => {
    const id = cell.getAttribute("data-cell") || "";
    cell.classList.toggle("free", state.freeZones.has(id));
    cell.classList.toggle("pref", state.preferredZones.has(id));
  });
}

function currentRoomType(): string {
  return ((byId("fRoom") as HTMLSelectElement | null)?.value || "").trim();
}

function paintRoomOptions() {
  const host = byId("rdStageRoomOpts");
  if (!host) return;
  const opts = roomOptions(currentRoomType());
  host.innerHTML = opts
    .map(
      (o) =>
        '<label class="rd-stage-lab">' +
        esc(o.label) +
        '</label><select class="rd-stage-sel" data-roomopt="' +
        o.id +
        '">' +
        o.choices
          .map(
            (c) =>
              '<option value="' + esc(c) + '"' + (c === o.fallback ? " selected" : "") + ">" + esc(c) + "</option>",
          )
          .join("") +
        "</select>",
    )
    .join("");
}

function paintCategories() {
  const host = byId("rdStageCats");
  if (!host) return;
  const prev = new Set(
    Array.from(host.querySelectorAll<HTMLElement>(".on")).map((b) => b.getAttribute("data-cat") || ""),
  );
  const cats = furnitureCategories(currentRoomType());
  const first = prev.size === 0;
  host.innerHTML = cats
    .map(
      (c) =>
        '<button type="button" class="rd-stage-chip' +
        (first || prev.has(c) ? " on" : "") +
        '" data-cat="' +
        esc(c) +
        '">' +
        esc(c) +
        "</button>",
    )
    .join("");
}

/** Room type changed: the room-aware controls and categories follow it. */
export function refreshStageRoom() {
  paintRoomOptions();
  paintCategories();
  paintDetection();
  paintSummary();
}

function readOccupancyOverride(): Occupancy | null {
  const sel = byId("rdStageOcc") as HTMLSelectElement | null;
  const v = (sel?.value || "") as Occupancy;
  return v === "empty" || v === "partial" || v === "furnished" ? v : null;
}

export function setStageAnalyzing(on: boolean, error?: string | null) {
  state.analyzing = on;
  state.analyzeError = error ?? null;
  paintDetection();
}

export function setStageAnalysis(a: RoomAnalysis | null) {
  state.analysis = a;
  state.analyzing = false;
  state.analyzeError = null;
  state.rejectedFeatures.clear();
  paintDetection();
  paintSummary();
}

function paintDetection() {
  const host = byId("rdStageDetect");
  if (!host) return;
  const btn = byId("rdStageAnalyze") as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = state.analyzing;
    btn.textContent = state.analyzing
      ? "Analyzing…"
      : state.analysis
        ? "Re-Analyze Photo"
        : "Analyze Photo";
  }
  if (state.analyzing) {
    host.innerHTML = '<p class="rd-stage-muted">Reading the room, its openings and its usable floor…</p>';
    return;
  }
  if (state.analyzeError) {
    host.innerHTML =
      '<p class="rd-stage-warn">' +
      esc(state.analyzeError) +
      " Staging stays disabled until this photo can be analyzed.</p>";
    return;
  }
  const a = state.analysis;
  if (!a) {
    host.innerHTML =
      '<p class="rd-stage-muted">This photo has not been analyzed yet. Staging needs to know whether the room is empty, partly furnished or fully furnished before it can run.</p>';
    return;
  }
  const featureChips = a.features.length
    ? a.features
        .map(
          (f: DetectedFeatureId) =>
            '<button type="button" class="rd-stage-fchip' +
            (state.rejectedFeatures.has(f) ? " off" : "") +
            '" data-feature="' +
            f +
            '" title="Tap If This Is Wrong">' +
            esc(FEATURE_LABEL[f]) +
            "</button>",
        )
        .join("")
    : '<span class="rd-stage-muted">No architecture detected.</span>';
  host.innerHTML =
    '<div class="rd-stage-drow"><span class="k">Detected Room</span><span class="v">' +
    esc(a.roomType || "Unknown") +
    "</span></div>" +
    '<div class="rd-stage-drow"><span class="k">Occupancy</span>' +
    '<select class="rd-stage-sel" id="rdStageOcc">' +
    (["empty", "partial", "furnished"] as Occupancy[])
      .map(
        (o) =>
          '<option value="' + o + '"' + (o === a.occupancy ? " selected" : "") + ">" + occupancyLabel(o) + "</option>",
      )
      .join("") +
    "</select></div>" +
    (a.summary ? '<p class="rd-stage-muted">' + esc(a.summary) + "</p>" : "") +
    '<div class="rd-stage-fchips">' +
    featureChips +
    "</div>" +
    (a.furniture.length
      ? '<p class="rd-stage-muted">Existing items: ' + esc(a.furniture.join(", ")) + "</p>"
      : "") +
    '<p class="rd-stage-muted">Something wrong? Correct the room type in Setup and switch off anything above that is not really there.</p>';
  byId("rdStageOcc")?.addEventListener("change", change);
  icons();
}

function paintSummary() {
  const fit = byId("rdStageFit");
  if (fit) {
    const f = modeFit(readStageMode(), stageAnalysis());
    fit.hidden = f.level === "ok" || !f.message;
    fit.textContent = f.message || "";
    fit.className = "rd-stage-fit" + (f.level === "block" ? " is-block" : "");
  }
  const cost = byId("rdStageCost");
  if (cost) cost.textContent = costSentence(buildRuns(readStageExtras()));
  paintGrid();
}

/* ------------------------------------------------------------- readers */

export function readStageMode(): StageModeId {
  const on = document.querySelector("#rdStageModes .rd-stage-mode.on") as HTMLElement | null;
  return ((on?.getAttribute("data-mode") as StageModeId) || "empty") as StageModeId;
}

function readChip(group: string, fallback: string): string {
  const on = document.querySelector('.rd-stage-chips[data-group="' + group + '"] .rd-stage-chip.on');
  return on?.getAttribute("data-" + group) || fallback;
}

export function readStageExtras(): string[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>("#rdStageVars input[data-var]:checked")).map(
    (i) => i.getAttribute("data-var") || "",
  );
}

/** Everything the panel currently holds, ready for buildStageBrief(). */
export function readStageSettings() {
  const roomChoices: Record<string, string> = {};
  document.querySelectorAll<HTMLSelectElement>("[data-roomopt]").forEach((sel) => {
    roomChoices[sel.getAttribute("data-roomopt") || ""] = sel.value;
  });
  return {
    mode: readStageMode(),
    occupancy: readChip("occ", "balanced"),
    purpose: readChip("purpose", "mls"),
    palette: readChip("palette", "auto"),
    categories: Array.from(document.querySelectorAll<HTMLElement>("#rdStageCats .rd-stage-chip.on")).map(
      (b) => b.getAttribute("data-cat") || "",
    ),
    keep: items["keep"]!.slice(),
    remove: items["remove"]!.slice(),
    avoid: items["avoid"]!.slice(),
    roomChoices,
    freeZones: Array.from(state.freeZones),
    preferredZones: Array.from(state.preferredZones),
    propertyDirection: state.propertyDirection,
    consistencyWith: state.consistencyWith,
    extras: readStageExtras(),
    analysis: stageAnalysis(),
  };
}

/* --------------------------------------------------------- brief review */

export type StageBriefAnswer = "confirm" | "cancel";

/**
 * The last screen before any credit is spent. It states the exact number of
 * results and the exact total cost, and resolves only on an explicit click.
 */
export function openStageBriefReview(
  brief: StageBrief,
  opts: { costLabel: string; balanceNote?: string | null },
): Promise<StageBriefAnswer> {
  return new Promise((resolve) => {
    byId("rdStageBrief")?.remove();
    const m = document.createElement("div");
    m.id = "rdStageBrief";
    m.className = "up-modal on rd-brief";
    m.innerHTML =
      '<div class="up-scrim" data-close></div><div class="up-card rd-brief-card" role="dialog" aria-modal="true" aria-label="Review Staging Brief">' +
      "<h3>Review Your Staging Brief</h3>" +
      '<p class="rd-brief-sub">Nothing is generated and no credits are used until you confirm.</p>' +
      '<div class="rd-brief-list">' +
      brief.lines
        .map(
          (l) =>
            '<div class="rd-brief-row"><span class="k">' +
            esc(l.k) +
            '</span><span class="v">' +
            esc(l.v) +
            "</span></div>",
        )
        .join("") +
      "</div>" +
      (brief.warnings.length
        ? '<div class="rd-brief-warn"><b>Check This First</b><ul>' +
          brief.warnings.map((w) => "<li>" + esc(w) + "</li>").join("") +
          "</ul></div>"
        : "") +
      '<p class="rd-brief-note">' +
      esc(brief.costSentence) +
      "</p>" +
      (brief.disclosure ? '<p class="rd-brief-note">' + esc(brief.disclosure) + "</p>" : "") +
      '<div class="up-act"><button class="btn btn-primary" id="rdStageGo" type="button">Stage Room · ' +
      esc(opts.costLabel) +
      "</button>" +
      '<button class="btn btn-ghost" type="button" data-close>Back To Settings</button></div>' +
      (opts.balanceNote ? '<p class="rd-brief-bal">' + esc(opts.balanceNote) + "</p>" : "") +
      "</div>";
    (document.querySelector(".rd-app") || document.body).appendChild(m);
    icons();
    const done = (r: StageBriefAnswer) => {
      m.remove();
      resolve(r);
    };
    m.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-close]")) done("cancel");
    });
    const go = byId("rdStageGo") as HTMLButtonElement | null;
    go?.addEventListener("click", () => {
      /* One confirmation per brief: the button cannot start a second job. */
      if (go.disabled) return;
      go.disabled = true;
      done("confirm");
    });
    setTimeout(() => go?.focus(), 20);
  });
}

/* -------------------------------------------------------- quality panel */

/** Honest reporting of the automatic post-generation checks. */
export function showStageQuality(
  report: QualityReport | null,
  handlers: { onRegenerate?: () => void; onDismiss?: () => void } = {},
) {
  byId("rdStageQa")?.remove();
  if (!report || !report.issues.length) return;
  const stage = byId("rdwStage") || document.querySelector(".rdw-stage");
  if (!stage) return;
  const el = document.createElement("div");
  el.id = "rdStageQa";
  el.className = "rd-stage-qa" + (report.rejected ? " is-bad" : "");
  el.innerHTML =
    '<i data-lucide="triangle-alert"></i><div><b>' +
    esc(report.headline) +
    "</b><ul>" +
    report.issues.map((i) => "<li>" + esc(i.detail) + "</li>").join("") +
    "</ul>" +
    '<div class="rd-stage-qa-act">' +
    '<button type="button" class="btn btn-primary btn-xs" id="rdStageRegen">Generate Again</button>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdStageQaClose">Keep This Result</button>' +
    "</div></div>";
  stage.appendChild(el);
  icons();
  byId("rdStageRegen")?.addEventListener("click", () => {
    el.remove();
    handlers.onRegenerate?.();
  });
  byId("rdStageQaClose")?.addEventListener("click", () => {
    el.remove();
    handlers.onDismiss?.();
  });
}

/* ----------------------------------------------------- export disclosure */

/**
 * Burns the MLS-compliant disclosure into a copy of the staged image for
 * export. The stored version is never modified.
 */
export function applyStagingDisclosure(dataUrl: string, text = MLS_DISCLOSURE): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0);
        const bar = Math.max(34, Math.round(canvas.height * 0.062));
        ctx.fillStyle = "rgba(0,0,0,0.72)";
        ctx.fillRect(0, canvas.height - bar, canvas.width, bar);
        const size = Math.max(12, Math.round(bar * 0.34));
        ctx.font = "600 " + size + "px system-ui, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";
        const label = VIRTUALLY_STAGED_LABEL.toUpperCase() + " — " + text;
        ctx.fillText(label, Math.round(size * 0.8), canvas.height - bar / 2, canvas.width - size * 1.6);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (_) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export const STAGE_EMPTY_ANALYSIS = emptyAnalysis;
