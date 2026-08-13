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
  const canvasBody = document.querySelector("#canvasCard .card-b") as HTMLElement | null;
  const right = document.querySelector("#v-studio .right") as HTMLElement | null;
  if (!view || !canvasBody || !right) return { paint: () => {}, open: () => {} };

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
    if (state.samples) return samplesHtml();
    if (state.method === "describe") return composerHtml();
    if (state.file) return previewHtml();
    return dropHtml();
  }

  function dropHtml() {
    return (
      '<div class="sts-drop" id="stsDrop">' +
      '<div class="sts-drop-in">' +
      "<h4>Start a New Design</h4>" +
      "<p>Upload a photo of your space, sketch or floor plan, describe an idea, or open a saved project.</p>" +
      '<button class="btn btn-primary" data-sts="browse"><i data-lucide="image-up"></i>Upload a Space</button>' +
      '<div class="sts-links">' +
      '<button class="sts-link" data-sts="sketch">Upload a Sketch or Plan</button>' +
      '<button class="sts-link" data-sts="describe">Describe an Idea</button>' +
      '<button class="sts-link" data-sts="sample">Try a Sample Space</button>' +
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
      "<p>Ready to load. Nothing generates and no credits are used until you press Generate.</p>" +
      '<div class="sts-row">' +
      '<button class="btn btn-primary btn-sm" data-sts="load"><i data-lucide="check"></i>Use This File</button>' +
      '<button class="btn btn-ghost btn-sm" data-sts="clearfile">Choose Another</button>' +
      "</div></div></div>"
    );
  }

  function samplesHtml() {
    return (
      '<div class="sts-samples"><div class="sts-samples-h"><b>Choose a Sample Space</b>' +
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
          "</b></button>",
      ).join("") +
      "</div>" +
      '<p class="sts-note">Samples stay labelled as samples and are never added to your account unless you save one as a project.</p>' +
      "</div>"
    );
  }

  function composerHtml() {
    return (
      '<div class="sts-brief">' +
      "<h4>Describe an Idea</h4>" +
      "<p>Create an original room, exterior, landscape, or design concept from a written description.</p>" +
      '<label class="sts-l" for="stsPrompt">Describe what you want to create</label>' +
      '<textarea id="stsPrompt" class="sts-ta" rows="7" placeholder="Create a warm modern living room with natural oak floors, an oversized cream sectional, built-in shelving, soft indirect lighting and durable finishes for a family with children. Keep the total furnishing and finish budget under $20,000.">' +
      esc(state.prompt) +
      "</textarea>" +
      '<div class="sts-row">' +
      '<button class="btn btn-primary" id="stsConcept"' +
      (state.prompt.trim().length < 12 ? " disabled" : "") +
      '><i data-lucide="arrow-right"></i>Generate Concept<span class="cost-chip mono">1</span></button>' +
      '<button class="sts-link" data-sts="inspo">' +
      (state.inspiration ? "Inspiration: " + esc(state.inspiration.name) : "Add an Inspiration Image") +
      "</button>" +
      (state.inspiration ? '<button class="sts-link" data-sts="rminspo">Remove</button>' : "") +
      "</div>" +
      '<p class="sts-note">Text-only designs are original concepts. Without a photo, sketch or floor plan, the architecture and dimensions are conceptual.</p>' +
      "</div>"
    );
  }

  /* ---------- right panel ---------- */

  const TABS: Array<[Method, string, string]> = [
    ["space", "image", "Space"],
    ["sketch", "pen-line", "Sketch or Plan"],
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
      (state.file ? esc(state.fileName) : "Drag and drop a file") +
      "</b>" +
      '<button class="btn btn-dark btn-xs" data-sts="browse">Browse Files</button>' +
      '<span class="sts-types">Supported files: ' +
      types +
      "</span></div>"
    );
  }

  function panelBody() {
    if (state.method === "space") {
      return (
        "<h4>Upload a Space</h4><p>Upload a photo of an interior, exterior, or landscape.</p>" +
        uploadBox("JPG, PNG, HEIC, WEBP") +
        field("Space Type", chips("space", [["interior", "Interior"], ["exterior", "Exterior"], ["landscape", "Landscape"]], state.space)) +
        field("Room or Area Type", select("stsRoom", ROOMS, state.room)) +
        field("Project Goal", chips("goal", GOALS.map((g) => [g, g] as [string, string]), state.goal)) +
        field("Design Style", select("stsStyle", STYLES, state.style)) +
        field("Budget Range", select("stsBudget", BUDGETS, state.budget)) +
        field("Accent Colors (Optional)", '<input id="stsAccents" type="text" placeholder="Warm brass, deep green" value="' + esc(state.accents) + '">') +
        field("Additional Direction (Optional)", '<textarea id="stsNotes" rows="3" placeholder="Keep the fireplace, replace the cabinets">' + esc(state.notes) + "</textarea>")
      );
    }
    if (state.method === "sketch") {
      return (
        "<h4>Upload a Sketch or Plan</h4><p>Turn a sketch, floor plan, or concept drawing into a realistic design visualization.</p>" +
        uploadBox("JPG, PNG, HEIC, WEBP, PDF") +
        field("Input Type", select("stsInput", ["Hand Sketch", "Floor Plan", "Elevation", "Concept Drawing"], state.inputType)) +
        field("Desired Output", select("stsOutput", ["Photorealistic Interior", "Photorealistic Exterior", "Furnished Floor Plan", "3D Concept"], state.output)) +
        field("Approximate Dimensions (Optional)", '<input id="stsDims" type="text" placeholder="14 ft x 18 ft" value="' + esc(state.dims) + '">') +
        field("Design Style", select("stsStyle", STYLES, state.style)) +
        field("Budget Range", select("stsBudget", BUDGETS, state.budget)) +
        field("Additional Direction (Optional)", '<textarea id="stsNotes" rows="3" placeholder="Open shelving, oak floors">' + esc(state.notes) + "</textarea>")
      );
    }
    if (state.method === "describe") {
      return (
        "<h4>Describe an Idea</h4><p>Create an original room, exterior, landscape, or design concept from a written description.</p>" +
        field("What Are You Creating?", chips("space", [["interior", "Interior"], ["exterior", "Exterior"], ["landscape", "Landscape"]], state.space)) +
        field("Room or Space Type", select("stsRoom", ROOMS, state.room)) +
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
        field("Property Name or Address", '<input id="stsAddr" type="text" placeholder="1420 Bayshore Boulevard, Tampa FL" value="' + esc(state.newAddress) + '">') +
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
      "<h4>Start With a Property</h4><p>Organize rooms, angles, designs, budgets and project decisions under one address.</p>" +
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

  /* ---------- render + wiring ---------- */

  let host: HTMLElement | null = null;
  let panelHost: HTMLElement | null = null;

  function render() {
    if (!host) {
      host = document.createElement("div");
      host.id = "stStart";
      host.className = "sts";
      canvasBody.insertBefore(host, canvasBody.firstChild);
    }
    if (!panelHost) {
      panelHost = document.createElement("div");
      panelHost.id = "stStartRight";
      panelHost.className = "sts-right";
      right.insertBefore(panelHost, right.firstChild);
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
    const root = [host, panelHost].filter(Boolean) as HTMLElement[];

    root.forEach((r) =>
      r.addEventListener("click", onClick, { once: true } as any),
    );

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
      if (k === "browse") browse();
      else if (k === "sketch") setMethod("sketch");
      else if (k === "describe") setMethod("describe");
      else if (k === "sample") {
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
      } else render();
    } else {
      // re-arm the one-shot listener without changing anything
      render();
      return;
    }
    if (!tab && !chip) return;
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

  function paint(empty: boolean) {
    if (!empty) {
      host?.remove();
      panelHost?.remove();
      host = null;
      panelHost = null;
      return;
    }
    render();
  }

  function open(method?: string) {
    if (method === "sample") state.samples = true;
    else if (method === "describe" || method === "sketch" || method === "property" || method === "space") {
      state.method = method as Method;
      state.samples = false;
    }
    render();
    if (method === "upload") browse();
    const el = document.getElementById("stsDrop") || document.getElementById("stStart");
    if (el) {
      el.classList.add("pulse");
      window.setTimeout(() => el.classList.remove("pulse"), 900);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return { paint, open };
}
