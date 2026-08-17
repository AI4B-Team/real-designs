/**
 * Studio start experience.
 *
 * Two states only:
 *   1. "choose" — the compact four-card starting selector.
 *   2. "setup"  — one focused source-setup screen for the chosen method.
 *
 * The Studio editor (canvas + right controls) is hidden until a real source is
 * loaded or a concept has been generated. Nothing generates and no credit is
 * spent until the user presses a primary action.
 */

import { renderConcept } from "@/lib/concept-render.functions";
import {
  detectSource,
  SOURCE_LABELS,
  WORKFLOW_BY_TYPE,
  type SourceDetection,
  type SourceType,
} from "@/lib/source-detect.functions";
import { getStudioStyle, clearStudioStyle, applyStudioStyleToControls, type StudioStyleChoice } from "@/lib/studio-style";
import { isPlanBlocked, openUpgrade } from "@/lib/rd-upgrade";
import { measureImage, classify, FLAG_LABEL } from "@/lib/media-analysis";
import { getMyCredits } from "@/lib/credits.functions";

type Method = "upload" | "describe" | "property";

export type StudioStartCtx = {
  lucide: { createIcons: (o?: any) => void };
  esc: (s: string) => string;
  photos: Record<string, string>;
  go: (view: string) => void;
  track: (event: string, props?: Record<string, unknown>) => void;
  /** Persists an uploaded file and returns a displayable URL. */
  uploadPhoto: (file: File) => Promise<string>;
  /** Loads a real source into the Studio canvas. */
  setSource: (kind: string, src: string, alt: string, opts?: any) => void;
  /** Places a finished concept image on the canvas as a result. */
  showConcept: (image: string, label: string) => Promise<void> | void;
  /** Property tree already loaded by the app shell. */
  getProperties: () => Array<{
    address: string;
    projects: Array<{ name: string; rooms?: Array<{ before_path?: string | null }> }>;
  }>;
  /** Applies a chosen property/project context to the Studio header. */
  setContext: (ctx: { address?: string | null; project?: string | null; room?: string | null }) => void;
  showAlert: (msg: string) => void;
  /** Recent designs for the "Continue Where You Left Off" strip. */
  getRecent?: () => Array<{ id: string; name: string; sub: string; status: string; path: string }>;
  /** Opens a recent design in the Studio editor. */
  openRecent?: (id: string) => void;
  /** Resolves a stored photo path into a displayable URL. */
  resolvePhoto?: (path: string) => Promise<string | null>;
  fileToDataUrl: (file: File) => Promise<string>;
};

import { mountSourcePicker } from "@/lib/source-picker";
import { cleanAddressText } from "@/lib/property-address";

const SAMPLE_KEYS: Array<{ key: string; name: string; space: string; room: string; photo: string; alt: string }> = [];

const ROOM_OTHER = "Other";
const ROOMS = [
  "Living Room",
  "Kitchen",
  "Primary Bedroom",
  "Bedroom",
  "Guest Bedroom",
  "Nursery",
  "Primary Bath",
  "Guest Bath",
  "Half Bath",
  "Dining Room",
  "Home Office",
  "Bonus Room",
  "Sunroom",
  "Entry",
  "Hallway",
  "Stairwell",
  "Closet",
  "Laundry",
  "Mudroom",
  "Garage",
  "Basement",
  "Attic",
  "Commercial Space",
  "Facade",
  "Front Yard",
  "Backyard",
  "Patio",
  "Deck",
  "Pool Area",
  ROOM_OTHER,
];
const STYLES = ["Warm Minimal", "Modern Farmhouse", "Coastal", "Transitional", "Investor Neutral", "Midcentury", "Japandi"];
const BUDGETS = ["Under $5K", "Under $15K", "Under $35K", "$35K+"];
const GOALS = ["Refresh", "Makeover", "Renovation", "Reimagine"];
const MOODS = ["Calm", "Warm", "Bright", "Dramatic", "Natural", "Refined"];

