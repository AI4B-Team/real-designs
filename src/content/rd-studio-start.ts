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
    method: "space" as Method,
    /** Chosen file, not uploaded yet. */
    file: null as File | null,
    fileName: "",
    filePreview: "",
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
    filePick.accept = state.method === "sketch" ? "image/*,application/pdf" : "image/*";
    filePick.click();
  }

  function takeFile(f: File) {
    if (state.filePreview) URL.revokeObjectURL(state.filePreview);
    state.file = f;
    state.fileName = f.name;
    state.filePreview = /^image\//.test(f.type) ? URL.createObjectURL(f) : "";
    render();
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

  function dropZone(types: string) {
    if (state.file) {
      return (
        '<div class="stu-file">' +
        (state.filePreview
          ? '<img src="' + state.filePreview + '" alt="Selected source preview">'
          : '<div class="stu-file-ico"><i data-lucide="file-text"></i></div>') +
        '<div class="stu-file-m"><b>' + esc(state.fileName) + "</b>" +
        '<span>Nothing generates and no credits are used until you continue.</span>' +
        '<div class="stu-file-a">' +
        '<button class="stu-link" data-sts="browse"><i data-lucide="repeat"></i>Replace</button>' +
        '<button class="stu-link" data-sts="clearfile"><i data-lucide="trash-2"></i>Remove</button>' +
        "</div></div></div>"
      );
    }
    return (
      '<div class="stu-drop" id="stsDrop">' +
      '<i data-lucide="upload"></i>' +
      "<b>Drag And Drop A File</b>" +
      '<button class="btn btn-dark btn-sm" data-sts="browse">Browse Files</button>' +
      '<span class="stu-types">Supported files: ' + types + "</span>" +
      "</div>"
    );
  }

  function foot(label: string, ok: boolean, note?: string) {
    return (
      '<div class="stu-foot">' +
      '<button class="btn btn-primary" id="stsGo"' + (ok && !state.busy ? "" : " disabled") + ">" +
      (state.busy ? "Working…" : label) +
      "</button>" +
      (note ? '<span class="stu-cost">' + note + "</span>" : "") +
      "</div>"
    );
  }

  /* ---------- setup screens ---------- */

  function setupHead(title: string, desc: string) {
    return '<div class="stu-head"><h2>' + title + "</h2><p>" + desc + "</p>" +
      (state.attached ? '<span class="stu-att"><i data-lucide="map-pin"></i>' + esc(state.attached) + "</span>" : "") +
      "</div>";
  }

  function spaceSetup() {
    return (
      setupHead("Upload Your Space", "Add a photo of the interior, exterior or landscape you want to redesign.") +
      dropZone("JPG, PNG, HEIC, WEBP") +
      '<div class="stu-form">' +
      field("Space Type", chips("space", [["interior", "Interior"], ["exterior", "Exterior"], ["landscape", "Garden"]], state.space)) +
      (state.file ? field("Room Or Area Type", select("stsRoom", ROOMS, state.room)) : "") +
      propertyField() +
      "</div>" +
      foot("Continue", !!state.file)
    );
  }

  function sketchSetup() {
    return (
      setupHead("Upload A Sketch Or Plan", "Turn a sketch, floor plan or concept drawing into a realistic design.") +
      dropZone("JPG, PNG, HEIC, WEBP, PDF") +
      '<div class="stu-form">' +
      field("Input Type", select("stsInput", ["Hand Sketch", "Floor Plan", "Concept Drawing"], state.inputType)) +
      propertyField() +
      "</div>" +
      foot("Continue", !!state.file)
    );
  }

  function describeSetup() {
    return (
      setupHead("Describe What You Want To Create", "Create an original visual concept from a written description.") +
      '<div class="stu-two">' +
      '<div class="stu-col">' +
      '<div class="field"><label for="stsPrompt">Describe Your Idea</label>' +
      '<textarea id="stsPrompt" class="stu-ta" rows="10" placeholder="Create a warm modern living room with natural oak floors, a cream sectional, built-in shelving and soft indirect lighting.">' +
      esc(state.prompt) +
      "</textarea></div>" +
      '<div class="stu-inspo">' +
      '<button class="stu-link" data-sts="inspo"><i data-lucide="image-plus"></i>' +
      (state.inspiration ? "Inspiration: " + esc(state.inspiration.name) : "Add An Inspiration Image (Optional)") +
      "</button>" +
      (state.inspiration ? '<button class="stu-link" data-sts="rminspo"><i data-lucide="x"></i>Remove</button>' : "") +
      "</div>" +
      "</div>" +
      '<div class="stu-col">' +
      field("Project Type", chips("space", [["interior", "Interior"], ["exterior", "Exterior"], ["landscape", "Garden"]], state.space)) +
      field("Room Or Space Type", select("stsRoom", ROOMS, state.room)) +
      field("Approximate Dimensions (Optional)", '<input id="stsDims" type="text" placeholder="14 ft x 18 ft" value="' + esc(state.dims) + '">') +
      field("Design Style", select("stsStyle", STYLES, state.style)) +
      field("Mood", select("stsMood", ["", ...MOODS], state.mood)) +
      field("Budget Range", select("stsBudget", BUDGETS, state.budget)) +
      field("Must-Have Features (Optional)", '<textarea id="stsFeatures" rows="3" placeholder="Built-in shelving, durable rug, reading corner">' + esc(state.features) + "</textarea>") +
      "</div></div>" +
      foot("Generate Concept", state.prompt.trim().length >= 12, "Uses 1 design credit") +
      '<p class="stu-note">Text-only concepts are visual ideas. Connect the concept to a real photo, sketch or floor plan for property-specific results.</p>'
    );
  }

  function propertySetup() {
    return (
      setupHead("Create A Property", "Organize rooms, designs, budgets and presentations under one property.") +
      '<div class="stu-form">' +
      field("Property Name Or Address", '<input id="stsAddr" type="text" placeholder="1420 Bayshore Boulevard, Tampa FL" value="' + esc(state.newAddress) + '">') +
      field("Nickname (Optional)", '<input id="stsNick" type="text" placeholder="Bayshore Flip" value="' + esc(state.newNickname) + '">') +
      field("Property Type", select("stsPType", ["Single Family", "Condo", "Townhome", "Multi Family", "Commercial"], state.newType)) +
      field("Client Or Project Name (Optional)", '<input id="stsPProject" type="text" placeholder="Pre Listing Refresh" value="' + esc(state.newProject) + '">') +
      "</div>" +
      foot("Create Property", state.newAddress.trim().length > 2)
    );
  }

  function setupHtml() {
    const body =
      state.method === "sketch"
        ? sketchSetup()
        : state.method === "describe"
          ? describeSetup()
          : state.method === "property"
            ? propertySetup()
            : spaceSetup();
    return (
      '<div class="stu">' +
      '<button class="stu-back" data-sts="back"><i data-lucide="arrow-left"></i>Back To Starting Options</button>' +
      '<div class="stu-card">' + body + "</div>" +
      "</div>" +
      (state.samples ? samplesHtml() : "")
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
      desc: "Turn a hand sketch, floor plan or concept drawing into a design.",
      meta: "JPG · PNG · HEIC · WEBP · PDF",
      btn: "Upload A Sketch",
    },
    {
      act: "c-describe",
      icon: "message-square-text",
      title: "Describe An Idea",
      desc: "Start from a written idea when you have no photo or plan.",
      meta: "Text to concept",
      btn: "Describe An Idea",
    },
    {
      act: "c-property",
      icon: "map-pin",
      title: "Start With A Property",
      desc: "Organize rooms, designs, budgets and presentations together.",
      meta: "Rooms, budgets, presentations",
      btn: "Create A Property",
    },
    {
      act: "lvideo",
      icon: "clapperboard",
      title: "Create A Listing Video",
      desc: "Turn your listing photos into a polished video for social media and MLS.",
      meta: "Photos, motion, branding",
      btn: "Create A Listing Video",
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
          '<button type="button" class="stc-card" data-sts="' + c.act + '">' +
          '<i data-lucide="' + c.icon + '" class="stc-ico"></i>' +
          "<h3>" + c.title + "</h3>" +
          "<p>" + c.desc + "</p>" +
          '<span class="stc-meta">' + c.meta + "</span>" +
          '<span class="stc-act">' + c.btn + '<i data-lucide="arrow-right"></i></span>' +
          "</button>",
      ).join("") +
      "</div>" +
      '<p class="stc-foot">Not ready to upload? <button class="stc-samplelink" data-sts="sample">Try A Sample Space</button></p>' +
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
    if (state.method === "space" || state.method === "sketch") return !!state.file;
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
    if (!act) return;
    const k = act.dataset["sts"];
    if (k === "lvideo") {
      goListingVideo();
      return;
    }
    if (k === "c-space" || k === "c-sketch") {
      openSetup(k === "c-sketch" ? "sketch" : "space");
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
