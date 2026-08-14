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
  type SourceDetection,
  type SourceType,
} from "@/lib/source-detect.functions";

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
  getProperties: () => Array<{ address: string; projects: Array<{ name: string }> }>;
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

const SAMPLE_KEYS: Array<{ key: string; name: string; space: string; room: string; photo: string; alt: string }> = [];

const ROOMS = [
  "Living Room",
  "Kitchen",
  "Primary Bedroom",
  "Primary Bath",
  "Dining Room",
  "Home Office",
  "Entry",
  "Facade",
  "Backyard",
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
    room: "Living Room",
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
    /** Property attached after a create-property step. */
    attached: "",
    newAddress: "",
    newNickname: "",
    newType: "Single Family",
    newProject: "",
    /** "choose" shows the starting selector, "setup" the focused source setup. */
    phase: "choose" as "choose" | "setup",
  };

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
    render();
    if (state.method === "upload") runDetection(f);
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

  /** Maps a classification onto the setup fields that drive the workflow. */
  function applyDetection(type: SourceType) {
    if (type === "interior_photo") state.space = "interior";
    else if (type === "exterior_photo") {
      state.space = "exterior";
      state.room = "Facade";
    } else if (type === "landscape_photo") {
      state.space = "landscape";
      state.room = "Backyard";
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

  function propertyField() {
    const props = (ctx.getProperties() || []).slice(0, 40);
    if (!props.length) return "";
    const opts =
      '<option value="">No Property</option>' +
      props.map((p) => '<option value="' + esc(p.address) + '"' + (p.address === state.property ? " selected" : "") + ">" + esc(p.address) + "</option>").join("");
    return field("Add To A Property (Optional)", '<select id="stsPropSel">' + opts + "</select>");
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
        '<span id="stsFileMeta">Nothing generates and no credits are used until you continue.</span>' +
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
        field("Room Or Space Type", select("stsRoom", ROOMS, state.room)) +
        propertyField() +
        field("Approximate Dimensions (Optional)", '<input id="stsDims" type="text" placeholder="14 ft x 18 ft" value="' + esc(state.dims) + '">')
      : field("Space Type", chips("space", [["interior", "Interior"], ["exterior", "Exterior"], ["landscape", "Garden"]], state.space)) +
        field("Room Or Area Type", select("stsRoom", ROOMS, state.room)) +
        propertyField() +
        field("Project Name (Optional)", '<input id="stsPProject" type="text" placeholder="Pre Listing Refresh" value="' + esc(state.newProject) + '">');

    return (
      workHead(
        "Upload A Space Or Plan",
        "Add a photo, sketch, floor plan or concept drawing. We identify what it is for you.",
        state.file ? 2 : 1,
      ) +
      '<div class="stw-work">' +
      panel(
        "Your File",
        dropZone("JPG, PNG, HEIC, WEBP, PDF", "image-up", "Drop A Photo, Sketch Or Plan"),
        "stw-main",
      ) +
      panel(plan ? "Plan Details" : "Photo Details", details + foot("Continue", canContinue()), "stw-side") +
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
          '<p class="stw-help">The more detail you give about materials, colours and lighting, the closer the concept lands.</p>' +
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
          field("Room Or Space Type", select("stsRoom", ROOMS, state.room)) +
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
            "Uses 1 design credit",
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
          field("Client Or Project Name (Optional)", '<input id="stsPProject" type="text" placeholder="Pre Listing Refresh" value="' + esc(state.newProject) + '">') +
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

  const CARDS: Array<{ act: string; icon: string; title: string; desc: string; meta: string; btn: string }> = [
    {
      act: "c-upload",
      icon: "image-up",
      title: "Upload A Space Or Plan",
      desc: "Start with a photo, sketch, floor plan or concept drawing.",
      meta: "JPG · PNG · HEIC · WEBP · PDF",
      btn: "Upload A File",
    },
    {
      act: "c-describe",
      icon: "message-square-text",
      title: "Describe An Idea",
      desc: "Create a visual concept from a written description.",
      meta: "Text · Optional inspiration image",
      btn: "Describe An Idea",
    },
    {
      act: "c-property",
      icon: "map-pin",
      title: "Create A Property",
      desc: "Organize rooms, designs, budgets and presentations.",
      meta: "Multi-room project",
      btn: "Create A Property",
    },
    {
      act: "lvideo",
      icon: "clapperboard",
      title: "Create A Listing Video",
      desc: "Turn listing photos into a polished property video.",
      meta: "Photos · Motion · Branding",
      btn: "Create A Listing Video",
    },
  ];


  function recentHtml() {
    const list = (ctx.getRecent ? ctx.getRecent() : []).slice(0, 4);
    if (!list.length) return "";
    return (
      '<section class="stw-recent">' +
      '<div class="stw-sec-h"><h3>Continue Where You Left Off</h3><span>Your most recent work</span></div>' +
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
      '<span class="stw-eyebrow">Welcome To REAL DESIGNS</span>' +
      '<div class="stw-title"><h2>How Would You Like To Start?</h2></div>' +
      "<p>Upload a visual, describe an idea, organize a property or create a listing video.</p>" +
      "</div></header>" +
      '<div class="stw-rule"></div>' +
      '<div class="stw-tiles">' +
      CARDS.map(
        (c) =>
          '<button type="button" class="stw-tile" data-sts="' + c.act + '">' +
          '<i data-lucide="' + c.icon + '" class="stw-tile-ico"></i>' +
          "<h3>" + c.title + "</h3>" +
          "<p>" + c.desc + "</p>" +
          '<span class="stw-tile-meta">' + c.meta + "</span>" +
          '<span class="stw-tile-act">' + c.btn + '<i data-lucide="arrow-right"></i></span>' +
          "</button>",
      ).join("") +
      "</div>" +
      '<p class="stw-tilefoot">Not ready to upload? <button class="stw-samplelink" data-sts="sample">Try A Sample Space</button></p>' +
      recentHtml() +
      "</div>" +
      (state.samples ? samplesHtml() : "")
    );
  }


  /* ---------- render + wiring ---------- */

  let host: HTMLElement | null = null;

  function clearHost() {
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
    hydrateRecent();
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

    bindVal("stsRoom", (v) => (state.room = v));
    bindVal("stsStyle", (v) => (state.style = v));
    bindVal("stsBudget", (v) => (state.budget = v));
    bindVal("stsMood", (v) => (state.mood = v));
    bindVal("stsInput", (v) => (state.inputType = v));
    bindVal("stsDims", (v) => (state.dims = v));
    bindVal("stsFeatures", (v) => (state.features = v));
    bindVal("stsPType", (v) => (state.newType = v));
    bindVal("stsNick", (v) => (state.newNickname = v));
    bindVal("stsPProject", (v) => (state.newProject = v));
    bindVal("stsPropSel", (v) => (state.property = v));
    bindVal("stsAddr", (v) => {
      state.newAddress = v;
      syncPrimary();
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
      const t = state.detected?.sourceType;
      return !!t && t !== "uncertain" && t !== "unsupported";
    }
    if (state.method === "describe") return state.prompt.trim().length >= 12;
    if (state.method === "property") return state.newAddress.trim().length > 2;
    return false;
  }


  function goListingVideo() {
    try {
      (window as any).rdListingVideo({ from: "studio" });
    } catch (_) {}
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
    if (k === "rotate") {
      rotateFile();
      return;
    }
    if (k === "lvideo") {
      goListingVideo();
      return;
    }
    if (k === "changetype") {
      state.pickType = !state.pickType;
      render();
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

  function openSetup(m: Method) {
    state.method = m;
    state.phase = "setup";
    state.samples = false;
    ctx.track("studio_start_method", { method: m });
    render();
  }

  async function loadSource() {
    const f = state.file;
    if (!f) return;
    state.busy = true;
    syncPrimary();
    try {
      const url = await ctx.uploadPhoto(f);
      if (state.property) ctx.setContext({ address: state.property, room: state.room });
      ctx.setSource("user_upload", url, "Your uploaded source", {
        caption: "Set your direction, then press Generate. Nothing has been generated yet.",
      });
      applySetupToStudio();
      clearFile();
      ctx.track("studio_source_loaded", { method: state.method });
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
    if (room && Array.from(room.options).some((o) => o.value === state.room || o.text === state.room)) room.value = state.room;
    const style = document.getElementById("fStyle") as HTMLSelectElement | null;
    if (style && Array.from(style.options).some((o) => o.text === state.style)) style.value = state.style;
    const bandIdx = BUDGETS.indexOf(state.budget);
    const band = document.querySelector('.bchip[data-b="' + (bandIdx < 0 ? 1 : bandIdx) + '"]') as HTMLElement | null;
    if (band) band.click();
    const notes = document.getElementById("agentNote") as HTMLTextAreaElement | null;
    if (notes && !notes.value) {
      const extra = [state.accents ? "Accent colours: " + state.accents : "", state.notes].filter(Boolean).join(". ");
      if (extra) notes.value = extra;
    }
  }

  function pickSample(key: string) {
    const s = SAMPLE_KEYS.find((x) => x.key === key);
    if (!s || !s.photo) return;
    state.samples = false;
    state.space = s.space;
    state.room = s.room;
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
          room: state.room,
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
      ctx.showAlert("Could not create that concept. " + ((err && err.message) || "Try again in a moment."));
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
      ctx.setContext({ address: addr, project: state.newProject.trim() || null, room: state.room });
      ctx.track("property_created_from_studio", {});
      state.attached = state.newNickname.trim() || addr;
      state.property = addr;
      state.newAddress = "";
      state.newNickname = "";
      state.newProject = "";
      openSetup("space");
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
      state.method = "space";
    }
    wasEmpty = true;
    render();
  }

  function open(method?: string) {
    if (method === "sample") {
      state.samples = true;
      render();
    } else if (method === "describe" || method === "sketch" || method === "property" || method === "space") {
      openSetup(method as Method);
    } else if (method === "upload") {
      openSetup("space");
      browse();
    } else {
      render();
    }
    const el = document.getElementById("stChooser");
    if (el) {
      el.classList.add("pulse");
      window.setTimeout(() => el.classList.remove("pulse"), 900);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return { paint, open };
}