export function mountStudioStart(ctx: StudioStartCtx) {
  const { esc, lucide } = ctx;
  const view = document.getElementById("v-studio");
  if (!view) return { paint: () => {}, open: () => {} };

  if (!SAMPLE_KEYS.length) {
    const p = ctx.photos || {};
    SAMPLE_KEYS.push(
      { key: "living", name: "Empty Living Room", space: "interior", room: "Living Room", photo: p["empty"] || p["before"] || "", alt: "Sample empty living room" },
      { key: "kitchen", name: "Dated Kitchen", space: "interior", room: "Kitchen", photo: p["kitchenBefore"] || p["kitchen"] || "", alt: "Sample dated kitchen" },
      { key: "bath", name: "Primary Bathroom", space: "interior", room: "Primary Bath", photo: p["bathBefore"] || p["bath"] || "", alt: "Sample primary bathroom" },
      { key: "exterior", name: "Home Exterior", space: "exterior", room: "Facade", photo: p["paintedBrick"] || p["ranch"] || "", alt: "Sample home exterior" },
      { key: "yard", name: "Backyard", space: "landscape", room: "Backyard", photo: p["resortYard"] || p["after"] || "", alt: "Sample backyard" },
    );
  }

  const state = {
    method: "upload" as Method,
    /** Which door the user opened on the start screen: "" (none yet) or "design". */
    door: "" as "" | "design" | "video",
    /** Chosen file, not uploaded yet. */
    file: null as File | null,
    fileName: "",
    filePreview: "",
    /** Classification of the chosen file, null until the service answers. */
    detected: null as SourceDetection | null,
    detecting: false,
    /** Whether the compact classification dropdown is open. */
    pickType: false,
    space: "interior",
    /** Empty until the user chooses, or detection assigns one. */
    room: "",
    roomOther: "",
    roomDetected: false,
    /** Quality flags measured on the chosen photo, advisory only. */
    flags: [] as string[],
    flagsDismissed: false,
    credits: null as any,
    goal: "Makeover",
    style: "Warm Minimal",
    budget: "Under $15K",
    accents: "",
    notes: "",
    inputType: "Hand Sketch",
    dims: "",
    mood: "",
    features: "",
    prompt: "",
    inspiration: null as File | null,
    samples: false,
    busy: false,
    property: "",
    /** Optional property address. Never required to start or save a design. */
    address: "",
    /** Property attached after a create-property step. */
    attached: "",
    newAddress: "",
    newNickname: "",
    newType: "Single Family",
    newProject: "",
    /** "choose" shows the starting selector, "setup" the focused source setup. */
    phase: "choose" as "choose" | "setup",
  };

  /** Style chosen on Explore, if any. Selecting never generates or charges. */
  let styleChoice: StudioStyleChoice | null = getStudioStyle();
  if (styleChoice) state.style = styleChoice.name;

  function refreshStyleChoice() {
    styleChoice = getStudioStyle();
    if (styleChoice) state.style = styleChoice.name;
  }
  window.addEventListener("rd:style-selected", () => { refreshStyleChoice(); if (host) render(); });

  /** Close the sample chooser on Escape and whenever the user leaves Studio. */
  function closeSamples() {
    if (!state.samples) return;
    state.samples = false;
    if (host) render();
  }
  window.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.key === "Escape") closeSamples();
  });
  window.addEventListener("hashchange", () => {
    if (!/#v-studio\b/.test(location.hash)) closeSamples();
  });


  /** Local escape: the banner can render before the shell helpers initialize. */
  const escLocal = (v: string) =>
    String(v == null ? "" : v).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] as string));

  /** Compact "Style selected" confirmation shown above the source actions. */
  function styleBanner() {
    if (!styleChoice) return "";
    return (
      '<div class="sts-stylebar">' +
      (styleChoice.thumb ? '<img src="' + escLocal(styleChoice.thumb) + '" alt="' + escLocal(styleChoice.name) + ' style preview">' : "") +
      "<div><b>Style Selected: " + escLocal(styleChoice.name) + "</b>" +
      "<span>Choose a source below to start designing in this style.</span></div>" +
      '<button type="button" class="btn btn-primary btn-xs" data-sts="c-upload">Upload A File</button>' +
      '<button type="button" class="sts-link" data-sts="changestyle">Change</button>' +
      "</div>"
    );
  }

  /* ---------- hidden file inputs ---------- */
  const filePick = document.createElement("input");
  filePick.type = "file";
  filePick.hidden = true;
  filePick.accept = "image/*";
  view.appendChild(filePick);
  filePick.addEventListener("change", () => {
    const f = filePick.files && filePick.files[0];
    filePick.value = "";
    if (f) takeFile(f);
  });

  const inspoPick = document.createElement("input");
  inspoPick.type = "file";
  inspoPick.hidden = true;
  inspoPick.accept = "image/*";
  view.appendChild(inspoPick);
  inspoPick.addEventListener("change", () => {
    const f = inspoPick.files && inspoPick.files[0];
    inspoPick.value = "";
    if (f) {
      state.inspiration = f;
      render();
    }
  });

  function browse() {
    filePick.accept = "image/*,application/pdf";
    filePick.click();
  }

  function takeFile(f: File) {
    if (state.filePreview) URL.revokeObjectURL(state.filePreview);
    state.file = f;
    state.fileName = f.name;
    state.filePreview = /^image\//.test(f.type) ? URL.createObjectURL(f) : "";
    state.detected = null;
    state.detecting = false;
    state.pickType = false;
    state.flags = [];
    state.flagsDismissed = false;
    render();
    if (state.method === "upload") {
      runDetection(f);
      runQuality(f);
    }
  }

  /* ---------- source detection (shared result component) ---------- */

  /** Runs the classification service on the chosen file and repaints. */
  async function runDetection(f: File) {
    const supported = /^image\//.test(f.type) || /pdf/i.test(f.type);
    if (!supported) {
      state.detected = { sourceType: "unsupported", confidence: 1, suggestedWorkflow: "manual_classification" };
      render();
      return;
    }
    state.detecting = true;
    render();
    let result: SourceDetection = { sourceType: "uncertain", confidence: 0, suggestedWorkflow: "manual_classification" };
    try {
      const dataUrl = await ctx.fileToDataUrl(f);
      result = await detectSource({ data: { file: dataUrl, mimeType: f.type || "image/jpeg" } });
    } catch (_) {
      /* the service boundary stays honest: unknown stays uncertain */
    }
    if (state.file !== f) return;
    state.detecting = false;
    state.detected = result;
    applyDetection(result.sourceType);
    render();
  }

  /** Advisory photo-quality check. Never blocks, never charges. */
  async function runQuality(f: File) {
    if (!/^image\//.test(f.type)) return;
    try {
      const m = await measureImage(f);
      const c = classify(f.name || "", m);
      if (state.file !== f) return;
      state.flags = c.flags || [];
      render();
    } catch (_) {
      /* measurement is advisory: a failure stays silent */
    }
  }

  /** Real balance and remaining free designs, so the cost is honest. */
  async function loadCredits() {
    try {
      const c = await getMyCredits();
      state.credits = c;
      if (host) render();
    } catch (_) {
      /* the button falls back to a plain Continue */
    }
  }
  loadCredits();
  window.addEventListener("rd:credits-changed", () => { loadCredits(); });

  /** Maps a classification onto the setup fields that drive the workflow. */
  function applyDetection(type: SourceType) {
    if (type === "interior_photo") state.space = "interior";
    else if (type === "exterior_photo") {
      state.space = "exterior";
      state.room = "Facade";
      state.roomDetected = true;
    } else if (type === "landscape_photo") {
      state.space = "landscape";
      state.room = "Backyard";
      state.roomDetected = true;
    } else if (type === "sketch") state.inputType = "Hand Sketch";
    else if (type === "floor_plan") state.inputType = "Floor Plan";
  }

  function isPlanSource() {
    const t = state.detected?.sourceType;
    return t === "sketch" || t === "floor_plan";
  }

  const PICK_TYPES: SourceType[] = [
    "interior_photo",
    "exterior_photo",
    "landscape_photo",
    "sketch",
    "floor_plan",
  ];

  /** Reusable detection-result component shown under the upload preview. */
  function detectionHtml() {
    if (!state.file) return "";
    if (state.detecting) {
      return '<div class="stw-det"><i data-lucide="loader" class="stw-det-spin"></i><span>Analyzing your upload…</span></div>';
    }
    const d = state.detected;
    if (!d) return "";
    const dropdown =
      '<div class="stw-det-pick">' +
      '<select id="stsType">' +
      PICK_TYPES.map(
        (t) =>
          '<option value="' + t + '"' + (t === d.sourceType ? " selected" : "") + ">" + esc(SOURCE_LABELS[t]) + "</option>",
      ).join("") +
      "</select></div>";

    if (d.sourceType === "unsupported") {
      return (
        '<div class="stw-det stw-det-warn"><i data-lucide="alert-circle"></i>' +
        "<span>We can't read that file type. Choose the closest match to continue.</span></div>" +
        dropdown
      );
    }
    if (d.sourceType === "uncertain") {
      return (
        '<div class="stw-det"><i data-lucide="help-circle"></i><span>What type of file is this?</span></div>' + dropdown
      );
    }
    return (
      '<div class="stw-det"><i data-lucide="check-circle-2"></i>' +
      "<span>Detected: <b>" + esc(SOURCE_LABELS[d.sourceType]) + "</b></span>" +
      '<button class="stw-det-change" data-sts="changetype">Change</button></div>' +
      (state.pickType ? dropdown : "")
    );
  }


  /** Rotates the chosen image 90 degrees so the upload matches how it reads. */
  async function rotateFile() {
    const f = state.file;
    if (!f || !/^image\//.test(f.type)) return;
    const url = URL.createObjectURL(f);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error("read"));
        i.src = url;
      });
      const c = document.createElement("canvas");
      c.width = img.naturalHeight;
      c.height = img.naturalWidth;
      const g = c.getContext("2d")!;
      g.translate(c.width / 2, c.height / 2);
      g.rotate(Math.PI / 2);
      g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
      if (blob) takeFile(new File([blob], f.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
    } catch (_) {
      /* rotation is a convenience, keep the original on failure */
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function clearFile() {
    if (state.filePreview) URL.revokeObjectURL(state.filePreview);
    state.file = null;
    state.fileName = "";
    state.filePreview = "";
    state.detected = null;
    state.detecting = false;
    state.pickType = false;
  }

  /* ---------- small builders ---------- */

  function field(label: string, inner: string) {
    return '<div class="field"><label>' + label + "</label>" + inner + "</div>";
  }
  function select(id: string, opts: string[], value: string) {
    return (
      '<select id="' + id + '">' +
      opts.map((o) => "<option" + (o === value ? " selected" : "") + ">" + esc(o) + "</option>").join("") +
      "</select>"
    );
  }
  /** Room select with an unselected placeholder, a Detected pill and Other. */
  function roomField(label: string) {
    const opts =
      '<option value=""' + (state.room ? "" : " selected") + ">Select A Room Type</option>" +
      ROOMS.map((o) => "<option" + (o === state.room ? " selected" : "") + ">" + esc(o) + "</option>").join("");
    const pill =
      state.roomDetected && state.room
        ? '<span class="stw-detpill"><i data-lucide="sparkles"></i>Detected</span>'
        : "";
    const other =
      state.room === ROOM_OTHER
        ? '<input id="stsRoomOther" type="text" placeholder="Describe The Space" value="' + esc(state.roomOther) + '" style="margin-top:8px">'
        : "";
    return (
      '<div class="field"><label>' + label + pill + "</label>" +
      '<select id="stsRoom">' + opts + "</select>" + other + "</div>"
    );
  }

  /** The room string that travels with the design. */
  function roomValue() {
    return state.room === ROOM_OTHER ? state.roomOther.trim() : state.room;
  }

  function freeLeft() {
    const c = state.credits;
    if (!c || c.plan !== "free") return null;
    return typeof c.remainingToday === "number" ? c.remainingToday : null;
  }

  function outOfFree() {
    const left = freeLeft();
    return left !== null && left <= 0;
  }

  /** Continue label carries the real cost, in DM Mono. */
  function continueLabel() {
    const c = state.credits;
    if (!c) return "Continue";
    if (outOfFree()) return "Add Credits To Continue";
    const left = freeLeft();
    if (left !== null) {
      return 'Continue &middot; <span class="mono">1</span> Of <span class="mono">' + left + "</span> Free Designs Today";
    }
    return 'Continue &middot; <span class="mono">1</span> Credit';
  }

  function costNote() {
    if (outOfFree()) {
      return "You've used all 5 free designs for today. They reset tomorrow, or upgrade for a credit balance.";
    }
    return "Nothing generates and no credits are used until you continue.";
  }

  /** Non-blocking quality advice on the chosen photo. */
  function qualityNotice() {
    if (state.flagsDismissed || !state.flags.length) return "";
    const labels = state.flags.map((f) => FLAG_LABEL[f] || "Photo Quality");
    const head = labels[0] + (labels.length > 1 ? " And " + (labels.length - 1) + " Other Issues" : "");
    return (
      '<div class="stw-qual" title="' + esc(labels.join(", ")) + '">' +
      '<i data-lucide="triangle-alert"></i>' +
      "<div><b>" + esc(head) + "</b><span>Results May Vary.</span></div>" +
      '<div class="stw-qual-a">' +
      '<button class="stw-link" data-sts="browse"><i data-lucide="image-up"></i>Replace Photo</button>' +
      '<button class="stw-link" data-sts="qualok">Continue Anyway</button>' +
      "</div></div>"
    );
  }

  function chips(name: string, opts: Array<[string, string]>, value: string) {
    return (
      '<div class="chips">' +
      opts
        .map(
          ([k, l]) =>
            '<button class="chip' + (k === value ? " on" : "") + '" data-chip="' + name + '" data-val="' + k + '">' + l + "</button>",
        )
        .join("") +
      "</div>"
    );
  }

  /* Budget is chosen before generation so the concept and its estimate agree. */
  function budgetField() {
    return field(
      "Budget Target",
      chips("budget", BUDGETS.map((b) => [b, b] as [string, string]), state.budget) +
        '<p class="stw-help">The design is generated to fit this range, and the estimate uses the same range.</p>',
    );
  }

  function propertyField() {
    const props = (ctx.getProperties() || []).slice(0, 40);
    const opts =
      '<option value="">No Property</option>' +
      props.map((p) => '<option value="' + esc(p.address) + '"' + (p.address === state.property ? " selected" : "") + ">" + esc(p.address) + "</option>").join("");
    const picker = props.length ? field("Add To A Property (Optional)", '<select id="stsPropSel">' + opts + "</select>") : "";
    /* Optional address: a project can stay unassigned and still be saved. */
    const list =
      '<datalist id="stsAddrList">' +
      props.map((p) => '<option value="' + esc(p.address) + '"></option>').join("") +
      "</datalist>";
    const input =
      '<span class="rd-addr-in"><i data-lucide="map-pin"></i>' +
      '<input id="stsAddr" list="stsAddrList" type="text" maxlength="200" placeholder="Enter the property address" value="' +
      esc(state.address) + '"></span>' + list;
    return picker + field("Property Address", input);
  }

  function dropZone(types: string, icon: string, copy: string) {
    if (state.file) {
      return (
        '<div class="stw-file">' +
        (state.filePreview
          ? '<img src="' + state.filePreview + '" alt="Selected source preview">'
          : '<div class="stw-file-ico"><i data-lucide="file-text"></i></div>') +
        '<div class="stw-file-m"><b>' + esc(state.fileName) + "</b>" +
        (state.method === "upload" ? detectionHtml() : "") +
        '<span id="stsFileMeta">' + costNote() + '</span>' +
        '<div class="stw-file-a">' +
        '<button class="stw-link" data-sts="browse"><i data-lucide="repeat"></i>Replace</button>' +
        '<button class="stw-link" data-sts="clearfile"><i data-lucide="trash-2"></i>Remove</button>' +
        (state.filePreview ? '<button class="stw-link" data-sts="rotate"><i data-lucide="rotate-cw"></i>Rotate</button>' : "") +
        "</div></div></div>"
      );
    }

    return (
      '<div class="stw-drop" id="stsDrop">' +
      '<i data-lucide="' + icon + '"></i>' +
      "<b>" + copy + "</b>" +
      '<span class="stw-types">Drag and drop, or</span>' +
      '<button class="btn btn-dark btn-sm" data-sts="browse">Browse Files</button>' +
      '<span class="stw-types">Supported files: ' + types + "</span>" +
      '<button class="stw-samplelink" data-sts="sample">Try A Sample Space</button>' +
      "</div>"
    );
  }

  function foot(label: string, ok: boolean, note?: string, disclosure?: string) {
    return (
      '<div class="stw-foot">' +
      '<button class="btn btn-primary" id="stsGo"' + (ok && !state.busy ? "" : " disabled") + ">" +
      (state.busy ? "Working…" : label) +
      "</button>" +
      (note ? '<span class="stw-cost">' + note + "</span>" : "") +
      (disclosure ? '<p class="stw-note">' + disclosure + "</p>" : "") +
      "</div>"
    );
  }

  /* ---------- shared workflow shell ---------- */

  const STEP_LABELS = ["Source", "Details", "Review"];

  function steps(active: number) {
    return (
      '<ol class="stw-steps">' +
      STEP_LABELS.map((l, i) => {
        const n = i + 1;
        const cls = n === active ? " on" : n < active ? " done" : "";
        return (
          '<li class="stw-step' + cls + '">' +
          (n < active ? '<i data-lucide="check"></i>' : '<span class="stw-step-n">' + n + "</span>") +
          "<span>" + l + "</span></li>"
        );
      }).join("") +
      "</ol>"
    );
  }

  function workHead(title: string, desc: string, active: number) {
    return (
      '<header class="stw-head">' +
      '<div class="stw-head-l">' +
      '<span class="stw-eyebrow">New Design</span>' +
      '<div class="stw-title">' +
      '<button class="stw-back" data-sts="back" aria-label="Back to starting options"><i data-lucide="arrow-left"></i>Back</button>' +
      "<h2>" + title + "</h2>" +
      "</div>" +
      "<p>" + desc + "</p>" +
      (state.attached ? '<span class="stw-att"><i data-lucide="map-pin"></i>' + esc(state.attached) + "</span>" : "") +
      "</div>" +
      '<div class="stw-head-r">' + steps(active) + "</div>" +
      "</header>" +
      '<div class="stw-rule"></div>'
    );
  }

  function panel(title: string, inner: string, cls?: string) {
    return (
      '<section class="stw-panel' + (cls ? " " + cls : "") + '">' +
      '<div class="stw-panel-h"><h3>' + title + "</h3></div>" +
      '<div class="stw-panel-b">' + inner + "</div></section>"
    );
  }

  /* ---------- setup screens ---------- */

  /** One shared upload screen for photos, sketches, drawings and plans. */
  function uploadSetup() {
    const plan = isPlanSource();
    const details = plan
      ? field("Input Type", select("stsInput", ["Hand Sketch", "Floor Plan", "Concept Drawing"], state.inputType)) +
        field("Project Type", chips("space", [["interior", "Interior"], ["exterior", "Exterior"], ["landscape", "Garden"]], state.space)) +
        roomField("Room Or Space Type") +
        propertyField() +
        field("Approximate Dimensions (Optional)", '<input id="stsDims" type="text" placeholder="14 ft x 18 ft" value="' + esc(state.dims) + '">') +
        budgetField()
      : field("Space Type", chips("space", [["interior", "Interior"], ["exterior", "Exterior"], ["landscape", "Garden"]], state.space)) +
        roomField("Room Or Area Type") +
        propertyField() +
        field("Project Name (Optional)", '<input id="stsPProject" type="text" placeholder="e.g. Pre Listing Refresh" value="' + esc(state.newProject) + '">') +
        budgetField();

    return (
      workHead(
        "Upload A Space Or Plan",
        "Begin a design from one source image or plan. We identify what it is for you.",
        state.file ? 2 : 1,
      ) +
      styleBanner() +
      '<div class="stw-work">' +
      panel(
        "Your File",
        dropZone("JPG, PNG, HEIC, WEBP, PDF", "image-up", "Drop A Photo, Sketch Or Plan"),
        "stw-main",
      ) +
      panel(plan ? "Plan Details" : "Photo Details", details + qualityNotice() + foot(continueLabel(), canContinue(), "", costNote()), "stw-side") +
      "</div>"
    );
  }


  const EXAMPLES = ["Warm modern living room", "Resort-style backyard", "Contemporary home exterior"];

  function describeSetup() {
    return (
      workHead("Describe An Idea", "Tell us what you want to create and REAL DESIGNS will turn it into a visual concept.", state.prompt.trim().length >= 12 ? 2 : 1) +
      '<div class="stw-work stw-work-60">' +
      panel(
        "Your Idea",
        '<textarea id="stsPrompt" class="stw-ta" rows="9" placeholder="Create a warm modern living room with natural oak floors, a cream sectional, built-in shelving and soft indirect lighting.">' +
          esc(state.prompt) +
          "</textarea>" +
          '<p class="stw-help">The more detail you give about materials, colors and lighting, the closer the concept lands.</p>' +
          '<div class="stw-ex"><span>Try:</span>' +
          EXAMPLES.map((e) => '<button class="stw-exlink" data-ex="' + esc(e) + '">' + esc(e) + "</button>").join("") +
          "</div>" +
          '<div class="stw-inspo">' +
          '<button class="stw-link" data-sts="inspo"><i data-lucide="image-plus"></i>' +
          (state.inspiration ? "Inspiration: " + esc(state.inspiration.name) : "Add An Inspiration Image (Optional)") +
          "</button>" +
          (state.inspiration ? '<button class="stw-link" data-sts="rminspo"><i data-lucide="x"></i>Remove</button>' : "") +
          "</div>",
        "stw-main",
      ) +
      panel(
        "Design Details",
        field("Project Type", chips("space", [["interior", "Interior"], ["exterior", "Exterior"], ["landscape", "Garden"]], state.space)) +
          roomField("Room Or Space Type") +
          field("Approximate Dimensions (Optional)", '<input id="stsDims" type="text" placeholder="14 ft x 18 ft" value="' + esc(state.dims) + '">') +
          '<div class="stw-sep"></div>' +
          field("Design Style", select("stsStyle", STYLES, state.style)) +
          field("Mood", select("stsMood", ["", ...MOODS], state.mood)) +
          '<div class="stw-sep"></div>' +
          field("Budget Range", select("stsBudget", BUDGETS, state.budget)) +
          field("Must-Have Features (Optional)", '<textarea id="stsFeatures" rows="3" placeholder="Built-in shelving, durable rug, reading corner">' + esc(state.features) + "</textarea>") +
          foot(
            "Generate Concept",
            state.prompt.trim().length >= 12,
            "Uses 1 Design Credit",
            "Text-only concepts are visual ideas. Add a real photo, sketch or plan for property-specific results.",
          ),
        "stw-side",
      ) +
      "</div>"
    );
  }

  const CREATES: Array<[string, string, string]> = [
    ["door-open", "Rooms", "Keep every space organized."],
    ["layout-grid", "Designs", "Compare versions and approvals."],
    ["calculator", "Budget", "Track projected products and costs."],
    ["presentation", "Presentations", "Share polished project updates."],
  ];

  function propertySetup() {
    return (
      workHead("Create A Property", "Keep every room, design, budget and presentation organized in one project.", state.newAddress.trim().length > 2 ? 2 : 1) +
      '<div class="stw-work">' +
      panel(
        "Property Details",
        field("Property Address", '<input id="stsAddr" type="text" placeholder="1420 Bayshore Boulevard, Tampa FL" value="' + esc(state.newAddress) + '">') +
          field("Property Nickname (Optional)", '<input id="stsNick" type="text" placeholder="Bayshore Flip" value="' + esc(state.newNickname) + '">') +
          field("Property Type", select("stsPType", ["Single Family", "Condo", "Townhome", "Multi Family", "Commercial"], state.newType)) +
          field("Client Or Project Name (Optional)", '<input id="stsPProject" type="text" placeholder="e.g. Pre Listing Refresh" value="' + esc(state.newProject) + '">') +
          field("Property Photo (Optional)", dropZone("JPG, PNG, HEIC, WEBP", "image-up", "Add A Cover Photo")),
        "stw-main",
      ) +
      panel(
        "What This Creates",
        '<ul class="stw-rows">' +
          CREATES.map(
            ([i, t, d]) =>
              '<li><i data-lucide="' + i + '"></i><div><b>' + t + "</b><span>" + d + "</span></div></li>",
          ).join("") +
          "</ul>" +
          foot("Create Property", state.newAddress.trim().length > 2),
        "stw-side",
      ) +
      "</div>"
    );
  }

  function setupHtml() {
    const body =
      state.method === "describe"
        ? describeSetup()
        : state.method === "property"
          ? propertySetup()
          : uploadSetup();
    return '<div class="stw">' + body + "</div>" + (state.samples ? samplesHtml() : "");
  }


  function samplesHtml() {
    return (
      '<div class="sts-modal" role="dialog" aria-modal="true" aria-label="Choose A Sample Space">' +
      '<div class="sts-scrim" data-sts="closesamples"></div>' +
      '<div class="sts-samples"><div class="sts-samples-h"><b>Choose A Sample Space</b>' +
      '<button class="sts-link" data-sts="closesamples">Cancel</button></div>' +
      '<div class="sts-grid">' +
      SAMPLE_KEYS.map(
        (s) =>
          '<button class="sts-sample" data-sample="' + s.key + '"><span class="sts-tag">Sample</span><img src="' +
          s.photo + '" alt="' + esc(s.alt) + '"><b>' + esc(s.name) + " (Sample)</b></button>",
      ).join("") +
      "</div>" +
      '<p class="sts-note">Samples stay labelled as samples and are never saved to your account unless you choose to save one.</p>' +
      "</div></div>"
    );
  }

  /* ---------- starting selector ---------- */

  /* Studio means designing a space. The listing video builder is a peer nav
     item, not a card in here. */



  function recentHtml() {
    const list = (ctx.getRecent ? ctx.getRecent() : []).slice(0, 4);
    if (!list.length) return "";
    return (
      '<section class="stw-recent">' +
      '<div class="stw-sec-h"><h3>Continue Where You Left Off</h3><span>Your Most Recent Work</span></div>' +
      '<div class="stw-recent-g">' +
      list
        .map(
          (r) =>
            '<article class="card dg-card"><div class="dg-thumb">' +
            '<img data-photo="' + esc(r.path || "") + '" alt="' + esc(r.name) + '" style="width:100%;height:100%;object-fit:cover" hidden></div>' +
            '<div class="dg-body"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center">' +
            "<b style=\"font-size:.86rem\">" + esc(r.name) + "</b>" +
            (r.status ? '<span class="pill">' + esc(r.status) + "</span>" : "") +
            "</div>" +
            '<div class="mono" style="font-size:.7rem;color:var(--mute-2);margin-top:5px">' + esc(r.sub || "") + "</div>" +
            '<div class="dg-acts"><button class="btn btn-ghost btn-xs" style="flex:1" data-recent="' + esc(r.id) + '">Open</button></div>' +
            "</div></article>",
        )
        .join("") +
      "</div></section>"
    );
  }

  function chooserHtml() {
    return (
      '<div class="stw">' +
      '<header class="stw-head">' +
      '<div class="stw-head-l">' +
      '<span class="stw-eyebrow">Studio</span>' +
      '<div class="stw-title"><h2>How Would You Like To Start?</h2></div>' +
      "<p>Choose a path below. You can switch between them anytime.</p>" +
      "</div></header>" +
      '<div class="stw-rule"></div>' +
      styleBanner() +
      '<div class="stw-doorwrap' + (state.door ? "" : " center") + '">' +
      '<div class="stw-doors">' +
      '<button type="button" class="stw-door' + (state.door === "design" ? " on" : "") + '" data-sts="door-design">' +
      '<i data-lucide="wand-sparkles"></i>' +
      "<b>Design A Space</b>" +
      "<span>Restyle, stage or plan a room from a photo, sketch or floor plan.</span>" +
      '<span class="stw-door-cta">Start Designing<i data-lucide="arrow-right"></i></span>' +
      "</button>" +
      '<button type="button" class="stw-door' + (state.door === "video" ? " on" : "") + '" data-sts="door-video">' +
      '<i data-lucide="clapperboard"></i>' +
      "<b>Make A Video</b>" +
      "<span>Turn property photos into a listing video.</span>" +
      '<span class="stw-door-cta">Start A Video<i data-lucide="arrow-right"></i></span>' +
      "</button>" +
      "</div>" +
      (state.door
        ? ""
        : '<p class="stw-secondary stw-doorfoot">No Photo Yet? ' +
          '<button class="stw-samplelink" data-sts="sample">Try A Sample Space</button></p>') +
      "</div>" +

      (state.door
        ? '<div class="stw-source"><div class="stw-sec-h"><h3>' +
          (state.door === "design" ? "Choose Your Starting Point" : "Where Are Your Property Photos?") +
          "</h3></div>" +
          '<div id="stSource"></div>' +
          (state.door === "design"
            ? '<p class="stw-secondary">No Photo Yet? ' +
              '<button class="stw-seclink" data-sts="c-describe">Describe An Idea Instead</button></p>'
            : "") +
          "</div>"
        : "") +

      recentHtml() +
      "</div>" +
      (state.samples ? samplesHtml() : "")
    );
  }

  /* ---------- render + wiring ---------- */

  let host: HTMLElement | null = null;

  function clearHost() {
    picker?.destroy();
    picker = null;
    host?.remove();
    host = null;
    view!.classList.remove("sts-choosing");
  }

  function render() {
    if (!host) {
      host = document.createElement("div");
      host.id = "stChooser";
      host.className = "stc";
      view!.insertBefore(host, view!.firstChild);
      host.addEventListener("click", onClick);
    }
    view!.classList.add("sts-choosing");
    host.innerHTML = state.phase === "choose" ? chooserHtml() : setupHtml();
    try {
      lucide.createIcons();
    } catch {
      /* icons are cosmetic */
    }
    wire();
    mountPicker();
    hydrateRecent();
  }

  /** The one shared source picker, configured for the design context. */
  let picker: { destroy: () => void } | null = null;
  function mountPicker() {
    picker?.destroy();
    picker = null;
    const slot = document.getElementById("stSource");
    if (!slot) return;
    const isVideo = state.door === "video";
    picker = mountSourcePicker(slot, {
      context: isVideo ? "video" : "design",
      esc,
      lucide,
      showAlert: ctx.showAlert,
      properties: () =>
        (ctx.getProperties ? ctx.getProperties() : []).map((p) => ({
          address: p.address,
          meta: (() => {
            const n =
              (p.projects || []).reduce(
                (t, pr) => t + (((pr as any).rooms || []) as any[]).filter((r: any) => !!r.before_path).length,
                0,
              ) || Number((p as any).asset_count || 0);
            return n === 1 ? "1 Photo" : n + " Photos";
          })(),
        })),
      onPick: (picked) => {
        const first = picked[0];
        if (!first) return;
        if (isVideo) {
          try {
            (window as any).rdListingVideo?.({ from: "studio", files: picked.map((p) => p.file) });
          } catch (_) {
            ctx.go("studio");
          }
          return;
        }
        /* Many photos go to the staging review grid; one photo stays inline. */
        if (picked.length > 1) {
          openStagingReview({ files: picked.map((p) => p.file), address: state.property || state.address || "" });
          return;
        }
        openSetup("upload");
        takeFile(first.file);
      },
      onProperty: (address) => {
        if (isVideo) {
          try {
            (window as any).rdListingVideo?.({ from: "studio", address });
          } catch (_) {
            ctx.go("studio");
          }
          return;
        }
        state.newAddress = address;
        state.property = address;
        state.address = address;
        openSetup("property");
      },
      onSample: () => {
        state.samples = true;
        render();
      },
    });

  }

  function hydrateRecent() {
    if (!host || !ctx.resolvePhoto) return;
    host.querySelectorAll<HTMLImageElement>("[data-photo]").forEach(async (img) => {
      const path = img.getAttribute("data-photo");
      if (!path) return;
      const url = await ctx.resolvePhoto!(path);
      if (url) {
        img.src = url;
        img.hidden = false;
      }
    });
  }

  function wire() {
    const drop = document.getElementById("stsDrop");
    if (drop) {
      ["dragenter", "dragover"].forEach((e) =>
        drop.addEventListener(e, (ev) => {
          ev.preventDefault();
          drop.classList.add("over");
        }),
      );
      ["dragleave", "drop"].forEach((e) =>
        drop.addEventListener(e, (ev) => {
          ev.preventDefault();
          drop.classList.remove("over");
        }),
      );
      drop.addEventListener("drop", (ev: any) => {
        const f = ev.dataTransfer?.files?.[0];
        if (f) takeFile(f);
      });
    }

    bindVal("stsRoom", (v) => {
      state.room = v;
      state.roomDetected = false;
      render();
    });
    bindVal("stsRoomOther", (v) => {
      state.roomOther = v;
      syncPrimary();
    });
    bindVal("stsStyle", (v) => (state.style = v));
    bindVal("stsBudget", (v) => (state.budget = v));
    bindVal("stsMood", (v) => (state.mood = v));
    bindVal("stsInput", (v) => (state.inputType = v));
    bindVal("stsDims", (v) => (state.dims = v));
    bindVal("stsFeatures", (v) => (state.features = v));
    bindVal("stsPType", (v) => (state.newType = v));
    bindVal("stsNick", (v) => (state.newNickname = v));
    bindVal("stsPProject", (v) => (state.newProject = v));
    bindVal("stsPropSel", (v) => {
      state.property = v;
      if (v) state.address = v;
    });
    bindVal("stsAddr", (v) => (state.address = cleanAddressText(v)));
    bindVal("stsAddr", (v) => {
      state.newAddress = v;
      syncPrimary();
    });
    bindVal("stsType", (v) => {
      const t = v as SourceType;
      state.detected = { sourceType: t, confidence: 1, suggestedWorkflow: WORKFLOW_BY_TYPE[t] };
      state.pickType = false;
      applyDetection(t);
      render();
    });



    const ta = document.getElementById("stsPrompt") as HTMLTextAreaElement | null;
    if (ta) {
      ta.addEventListener("input", () => {
        state.prompt = ta.value;
        syncPrimary();
      });
    }

    const meta = document.getElementById("stsFileMeta");
    if (meta && state.filePreview) {
      const i = new Image();
      i.onload = () => {
        meta.textContent = i.naturalWidth + " x " + i.naturalHeight + " px · Nothing is generated until you continue.";
      };
      i.src = state.filePreview;
    }

    document.getElementById("stsGo")?.addEventListener("click", primaryAction);
  }

  function syncPrimary() {
    const b = document.getElementById("stsGo") as HTMLButtonElement | null;
    if (b) b.disabled = !canContinue() || state.busy;
  }

  function bindVal(id: string, set: (v: string) => void) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;
    el.addEventListener("change", () => set(el.value));
    el.addEventListener("input", () => set(el.value));
  }

  function canContinue() {
    if (state.method === "upload") {
      if (!state.file || state.detecting) return false;
      if (outOfFree()) return false;
      if (!roomValue()) return false;
      const t = state.detected?.sourceType;
      return !!t && t !== "uncertain" && t !== "unsupported";
    }
    if (state.method === "describe") return state.prompt.trim().length >= 12;
    if (state.method === "property") return state.newAddress.trim().length > 2;
    return false;
  }


  function goListingVideo() {
    try {
      ctx.track?.("studio_start_video", { from: "studio" });
    } catch (_) {}
    // Unified Create A Listing Video workflow (same one Media and Properties open).
    const open = (window as any).rdListingVideo;
    if (typeof open === "function") {
      open({ from: "studio" });
      return;
    }
    try {
      (window as any).__rdGo?.("lvideo");
    } catch (_) {
      window.location.href = "/app/media/video/new?source=listing";
    }
  }

  function onClick(e: Event) {
    const t = e.target as HTMLElement;
    const act = t.closest("[data-sts]") as HTMLElement | null;
    const chip = t.closest("[data-chip]") as HTMLElement | null;
    const sample = t.closest("[data-sample]") as HTMLElement | null;

    if (chip) {
      const name = chip.dataset["chip"]!;
      const val = chip.dataset["val"]!;
      if (name === "space") state.space = val;
      if (name === "goal") state.goal = val;
      if (name === "budget") state.budget = state.budget === val ? "" : val;
      render();
      return;
    }
    if (sample) {
      pickSample(sample.dataset["sample"]!);
      return;
    }
    const ex = t.closest("[data-ex]") as HTMLElement | null;
    if (ex) {
      state.prompt = ex.dataset["ex"] || "";
      render();
      const ta = document.getElementById("stsPrompt") as HTMLTextAreaElement | null;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
      return;
    }
    const rec = t.closest("[data-recent]") as HTMLElement | null;
    if (rec) {
      ctx.openRecent?.(rec.dataset["recent"]!);
      return;
    }
    if (!act) return;
    const k = act.dataset["sts"];
    if (k === "qualok") {
      state.flagsDismissed = true;
      render();
      return;
    }
    if (k === "rotate") {
      rotateFile();
      return;
    }
    if (k === "lvideo") {
      goListingVideo();
      return;
    }
    if (k === "changestyle") {
      clearStudioStyle();
      styleChoice = null;
      ctx.go("explore");
      return;
    }
    if (k === "changetype") {
      state.pickType = !state.pickType;
      render();
      return;
    }
    if (k === "door-design") {
      state.door = "design";
      render();
      return;
    }
    if (k === "door-video") {
      ctx.track("studio_start_method", { method: "video" });
      state.door = "video";
      render();
      return;
    }
    if (k === "video-open") {
      try {
        (window as any).rdListingVideo?.({ from: "studio" });
      } catch (_) {
        ctx.go("studio");
      }
      return;
    }

    if (k === "c-upload") {
      openSetup("upload");
      browse();
    } else if (k === "c-describe") {
      openSetup("describe");
      document.getElementById("stsPrompt")?.focus();
    } else if (k === "c-property") {
      openSetup("property");
    } else if (k === "back") {
      state.phase = "choose";
      state.samples = false;
      render();
    } else if (k === "browse") {
      browse();
    } else if (k === "clearfile") {
      clearFile();
      render();
    } else if (k === "sample") {
      state.samples = true;
      render();
    } else if (k === "closesamples") {
      state.samples = false;
      render();
    } else if (k === "inspo") {
      inspoPick.click();
    } else if (k === "rminspo") {
      state.inspiration = null;
      render();
    }
  }

  function scrollTop() {
    try {
      const c = document.querySelector(".content") as HTMLElement | null;
      if (c) c.scrollTop = 0;
      window.scrollTo(0, 0);
    } catch (_) {}
  }

  function openSetup(m: Method) {
    state.method = m;
    state.phase = "setup";
    state.samples = false;
    ctx.track("studio_start_method", { method: m });
    render();
    scrollTop();
  }

  async function loadSource() {
    const f = state.file;
    if (!f) return;
    state.busy = true;
    syncPrimary();
    try {
      const url = await ctx.uploadPhoto(f);
      if (state.property || state.address)
        ctx.setContext({ address: state.property || state.address, room: roomValue() });
      ctx.setSource("user_upload", url, "Your uploaded source", {
        caption: "Set your direction, then press Generate. Nothing has been generated yet.",
      });
      applySetupToStudio();
      clearFile();
      ctx.track("studio_source_loaded", {
        method: state.method,
        sourceType: state.detected?.sourceType || "uncertain",
        workflow: state.detected?.suggestedWorkflow || "manual_classification",
      });
    } catch (err: any) {
      ctx.showAlert("Could not load that file. " + ((err && err.message) || "Try another image."));
    } finally {
      state.busy = false;
      syncPrimary();
    }
  }

  /** Mirrors the start choices into the existing Studio setup controls. */
  function applySetupToStudio() {
    const sp = document.querySelector('#spChips .chip[data-sp="' + state.space + '"]') as HTMLElement | null;
    if (sp) sp.click();
    const room = document.getElementById("fRoom") as HTMLSelectElement | null;
    const rv = roomValue();
    if (room && rv) {
      if (!Array.from(room.options).some((o) => o.value === rv || o.text === rv)) {
        const opt = document.createElement("option");
        opt.textContent = rv;
        room.appendChild(opt);
      }
      room.value = rv;
      room.dispatchEvent(new Event("input", { bubbles: true }));
      room.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (styleChoice) applyStudioStyleToControls(styleChoice);
    else {
      const style = document.getElementById("fStyle") as HTMLSelectElement | null;
      if (style && Array.from(style.options).some((o) => o.text === state.style)) {
        style.value = state.style;
        style.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    const bandIdx = BUDGETS.indexOf(state.budget);
    const band = document.querySelector('.bchip[data-b="' + (bandIdx < 0 ? 1 : bandIdx) + '"]') as HTMLElement | null;
    if (band) band.click();
    const notes = document.getElementById("agentNote") as HTMLTextAreaElement | null;
    if (notes && !notes.value) {
      const extra = [state.accents ? "Accent colors: " + state.accents : "", state.notes].filter(Boolean).join(". ");
      if (extra) notes.value = extra;
    }
  }

  function pickSample(key: string) {
    const s = SAMPLE_KEYS.find((x) => x.key === key);
    if (!s || !s.photo) return;
    state.samples = false;
    state.space = s.space;
    state.room = s.room;
    state.roomDetected = true;
    ctx.setSource("intentional_sample", s.photo, s.alt, {
      caption: "Sample space. Nothing is saved to your account unless you choose to.",
      sample: true,
    });
    applySetupToStudio();
    ctx.track("sample_selected", { sample: key });
  }

  async function generateConcept() {
    if (state.prompt.trim().length < 12) return;
    state.busy = true;
    const btn = document.getElementById("stsGo") as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Generating Concept…";
    }
    try {
      const image = state.inspiration ? await ctx.fileToDataUrl(state.inspiration) : null;
      const r = await renderConcept({
        data: {
          prompt: state.prompt.trim(),
          space: state.space,
          room: roomValue(),
          dimensions: state.dims || null,
          style: state.style || null,
          mood: state.mood || null,
          budget: state.budget || null,
          features: state.features || null,
          image,
        },
      });
      ctx.track("concept_generated", { space: state.space });
      await ctx.showConcept(r.image, "Concept");
    } catch (err: any) {
      if (isPlanBlocked(err)) openUpgrade(err);
      else ctx.showAlert("Could not create that concept. " + ((err && err.message) || "Try again in a moment."));
      if (btn) {
        btn.textContent = "Generate Concept";
      }
    } finally {
      state.busy = false;
      syncPrimary();
    }
  }

  function primaryAction() {
    if (state.method === "describe") {
      generateConcept();
      return;
    }
    if (state.method === "property") {
      const addr = state.newAddress.trim();
      if (addr.length < 3) return;
      ctx.setContext({ address: addr, project: state.newProject.trim() || null, room: roomValue() });
      ctx.track("property_created_from_studio", {});
      state.attached = state.newNickname.trim() || addr;
      state.property = addr;
      state.newAddress = "";
      state.newNickname = "";
      state.newProject = "";
      openSetup("upload");
      return;
    }
    if (state.file) loadSource();
    else browse();
  }

  /* ---------- public API ---------- */

  let wasEmpty = true;

  function paint(empty: boolean) {
    if (!empty) {
      clearHost();
      wasEmpty = false;
      return;
    }
    if (!wasEmpty) {
      /* returning from an active editor (New Design) resets to the chooser */
      state.phase = "choose";
      state.samples = false;
      state.attached = "";
      state.property = "";
      clearFile();
      state.method = "upload";
    }
    wasEmpty = true;
    render();
  }

  function open(method?: string) {
    if (method === "design" || method === "video") {
      state.phase = "choose";
      state.door = method;
      render();
      return;
    }
    if (method === "sample") {
      state.samples = true;
      render();
    } else if (method === "describe" || method === "property") {
      openSetup(method as Method);
    } else if (method === "upload" || method === "sketch" || method === "space") {
      openSetup("upload");
      browse();
    } else {
      render();
    }
    const el = document.getElementById("stChooser");
    if (el) {
      el.classList.add("pulse");
      window.setTimeout(() => el.classList.remove("pulse"), 900);
      scrollTop();
    }
  }

  return { paint, open };
}
