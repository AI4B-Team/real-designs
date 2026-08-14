/**
 * Studio start experience.
 *
 * Owns everything the Studio shows while there is no source: the single
 * bordered upload canvas, the four starting methods in the right panel, the
 * text-first concept composer and the intentional sample picker.
 *
 * Rules this module enforces:
 *  - nothing is generated and no credit is spent until the user presses a
 *    Generate button,
 *  - no sample content is ever loaded automatically,
 *  - there is exactly one "Start a New Design" surface on the page.
 */

import { renderConcept } from "@/lib/concept-render.functions";

type Method = "space" | "sketch" | "describe" | "property";

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
  const canvasBodyEl = document.querySelector("#canvasCard .card-b") as HTMLElement | null;
  const rightEl = document.querySelector("#v-studio .right") as HTMLElement | null;
  if (!view || !canvasBodyEl || !rightEl) return { paint: () => {}, open: () => {} };
  const canvasBody: HTMLElement = canvasBodyEl;
  const right: HTMLElement = rightEl;


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
    method: "space" as Method,
    /** Chosen file, not uploaded yet. */
    file: null as File | null,
    fileName: "",
    space: "interior",
    room: "Living Room",
    goal: "Makeover",
    style: "Warm Minimal",
    budget: "Under $15K",
    accents: "",
    notes: "",
    inputType: "Hand Sketch",
    output: "Photorealistic Interior",
    dims: "",
    mood: "",
    features: "",
    prompt: "",
    inspiration: null as File | null,
    creating: false,
    samples: false,
    propertyMode: "" as "" | "pick" | "new",
    /** "choose" shows the single onboarding chooser; "work" shows the editor. */
    phase: "choose" as "choose" | "work",

    newAddress: "",
    newType: "Single Family",
    newProject: "",
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
    filePick.accept = state.method === "sketch" ? "image/*,application/pdf" : "image/*";
    filePick.click();
  }

  function takeFile(f: File) {
    state.file = f;
    state.fileName = f.name;
    render();
  }

  /* ---------- canvas ---------- */

  function canvasHtml() {
    const base = state.method === "describe" ? composerHtml() : state.file ? previewHtml() : dropHtml();
    return state.samples ? base + samplesHtml() : base;
  }

  function dropHtml() {
    return (
      '<div class="sts-drop" id="stsDrop">' +
      '<div class="sts-drop-in">' +
      "<h4>Start A New Design</h4>" +
      "<p>Upload a photo of your space, a sketch or floor plan, describe an idea, or open a property.</p>" +
      '<button class="btn btn-primary" data-sts="browse"><i data-lucide="image-up"></i>Upload A Space</button>' +
      '<div class="sts-links">' +
      '<button class="sts-link" data-sts="sketch"><i data-lucide="pen-line"></i>Upload A Sketch Or Plan</button>' +
      '<button class="sts-link" data-sts="describe"><i data-lucide="pencil-line"></i>Describe An Idea</button>' +
      '<button class="sts-link" data-sts="sample"><i data-lucide="image"></i>Try A Sample Space</button>' +
      "</div></div></div>"
    );
  }

  function previewHtml() {
    return (
      '<div class="sts-drop is-file" id="stsDrop"><div class="sts-drop-in">' +
      '<i data-lucide="file-image" class="sts-fi"></i>' +
      "<h4>" +
      esc(state.fileName) +
      "</h4>" +
      "<p>Ready To Load. Nothing generates and no credits are used until you press Generate.</p>" +
      '<div class="sts-row">' +
      '<button class="btn btn-primary btn-sm" data-sts="load"><i data-lucide="check"></i>Use This File</button>' +
      '<button class="btn btn-ghost btn-sm" data-sts="clearfile">Choose Another</button>' +
      "</div></div></div>"
    );
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
          '<button class="sts-sample" data-sample="' +
          s.key +
          '"><span class="sts-tag">Sample</span><img src="' +
          s.photo +
          '" alt="' +
          esc(s.alt) +
          '"><b>' +
          esc(s.name) +
          " (Sample)</b></button>",
      ).join("") +
      "</div>" +
      '<p class="sts-note">Samples stay labelled as samples and are never saved to your account unless you choose to save one.</p>' +
      "</div></div>"
    );
  }

  function composerHtml() {
    return (
      '<div class="sts-brief">' +
      "<h4>Describe An Idea</h4>" +
      "<p>Create an original design concept from a written description.</p>" +
      '<label class="sts-l" for="stsPrompt">Describe What You Want To Create</label>' +
      '<textarea id="stsPrompt" class="sts-ta" rows="7" placeholder="Create a warm modern living room with natural oak floors, a cream sectional, built-in shelving and soft indirect lighting.">' +
      esc(state.prompt) +
      "</textarea>" +
      '<div class="sts-row">' +
      '<button class="btn btn-primary" id="stsConcept"' +
      (state.prompt.trim().length < 12 ? " disabled" : "") +
      '><i data-lucide="arrow-right"></i>Generate Concept<span class="cost-chip mono">1</span></button>' +
      '<button class="sts-link" data-sts="inspo">' +
      (state.inspiration ? "Inspiration: " + esc(state.inspiration.name) : "Add An Inspiration Image") +
      "</button>" +
      (state.inspiration ? '<button class="sts-link" data-sts="rminspo">Remove</button>' : "") +
      "</div>" +
      '<p class="sts-note">Text-only designs are conceptual until connected to a real photo, sketch or floor plan.</p>' +
      "</div>"
    );
  }


  /* ---------- right panel ---------- */

  const TABS: Array<[Method, string, string]> = [
    ["space", "image", "Space"],
    ["sketch", "pen-line", "Sketch / Plan"],
    ["describe", "pencil-line", "Describe"],
    ["property", "map-pin", "Property"],
  ];

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
  function uploadBox(types: string) {
    return (
      '<div class="sts-up" id="stsUp">' +
      '<i data-lucide="upload"></i>' +
      "<b>" +
      (state.file ? esc(state.fileName) : "Drag And Drop A File") +
      "</b>" +
      '<button class="btn btn-dark btn-xs" data-sts="browse">Browse Files</button>' +
      '<span class="sts-types">Supported files: ' +
      types +
      "</span></div>"
    );
  }

  function panelBody() {
    if (state.method === "space") {
      /* progressive disclosure: no generation settings before a source exists */
      return (
        "<h4>Upload A Space</h4><p>Upload a photo of an interior, exterior or landscape.</p>" +
        uploadBox("JPG, PNG, HEIC, WEBP") +
        field("Space Type", chips("space", [["interior", "Interior"], ["exterior", "Exterior"], ["landscape", "Garden"]], state.space)) +
        (state.file
          ? field("Room Or Area Type", select("stsRoom", ROOMS, state.room)) +
            field("Project Goal", chips("goal", GOALS.map((g) => [g, g] as [string, string]), state.goal)) +
            field("Design Style", select("stsStyle", STYLES, state.style)) +
            field("Budget Range", select("stsBudget", BUDGETS, state.budget)) +
            field("Accent Colors (Optional)", '<input id="stsAccents" type="text" placeholder="Warm brass, deep green" value="' + esc(state.accents) + '">') +
            field("Additional Direction (Optional)", '<textarea id="stsNotes" rows="3" placeholder="Keep the fireplace, replace the cabinets">' + esc(state.notes) + "</textarea>")
          : "")
      );
    }
    if (state.method === "sketch") {
      return (
        "<h4>Upload A Sketch Or Plan</h4><p>Turn a sketch, floor plan or concept drawing into a realistic visualization.</p>" +
        uploadBox("JPG, PNG, HEIC, WEBP, PDF") +
        field("Input Type", select("stsInput", ["Hand Sketch", "Floor Plan", "Elevation", "Concept Drawing"], state.inputType)) +
        (state.file
          ? field("Desired Output", select("stsOutput", ["Photorealistic Interior", "Photorealistic Exterior", "Furnished Floor Plan", "3D Concept"], state.output)) +
            field("Approximate Dimensions (Optional)", '<input id="stsDims" type="text" placeholder="14 ft x 18 ft" value="' + esc(state.dims) + '">') +
            field("Design Style", select("stsStyle", STYLES, state.style)) +
            field("Budget Range", select("stsBudget", BUDGETS, state.budget)) +
            field("Additional Direction (Optional)", '<textarea id="stsNotes" rows="3" placeholder="Open shelving, oak floors">' + esc(state.notes) + "</textarea>")
          : "")
      );
    }

    if (state.method === "describe") {
      return (
        "<h4>Describe An Idea</h4><p>Create an original design concept from a written description.</p>" +
        field("What Are You Creating?", chips("space", [["interior", "Interior"], ["exterior", "Exterior"], ["landscape", "Garden"]], state.space)) +
        field("Room Or Space Type", select("stsRoom", ROOMS, state.room)) +
        field("Approximate Dimensions (Optional)", '<input id="stsDims" type="text" placeholder="14 ft x 18 ft" value="' + esc(state.dims) + '">') +
        field("Design Style", select("stsStyle", STYLES, state.style)) +
        field("Mood", select("stsMood", ["", ...MOODS], state.mood)) +
        field("Budget Range", select("stsBudget", BUDGETS, state.budget)) +
        field("Must-Have Features (Optional)", '<textarea id="stsFeatures" rows="3" placeholder="Built-in shelving, durable rug, reading corner">' + esc(state.features) + "</textarea>")
      );
    }
    const props = (ctx.getProperties() || []).slice(0, 30);
    if (state.propertyMode === "new") {
      return (
        "<h4>Create New Property</h4><p>Only the essentials now. You can add rooms and details later.</p>" +
        field("Property Name Or Address", '<input id="stsAddr" type="text" placeholder="1420 Bayshore Boulevard, Tampa FL" value="' + esc(state.newAddress) + '">') +
        field("Property Type", select("stsPType", ["Single Family", "Condo", "Townhome", "Multi Family", "Commercial"], state.newType)) +
        field("Project Name (Optional)", '<input id="stsPProject" type="text" placeholder="Pre Listing Refresh" value="' + esc(state.newProject) + '">') +
        '<div class="sts-row"><button class="btn btn-ghost btn-sm" data-sts="propback">Back</button></div>'
      );
    }
    if (state.propertyMode === "pick") {
      return (
        "<h4>Select Existing Property</h4><p>Pick the address this design belongs to.</p>" +
        (props.length
          ? '<div class="sts-props">' +
            props
              .map(
                (p, i) =>
                  '<button class="sts-prop" data-prop="' + i + '"><b>' + esc(p.address) + "</b><span>" + (p.projects?.length || 0) + " project" + ((p.projects?.length || 0) === 1 ? "" : "s") + "</span></button>",
              )
              .join("") +
            "</div>"
          : '<p class="sts-note">No properties yet. Create one to organize rooms under an address.</p>') +
        '<div class="sts-row"><button class="btn btn-ghost btn-sm" data-sts="propback">Back</button></div>'
      );
    }
    return (
      "<h4>Start With A Property</h4><p>Open an existing property or create one to organize multiple rooms and designs.</p>" +
      '<div class="sts-row col">' +
      '<button class="btn btn-dark btn-sm" data-sts="proppick"><i data-lucide="list"></i>Select Existing Property</button>' +
      '<button class="btn btn-ghost btn-sm" data-sts="propnew"><i data-lucide="plus"></i>Create New Property</button>' +
      "</div>"
    );
  }

  function canGenerate() {
    if (state.method === "space" || state.method === "sketch") return !!state.file;
    if (state.method === "describe") return state.prompt.trim().length >= 12;
    if (state.method === "property") return state.propertyMode === "new" ? state.newAddress.trim().length > 2 : false;
    return false;
  }

  function primaryLabel() {
    if (state.method === "describe") return "Generate Concept";
    if (state.method === "property") return "Continue";
    return "Load Source";
  }

  function panelHtml() {
    return (
      '<div class="card sts-panel" id="stStartPanel">' +
      '<div class="sts-tabs" role="tablist" aria-label="Starting method">' +
      TABS.map(
        ([k, icon, label]) =>
          '<button role="tab" aria-selected="' +
          (state.method === k) +
          '" class="sts-tab' +
          (state.method === k ? " on" : "") +
          '" data-method="' +
          k +
          '" title="' +
          label +
          '"><i data-lucide="' +
          icon +
          '"></i><span>' +
          label +
          "</span></button>",
      ).join("") +
      "</div>" +
      '<div class="card-b sts-body">' +
      panelBody() +
      "</div>" +
      '<div class="sts-foot"><button class="btn btn-primary btn-block" id="stsGo"' +
      (canGenerate() ? "" : " disabled") +
      ">" +
      primaryLabel() +
      (state.method === "describe" ? '<span class="cost-chip mono">1</span>' : "") +
      "</button></div>" +
      "</div>"
    );
  }

  /* ---------- onboarding chooser (single empty state) ---------- */

  const CARDS: Array<{ act: string; icon: string; title: string; desc: string; meta: string; btn: string }> = [
    {
      act: "c-space",
      icon: "image-up",
      title: "Upload A Space",
      desc: "Start with a photo of an interior, exterior or landscape.",
      meta: "JPG · PNG · HEIC · WEBP",
      btn: "Upload A Photo",
    },
    {
      act: "c-sketch",
      icon: "pencil-ruler",
      title: "Upload A Sketch Or Plan",
      desc: "Turn a hand sketch, floor plan or concept drawing into a visual design.",
      meta: "JPG · PNG · HEIC · WEBP · PDF",
      btn: "Upload A Sketch Or Plan",
    },
    {
      act: "c-describe",
      icon: "message-square-text",
      title: "Describe An Idea",
      desc: "Start from a written idea when you do not have a photo, sketch or plan.",
      meta: "Describe the room, exterior, landscape or concept you want to create.",
      btn: "Describe An Idea",
    },
    {
      act: "c-property",
      icon: "map-pin",
      title: "Start With A Property",
      desc: "Create a property first and organize multiple rooms, angles, versions and project decisions together.",
      meta: "Rooms, designs, budgets and presentations in one place.",
      btn: "Create A Property",
    },
  ];

  function chooserHtml() {
    return (
      '<div class="stc-head">' +
      '<span class="stc-eyebrow">Welcome To REAL DESIGNS</span>' +
      "<h2>What Would You Like To Create?</h2>" +
      "<p>Start with a photo, sketch or floor plan, describe an idea, or organize everything under a property.</p>" +
      "</div>" +
      '<div class="stc-grid">' +
      CARDS.map(
        (c) =>
          '<div class="stc-card">' +
          '<i data-lucide="' + c.icon + '" class="stc-ico"></i>' +
          "<h3>" + esc(c.title) + "</h3>" +
          "<p>" + esc(c.desc) + "</p>" +
          '<span class="stc-meta">' + esc(c.meta) + "</span>" +
          '<button class="btn btn-primary btn-sm stc-btn" data-sts="' + c.act + '">' + esc(c.btn) + "</button>" +
          "</div>",
      ).join("") +
      "</div>" +
      '<p class="stc-foot">Not ready to upload? <button class="stc-samplelink" data-sts="sample">Try A Sample Space</button></p>' +
      (state.samples ? samplesHtml() : "")
    );
  }

  /* ---------- render + wiring ---------- */

  let host: HTMLElement | null = null;
  let panelHost: HTMLElement | null = null;
  let chooser: HTMLElement | null = null;

  function clearWorkHosts() {
    host?.remove();
    panelHost?.remove();
    host = null;
    panelHost = null;
  }

  function clearChooser() {
    chooser?.remove();
    chooser = null;
    view!.classList.remove("sts-choosing");
  }

  function render() {
    if (state.phase === "choose") {
      clearWorkHosts();
      if (!chooser) {
        chooser = document.createElement("div");
        chooser.id = "stChooser";
        chooser.className = "stc";
        view!.insertBefore(chooser, view!.firstChild);
        chooser.addEventListener("click", onClick);
      }
      view!.classList.add("sts-choosing");
      chooser.innerHTML = chooserHtml();
      try {
        lucide.createIcons();
      } catch {
        /* icons are cosmetic */
      }
      return;
    }
    clearChooser();
    if (!host) {
      host = document.createElement("div");
      host.id = "stStart";
      host.className = "sts";
      canvasBody.insertBefore(host, canvasBody.firstChild);
      host.addEventListener("click", onClick);
    }
    if (!panelHost) {
      panelHost = document.createElement("div");
      panelHost.id = "stStartRight";
      panelHost.className = "sts-right";
      right.insertBefore(panelHost, right.firstChild);
      panelHost.addEventListener("click", onClick);
    }
    host.innerHTML = canvasHtml();
    panelHost.innerHTML = panelHtml();
    try {
      lucide.createIcons();
    } catch {
      /* icons are cosmetic */
    }
    wire();
  }


  function wire() {


    const drop = document.getElementById("stsDrop") || document.getElementById("stsUp");
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
    bindVal("stsOutput", (v) => (state.output = v));
    bindVal("stsDims", (v) => (state.dims = v));
    bindVal("stsAccents", (v) => (state.accents = v));
    bindVal("stsNotes", (v) => (state.notes = v));
    bindVal("stsFeatures", (v) => (state.features = v));
    bindVal("stsPType", (v) => (state.newType = v));
    bindVal("stsPProject", (v) => (state.newProject = v));
    bindVal("stsAddr", (v) => {
      state.newAddress = v;
      const go = document.getElementById("stsGo") as HTMLButtonElement | null;
      if (go) go.disabled = !canGenerate();
    });

    const ta = document.getElementById("stsPrompt") as HTMLTextAreaElement | null;
    if (ta) {
      ta.addEventListener("input", () => {
        state.prompt = ta.value;
        const ok = canGenerate();
        const a = document.getElementById("stsConcept") as HTMLButtonElement | null;
        const b = document.getElementById("stsGo") as HTMLButtonElement | null;
        if (a) a.disabled = !ok;
        if (b) b.disabled = !ok;
      });
    }

    document.getElementById("stsConcept")?.addEventListener("click", generateConcept);
    document.getElementById("stsGo")?.addEventListener("click", primaryAction);
  }

  function bindVal(id: string, set: (v: string) => void) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;
    el.addEventListener("change", () => set(el.value));
    el.addEventListener("input", () => set(el.value));
  }

  function onClick(e: Event) {
    const t = e.target as HTMLElement;
    const tab = t.closest("[data-method]") as HTMLElement | null;
    const act = t.closest("[data-sts]") as HTMLElement | null;
    const chip = t.closest("[data-chip]") as HTMLElement | null;
    const sample = t.closest("[data-sample]") as HTMLElement | null;
    const prop = t.closest("[data-prop]") as HTMLElement | null;

    if (tab) {
      setMethod(tab.dataset["method"] as Method);
    } else if (chip) {
      const name = chip.dataset["chip"]!;
      const val = chip.dataset["val"]!;
      if (name === "space") state.space = val;
      if (name === "goal") state.goal = val;
      render();
    } else if (sample) {
      pickSample(sample.dataset["sample"]!);
    } else if (prop) {
      const p = ctx.getProperties()[+prop.dataset["prop"]!];
      if (p) {
        ctx.setContext({ address: p.address, project: p.projects?.[0]?.name || null, room: state.room });
        state.propertyMode = "";
        setMethod("space");
        return;
      }
    } else if (act) {
      const k = act.dataset["sts"];
      if (k === "browse") {
        if (state.method !== "space" && state.method !== "sketch") setMethod("space");
        browse();
      } else if (k === "sketch") setMethod("sketch");
      else if (k === "describe") {
        setMethod("describe");
        const ta = document.getElementById("stsPrompt") as HTMLTextAreaElement | null;
        if (ta) ta.focus();
      } else if (k === "sample") {
        state.samples = true;
        render();
      } else if (k === "closesamples") {
        state.samples = false;
        render();
      } else if (k === "clearfile") {
        state.file = null;
        state.fileName = "";
        render();
      } else if (k === "load") loadSource();
      else if (k === "inspo") inspoPick.click();
      else if (k === "rminspo") {
        state.inspiration = null;
        render();
      } else if (k === "proppick") {
        state.propertyMode = "pick";
        render();
      } else if (k === "propnew") {
        state.propertyMode = "new";
        render();
      } else if (k === "propback") {
        state.propertyMode = "";
        render();
      }
    }
  }


  function setMethod(m: Method) {
    state.method = m;
    state.samples = false;
    if (m !== "property") state.propertyMode = "";
    ctx.track("studio_start_method", { method: m });
    render();
  }

  async function loadSource() {
    const f = state.file;
    if (!f) return;
    const go = document.getElementById("stsGo") as HTMLButtonElement | null;
    if (go) go.disabled = true;
    try {
      const url = await ctx.uploadPhoto(f);
      ctx.setSource(state.method === "sketch" ? "user_upload" : "user_upload", url, "Your uploaded source", {
        caption: "Set your direction on the right, then press Generate. Nothing has been generated yet.",
      });
      applySetupToStudio();
      state.file = null;
      state.fileName = "";
      ctx.track("studio_source_loaded", { method: state.method });
    } catch (err: any) {
      ctx.showAlert("Could not load that file. " + ((err && err.message) || "Try another image."));
      if (go) go.disabled = false;
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
    const btn = document.getElementById("stsConcept") as HTMLButtonElement | null;
    if (state.prompt.trim().length < 12) return;
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
        btn.disabled = false;
        btn.textContent = "Generate Concept";
      }
    }
  }

  function primaryAction() {
    if (state.method === "describe") {
      generateConcept();
      return;
    }
    if (state.method === "property") {
      if (state.propertyMode === "new" && state.newAddress.trim().length > 2) {
        ctx.setContext({ address: state.newAddress.trim(), project: state.newProject.trim() || null, room: state.room });
        state.propertyMode = "";
        setMethod("space");
      }
      return;
    }
    if (state.file) loadSource();
    else browse();
  }

  /* ---------- public API ---------- */

  let wasEmpty = true;

  function paint(empty: boolean) {
    if (!empty) {
      clearWorkHosts();
      clearChooser();
      wasEmpty = false;
      return;
    }
    if (!wasEmpty) {
      /* returning from an active editor (New Design) resets to the chooser */
      state.phase = "choose";
      state.samples = false;
      state.file = null;
      state.fileName = "";
      state.propertyMode = "";
      state.method = "space";
    }
    wasEmpty = true;
    render();
  }

  function open(method?: string) {
    if (method === "sample") {
      state.samples = true;
    } else if (method === "describe" || method === "sketch" || method === "property" || method === "space") {
      state.method = method as Method;
      state.samples = false;
      state.phase = "work";
      if (method === "property") state.propertyMode = "new";
    } else if (method === "upload") {
      state.method = "space";
      state.phase = "work";
    }
    render();
    if (method === "upload") browse();
    const el = document.getElementById("stsDrop") || document.getElementById("stStart") || document.getElementById("stChooser");
    if (el) {
      el.classList.add("pulse");
      window.setTimeout(() => el.classList.remove("pulse"), 900);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return { paint, open };
}

