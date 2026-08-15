/**
 * First-use experience, adaptive post-login routing and the Studio workflow
 * chooser.
 *
 * This extends the existing app shell: it never creates a second Dashboard,
 * Studio or onboarding route. Everything renders inside the real views so a
 * new user starts working immediately, while a returning user with content
 * keeps landing on the Dashboard.
 */

import {
  clearStudioSession,
  completeOnboarding,
  getLastView,
  getStudioSession,
  isNewUser,
  isOnboardingComplete,
  saveStudioSession,
  setLastView,
  takeCheckoutReturn,
  takeStartIntent,
  type StartIntent,
} from "@/lib/onboarding";

type Ctx = {
  go: (view: string, fromHash?: boolean) => void;
  lucide: { createIcons: (o?: any) => void };
  esc: (s: string) => string;
  photos: Record<string, string>;
  uid: string;
  /** Real workspace counts, already loaded by the dashboard. */
  getSummary: () => Promise<any>;
  /** Persists an uploaded file and returns its storage path. */
  uploadPhoto: (file: File) => Promise<string>;
  prefsStart: () => Promise<"smart" | "dashboard" | "studio" | "last">;
  saveStart: (page: string) => Promise<void>;
  track: (event: string, props?: Record<string, unknown>) => void;
};

type Sample = { key: string; name: string; space: string; room: string; photo: string; alt: string };

const WORKFLOWS: Record<
  string,
  { label: string; tool?: string; space?: string; room?: string; group: string; status?: string; desc: string }
> = {
  redesign: { label: "Redesign A Space", tool: "Redesign", space: "interior", group: "design", desc: "Restyle a room while the architecture stays put." },
  stage: { label: "Stage An Empty Room", tool: "Virtual Stage", space: "interior", group: "design", desc: "Furnish an empty room in your Design DNA." },
  exterior: { label: "Design An Exterior", tool: "Redesign", space: "exterior", group: "design", desc: "Facade, paint, roof and entry updates." },
  garden: { label: "Plan Landscaping", tool: "Redesign", space: "landscape", group: "design", desc: "Plantings, hardscape and yard layout." },
  sketch: { label: "Start From A Sketch Or Plan", tool: "Sketch To Render", space: "interior", group: "design", desc: "Turn a hand sketch or floor plan into a render." },
  enhance: { label: "Enhance Listing Photos", tool: "Redesign", space: "interior", group: "listing", desc: "Clean, bright, MLS ready photography." },
  declutter: { label: "Declutter Or Empty", tool: "Declutter", space: "interior", group: "listing", desc: "Remove clutter and personal items." },
  dusk: { label: "Day To Dusk", group: "listing", status: "Coming Soon", desc: "Twilight conversion for exterior listing shots." },
  batch: { label: "Prepare A Complete Listing", group: "listing", desc: "Stage a whole property in one direction." },
  property: { label: "Upload A Complete Property", group: "listing", desc: "Create the property first, then add rooms." },
  budget: { label: "Design Around A Budget", tool: "Scope & Budget", group: "plan", desc: "Hold the design to a planning range." },
  products: { label: "Design With Products", group: "plan", desc: "Shop the design and price real products." },
  continue: { label: "Continue An Existing Property", group: "plan", desc: "Pick up a property you already started." },
};

const GOALS = [
  { key: "redesign", label: "Redesign A Space", sources: ["photo"] },
  { key: "stage", label: "Stage An Empty Room", sources: ["photo"] },
  { key: "enhance", label: "Improve Listing Photos", sources: ["photo"] },
  { key: "exterior", label: "Design An Exterior", sources: ["photo"] },
  { key: "garden", label: "Plan Landscaping", sources: ["photo"] },
  { key: "sketch", label: "Start From A Sketch", sources: ["sketch"] },
  { key: "property", label: "Upload A Complete Property", sources: ["photo", "sketch"] },
];

const LOCK_LEVELS = [
  { key: "most", label: "Keep Most Of The Space", note: "Keep the layout, walls, windows and flooring. Update styling only." },
  { key: "finishes", label: "Update Finishes And Furnishings", note: "Keep the architecture, replace finishes and furniture." },
  { key: "major", label: "Make Major Changes", note: "Open up the space, replace cabinetry, finishes and layout where needed." },
  { key: "custom", label: "Custom", note: "" },
];

const BANDS = ["Refresh", "Makeover", "Renovation", "Full Remodel"];

export function mountFirstUse(ctx: Ctx) {
  const { go, lucide, esc, photos, uid, track } = ctx;
  const studio = document.getElementById("v-studio");
  const dash = document.getElementById("v-dash");
  if (!studio || !dash) return;
  if (document.getElementById("fuPanel")) return;

  const SAMPLES: Sample[] = [
    { key: "living", name: "Empty Living Room", space: "interior", room: "Living Room", photo: photos["empty"] || photos["before"] || "", alt: "Sample empty living room with bare walls and wood flooring" },
    { key: "kitchen", name: "Outdated Kitchen", space: "interior", room: "Kitchen", photo: photos["kitchenBefore"] || photos["kitchen"] || "", alt: "Sample dated kitchen with oak cabinets" },
    { key: "bath", name: "Primary Bathroom", space: "interior", room: "Primary Bath", photo: photos["bathBefore"] || photos["bath"] || "", alt: "Sample primary bathroom before renovation" },
    { key: "exterior", name: "Home Exterior", space: "exterior", room: "Living Room", photo: photos["paintedBrick"] || photos["ranch"] || "", alt: "Sample single family home exterior" },
    { key: "yard", name: "Backyard Or Landscape", space: "landscape", room: "Living Room", photo: photos["resortYard"] || photos["after"] || "", alt: "Sample backyard before landscaping" },
  ];

  /* ---------- panel shell ---------- */
  const panel = document.createElement("div");
  panel.className = "fu";
  panel.id = "fuPanel";
  panel.hidden = true;
  studio.insertBefore(panel, studio.firstChild);

  const state: {
    mode: "hidden" | "start" | "samples" | "guide" | "chooser" | "success";
    step: number;
    sourceKind: "" | "photo" | "sketch";
    sample: string;
    goal: string;
    space: string;
    room: string;
    direction: string;
    lock: string;
    budget: string;
    thumb: string;
  } = {
    mode: "hidden",
    step: 0,
    sourceKind: "",
    sample: "",
    goal: "",
    space: "interior",
    room: "Living Room",
    direction: "",
    lock: "",
    budget: "",
    thumb: "",
  };

  const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T | null;

  /* ---------- writing into the real Studio controls ---------- */
  function applySpace(space: string) {
    const chip = q(`#spChips .chip[data-sp="${space}"]`);
    if (!chip) return;
    document.querySelectorAll("#spChips .chip").forEach((c) => c.classList.remove("on"));
    chip.classList.add("on");
    (chip as HTMLElement).click();
  }
  function applyRoom(room: string) {
    const sel = document.getElementById("fRoom") as HTMLSelectElement | null;
    if (!sel) return;
    const opt = Array.from(sel.options).find((o) => o.text.toLowerCase() === room.toLowerCase());
    if (opt) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  function applyTool(tool?: string) {
    if (!tool) return;
    const row = q(`#fTool .toolrow[data-tool="${tool}"]`);
    if (row) (row as HTMLElement).click();
  }
  function applyDirection(dir: string) {
    const sel = document.getElementById("fStyle") as HTMLSelectElement | null;
    if (!sel || !dir) return;
    const opt = Array.from(sel.options).find((o) => o.text.toLowerCase() === dir.toLowerCase());
    if (opt) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  function applyBudget(band: string) {
    const i = BANDS.indexOf(band);
    if (i < 0) return;
    const chip = q(`.bchip[data-b="${i}"]`);
    if (chip) (chip as HTMLElement).click();
  }
  function applyLock(level: string) {
    const row = LOCK_LEVELS.find((l) => l.key === level);
    const note = document.getElementById("agentNote") as HTMLTextAreaElement | null;
    if (row && row.note && note && !note.value.trim()) note.value = row.note;
    const keep = document.getElementById("mKeep");
    if (level === "most" && keep) (keep as HTMLElement).click();
  }
  function setSourceImage(src: string, alt: string, kind?: string) {
    // Studio owns the source state; never paint the canvas behind its back.
    const set = (window as any).rdSetStudioSource;
    if (typeof set === "function") set(kind || "user_upload", src, alt);
    else {
      const before = document.getElementById("cBefore");
      if (before) {
        before.innerHTML = `<img src="${src}" alt="${esc(alt)}" style="width:100%;height:100%;object-fit:cover;display:block">`;
      }
    }
    state.thumb = src;
  }

  function persist() {
    saveStudioSession(uid, {
      workflow: state.goal,
      space: state.space,
      room: state.room,
      direction: state.direction,
      sample: state.sample,
      thumb: state.sample ? state.thumb : "",
    });
  }

  /* ---------- sample banner ---------- */
  function sampleBanner(on: boolean, name?: string) {
    const host = document.getElementById("canvasCard");
    let bn = document.getElementById("fuSampleBar");
    if (!on) {
      if (bn) bn.remove();
      return;
    }
    if (!host) return;
    if (!bn) {
      bn = document.createElement("div");
      bn.id = "fuSampleBar";
      bn.className = "note fu-sample-bar";
      host.parentElement?.insertBefore(bn, host);
    }
    bn.innerHTML =
      '<i data-lucide="flask-conical"></i><span><b>Sample Space.</b> ' +
      esc(name || "") +
      " is example imagery, not one of your properties. Anything you generate from it is labelled as sample based. You can upload your own space at any time." +
      '</span><button class="btn btn-primary btn-xs" id="fuSampleUpload" style="margin-left:auto"><i data-lucide="image-up"></i>Upload My Space</button>';
    lucide.createIcons();
    document.getElementById("fuSampleUpload")?.addEventListener("click", () => pickFile("photo"));
  }

  /* ---------- file input ---------- */
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.hidden = true;
  fileInput.id = "fuFile";
  panel.appendChild(fileInput);

  function pickFile(kind: "photo" | "sketch") {
    state.sourceKind = kind;
    fileInput.accept = kind === "sketch" ? "image/jpeg,image/png,image/heic,image/webp,application/pdf" : "image/jpeg,image/png,image/heic,image/webp";
    fileInput.value = "";
    fileInput.click();
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    state.sample = "";
    sampleBanner(false);
    const isPdf = file.type === "application/pdf";
    if (!isPdf) {
      try {
        setSourceImage(URL.createObjectURL(file), "The space you uploaded");
      } catch {
        /* preview is best effort */
      }
    }
    track("first_source_uploaded", { kind: state.sourceKind, pdf: isPdf });
    const status = document.getElementById("fuUpNote");
    if (status) status.textContent = "Uploading…";
    try {
      const path = await ctx.uploadPhoto(file);
      (window as any).rdPendingPhotoPath = path;
      if (status) status.textContent = "Uploaded. Continue below.";
    } catch (e: any) {
      if (status) status.textContent = e?.message || "That upload did not go through. Try again.";
      track("first_generation_failed", { stage: "upload" });
    }
    if (state.sourceKind === "sketch") applyTool("Sketch To Render");
    state.step = 1;
    state.mode = "guide";
    render();
  });

  /* ---------- renderers ---------- */
  function railHtml(active: number) {
    const steps = ["Source", "Goal", "Style", "Generate"];
    return (
      '<ol class="fu-rail" aria-label="First design progress">' +
      steps
        .map((s, i) => {
          const done = i < active;
          const on = i === active;
          return (
            '<li class="fu-rail-i' +
            (done ? " done" : "") +
            (on ? " on" : "") +
            '"' +
            (on ? ' aria-current="step"' : "") +
            '><span class="fu-rail-n">' +
            (done ? '<i data-lucide="check"></i>' : String(i + 1)) +
            "</span>" +
            s +
            (done ? " <span class=\"sr-only\">completed</span>" : "") +
            "</li>"
          );
        })
        .join("") +
      "</ol>"
    );
  }



  function guideHtml() {
    const src = state.sourceKind || "photo";
    const goals = GOALS.filter((g) => g.sources.includes(src));
    const goal = state.goal;
    const rail = state.step >= 3 ? 3 : state.step;
    const blocks: string[] = [];

    blocks.push(
      '<div class="fu-head slim"><span class="fu-eyebrow mono">FIRST DESIGN</span><h2>What Would You Like To Do?</h2>' +
        "<p>Only the settings this workflow needs are shown. Advanced Studio controls stay available below.</p></div>" +
        railHtml(rail),
    );

    blocks.push(
      '<section class="fu-step" aria-labelledby="fuGoalH"><h3 id="fuGoalH">Choose The Goal</h3><div class="fu-opts">' +
        goals
          .map(
            (g) =>
              '<button class="fu-opt' +
              (goal === g.key ? " on" : "") +
              '" data-fu-goal="' +
              g.key +
              '">' +
              g.label +
              "</button>",
          )
          .join("") +
        "</div></section>",
    );

    if (goal) {
      blocks.push(
        '<section class="fu-step" aria-labelledby="fuSpaceH"><h3 id="fuSpaceH">Define The Space</h3><div class="fu-opts">' +
          [
            ["interior", "Interior"],
            ["exterior", "Exterior"],
            ["landscape", "Garden"],
          ]
            .map(
              ([k, l]) =>
                '<button class="fu-opt' + (state.space === k ? " on" : "") + '" data-fu-space="' + k + '">' + l + "</button>",
            )
            .join("") +
          "</div>" +
          '<label class="fu-field"><span>Room Or Space Type</span><select id="fuRoom">' +
          ["Living Room", "Kitchen", "Primary Bedroom", "Primary Bath", "Dining Room"]
            .map((r) => '<option' + (state.room === r ? " selected" : "") + ">" + r + "</option>")
            .join("") +
          "</select></label></section>",
      );

      blocks.push(
        '<section class="fu-step" aria-labelledby="fuDirH"><h3 id="fuDirH">Choose A Style</h3><div class="fu-opts">' +
          ["Warm Minimal", "Modern Farmhouse", "Coastal", "Transitional", "Investor Neutral"]
            .map(
              (d) =>
                '<button class="fu-opt' + (state.direction === d ? " on" : "") + '" data-fu-dir="' + d + '">' + d + "</button>",
            )
            .join("") +
          '</div><div class="fu-subacts">' +
          '<button class="fu-link" data-fu-act="browse">Browse Styles</button>' +
          '<button class="fu-link" data-fu-act="recommend">Let AI Recommend</button>' +
          '<button class="fu-link" data-fu-act="nodir">Continue Without Choosing</button></div></section>',
      );

      blocks.push(
        '<section class="fu-step" aria-labelledby="fuLockH"><h3 id="fuLockH">Choose What Changes</h3><div class="fu-opts">' +
          LOCK_LEVELS.map(
            (l) =>
              '<button class="fu-opt' + (state.lock === l.key ? " on" : "") + '" data-fu-lock="' + l.key + '">' + l.label + "</button>",
          ).join("") +
          '</div><div class="fu-subacts"><button class="fu-link" data-fu-act="customize">Customize What Changes</button></div></section>',
      );

      blocks.push(
        '<section class="fu-step" aria-labelledby="fuBudH"><h3 id="fuBudH">Set An Optional Budget</h3>' +
          '<p class="fu-p">Do you want the design to follow a budget?</p><div class="fu-opts">' +
          BANDS.map(
            (b) => '<button class="fu-opt' + (state.budget === b ? " on" : "") + '" data-fu-budget="' + b + '">' + b + "</button>",
          ).join("") +
          '<button class="fu-opt' + (state.budget === "later" ? " on" : "") + '" data-fu-budget="later">Decide Later</button></div></section>',
      );

      const summary: Array<[string, string]> = [
        ["Goal", GOALS.find((g) => g.key === goal)?.label || "\u2014"],
        ["Space Type", state.space === "landscape" ? "Garden" : state.space === "exterior" ? "Exterior" : "Interior"],
        ["Room", state.room],
        ["Design Style", state.direction || "Not Chosen"],
        ["Reality Lock", LOCK_LEVELS.find((l) => l.key === state.lock)?.label || "Default"],
        ["Budget", state.budget && state.budget !== "later" ? state.budget : "Decide Later"],
      ];
      blocks.push(
        '<section class="fu-review" aria-labelledby="fuRevH"><h3 id="fuRevH">Review And Generate</h3><dl class="fu-sum">' +
          summary.map(([k, v]) => "<div><dt>" + k + "</dt><dd>" + esc(v) + "</dd></div>").join("") +
          '</dl><div class="fu-acts"><button class="btn btn-primary" data-fu-act="generate"><i data-lucide="sparkles"></i>Generate My Design</button>' +
          '<button class="btn btn-ghost" data-fu-act="back">Back</button>' +
          '<button class="fu-link" data-fu-act="skip">Skip Onboarding</button></div></section>',
      );
    } else {
      blocks.push('<div class="fu-alt"><button class="fu-link" data-fu-act="back">Back</button>' +
        '<button class="fu-link" data-fu-act="skip">Skip Onboarding</button></div>');
    }
    return blocks.join("");
  }


  function successHtml() {
    const sample = !!state.sample;
    return (
      '<div class="fu-head"><span class="fu-eyebrow mono">FIRST DESIGN</span><h2>Your First Design Is Ready.</h2>' +
      "<p>Save it to keep the version history, refine it for another pass, or price the work with a scope.</p></div>" +
      railHtml(4) +
      '<div class="fu-acts">' +
      '<button class="btn btn-primary" data-fu-act="refine"><i data-lucide="wand-sparkles"></i>Refine Design</button>' +
      '<button class="btn btn-dark" data-fu-act="save"><i data-lucide="save"></i>Save To My Designs</button>' +
      '<button class="btn btn-ghost" data-fu-act="another"><i data-lucide="copy-plus"></i>Create Another Version</button>' +
      "</div>" +
      '<div class="fu-acts secondary">' +
      '<button class="fu-link" data-fu-act="compare">Compare Before &amp; After</button>' +
      '<button class="fu-link" data-fu-act="shop">Shop This Design</button>' +
      '<button class="fu-link" data-fu-act="property">Add To A Property</button>' +
      '<button class="fu-link" data-fu-act="budget">Set A Budget</button>' +
      '<button class="fu-link" data-fu-act="scope">Build Scope</button>' +
      "</div>" +
      '<p class="fu-p">Next: saving files the design under a property so scopes, products and client approvals stay together.</p>' +
      (sample
        ? '<div class="note fu-ready"><i data-lucide="image-up"></i><span><b>Ready To Use Your Own Space?</b> This design came from a sample space.</span>' +
          '<button class="btn btn-primary btn-xs" data-fu-act="uploadOwn" style="margin-left:auto">Upload My Space</button></div>'
        : "")
    );
  }

  function render() {
    if (state.mode === "hidden") {
      panel.hidden = true;
      panel.innerHTML = "";
      panel.appendChild(fileInput);
      return;
    }
    /* Studio owns the single start experience: never render a second one here. */
    if (state.mode === "start" || state.mode === "samples" || state.mode === "chooser") {
      panel.hidden = true;
      panel.innerHTML = "";
      panel.appendChild(fileInput);
      const open = (window as any).rdStudioStart;
      if (typeof open === "function") open(state.mode === "samples" ? "sample" : undefined);
      state.mode = "hidden";
      return;
    }
    panel.hidden = false;
    const body = state.mode === "guide" ? guideHtml() : successHtml();
    panel.innerHTML = body;
    panel.appendChild(fileInput);
    lucide.createIcons();
    wire();
  }

  /* ---------- interactions ---------- */
  function wire() {
    panel.querySelectorAll("[data-fu-start]").forEach((b) =>
      b.addEventListener("click", () => {
        const k = (b as HTMLElement).dataset["fuStart"];
        if (k === "upload") {
          track("first_option_selected", { option: "upload" });
          pickFile("photo");
        } else if (k === "sketch") {
          track("first_option_selected", { option: "sketch" });
          pickFile("sketch");
        } else if (k === "property") {
          track("first_option_selected", { option: "property" });
          completeOnboarding(uid, "property");
          go("props");
        } else if (k === "sample") {
          track("first_option_selected", { option: "sample" });
          state.mode = "samples";
          render();
        } else {
          state.mode = "start";
          render();
        }
      }),
    );

    panel.querySelectorAll("[data-fu-sample]").forEach((b) =>
      b.addEventListener("click", () => {
        const key = (b as HTMLElement).dataset["fuSample"] || "";
        const s = SAMPLES.find((x) => x.key === key);
        if (!s) return;
        state.sample = key;
        state.sourceKind = "photo";
        state.space = s.space;
        state.room = s.room;
        setSourceImage(s.photo, s.alt, "intentional_sample");
        applySpace(s.space);
        applyRoom(s.room);
        sampleBanner(true, s.name);
        track("sample_space_selected", { sample: key });
        state.step = 1;
        state.mode = "guide";
        persist();
        render();
      }),
    );

    panel.querySelectorAll("[data-fu-goal]").forEach((b) =>
      b.addEventListener("click", () => {
        state.goal = (b as HTMLElement).dataset["fuGoal"] || "";
        const wf = WORKFLOWS[state.goal];
        if (wf) {
          applyTool(wf.tool);
          if (wf.space) {
            state.space = wf.space;
            applySpace(wf.space);
          }
        }
        if (state.goal === "property") {
          completeOnboarding(uid, "property");
          go("props");
          return;
        }
        state.step = Math.max(state.step, 2);
        track("workflow_selected", { workflow: state.goal, surface: "first_use" });
        persist();
        render();
      }),
    );

    panel.querySelectorAll("[data-fu-space]").forEach((b) =>
      b.addEventListener("click", () => {
        state.space = (b as HTMLElement).dataset["fuSpace"] || "interior";
        applySpace(state.space);
        persist();
        render();
      }),
    );

    const roomSel = panel.querySelector("#fuRoom") as HTMLSelectElement | null;
    if (roomSel)
      roomSel.addEventListener("change", () => {
        state.room = roomSel.value;
        applyRoom(state.room);
        persist();
      });

    panel.querySelectorAll("[data-fu-dir]").forEach((b) =>
      b.addEventListener("click", () => {
        state.direction = (b as HTMLElement).dataset["fuDir"] || "";
        applyDirection(state.direction);
        state.step = Math.max(state.step, 3);
        track("direction_selected", { direction: state.direction, surface: "first_use" });
        persist();
        render();
      }),
    );

    panel.querySelectorAll("[data-fu-lock]").forEach((b) =>
      b.addEventListener("click", () => {
        state.lock = (b as HTMLElement).dataset["fuLock"] || "";
        applyLock(state.lock);
        if (state.lock === "custom") scrollTo("#lockList");
        persist();
        render();
      }),
    );

    panel.querySelectorAll("[data-fu-budget]").forEach((b) =>
      b.addEventListener("click", () => {
        state.budget = (b as HTMLElement).dataset["fuBudget"] || "";
        if (state.budget !== "later") applyBudget(state.budget);
        track(state.budget === "later" ? "budget_skipped" : "budget_selected", { band: state.budget });
        persist();
        render();
      }),
    );

    panel.querySelectorAll("[data-fu-wf]").forEach((b) =>
      b.addEventListener("click", () => {
        const key = (b as HTMLElement).dataset["fuWf"] || "";
        applyWorkflow(key);
        track("workflow_selected", { workflow: key, surface: "chooser" });
      }),
    );

    panel.querySelectorAll("[data-fu-act]").forEach((b) =>
      b.addEventListener("click", () => act((b as HTMLElement).dataset["fuAct"] || "")),
    );
  }

  function scrollTo(sel: string) {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "center" });
  }
  function prefersReduced() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  function applyWorkflow(key: string) {
    const wf = WORKFLOWS[key];
    if (!wf) return;
    if (key === "property" || key === "continue") {
      hide();
      go("props");
      return;
    }
    if (key === "batch") {
      hide();
      go("listings");
      return;
    }
    if (key === "products") {
      hide();
      go("products");
      return;
    }
    if (key === "budget") {
      applyTool(wf.tool);
      hide();
      go("scope");
      return;
    }
    if (wf.space) applySpace(wf.space);
    applyTool(wf.tool);
    saveStudioSession(uid, { workflow: key, space: wf.space });
    hide();
    scrollTo("#canvasCard");
  }

  function act(a: string) {
    switch (a) {
      case "browse":
        hide();
        go("explore");
        break;
      case "recommend": {
        const pick = ["Warm Minimal", "Transitional", "Coastal"][Math.floor(Math.random() * 3)] as string;
        state.direction = pick;
        applyDirection(pick);
        state.step = Math.max(state.step, 3);
        track("direction_selected", { direction: pick, surface: "first_use", recommended: true });
        render();
        break;
      }
      case "nodir":
        state.direction = "";
        state.step = Math.max(state.step, 3);
        render();
        break;
      case "customize":
        scrollTo("#lockList");
        break;
      case "generate": {
        track("first_generation_started", { workflow: state.goal, sample: !!state.sample });
        awaitingFirst = true;
        hide();
        scrollTo("#canvasCard");
        const btn = document.getElementById("genBtn");
        setTimeout(() => btn && (btn as HTMLElement).click(), 220);
        break;
      }
      case "back":
        if (state.goal) {
          state.goal = "";
          render();
        } else {
          state.mode = "start";
          render();
        }
        break;
      case "skip":
        completeOnboarding(uid, "skipped");
        track("onboarding_skipped", {});
        hide();
        break;
      case "refine":
        hide();
        scrollTo("#fTool");
        break;
      case "save":
        hide();
        go("scope");
        setTimeout(() => scrollTo("#svAddress"), 120);
        break;
      case "another": {
        hide();
        const btn = document.getElementById("genBtn");
        if (btn) (btn as HTMLElement).click();
        break;
      }
      case "compare":
        hide();
        scrollTo("#canvas");
        break;
      case "shop": {
        hide();
        const shop = document.getElementById("stShop");
        if (shop) (shop as HTMLElement).click();
        break;
      }
      case "property":
        hide();
        go("props");
        break;
      case "budget":
        hide();
        scrollTo("#canvasCard");
        break;
      case "scope":
        hide();
        go("scope");
        break;
      case "uploadOwn":
        state.mode = "start";
        render();
        pickFile("photo");
        break;
      case "closeChooser":
        hide();
        break;
      default:
        break;
    }
  }

  function hide() {
    // With no source loaded there is nothing to show behind the panel, so the
    // welcome state stays instead of leaving an empty Studio.
    const has = (window as any).rdStudioHasSource;
    void has;
    state.mode = "hidden";
    render();
  }

  (window as any).rdStudioWelcome = (kind?: string) => {
    const open = (window as any).rdStudioStart;
    if (typeof open === "function") open(kind === "sample" ? "sample" : kind === "upload" ? "upload" : undefined);
  };
  (window as any).rdStudioHideWelcome = () => {};

  /* ---------- first success ---------- */
  let awaitingFirst = false;
  window.addEventListener("rd:photo", () => {
    if (!awaitingFirst) return;
    awaitingFirst = false;
    completeOnboarding(uid, "generated");
    clearStudioSession(uid);
    track("first_generation_completed", { sample: !!state.sample });
    state.mode = "success";
    render();
    scrollTo("#fuPanel");
  });

  /* ---------- resume card on the dashboard ---------- */
  function resumeCard(session: ReturnType<typeof getStudioSession>) {
    if (!session) return;
    if (document.getElementById("fuResume")) return;
    const card = document.createElement("div");
    card.className = "card fu-resume";
    card.id = "fuResume";
    const when = session.updated ? new Date(session.updated).toLocaleString() : "";
    card.innerHTML =
      '<div class="card-h"><div><h3>Continue Where You Left Off?</h3><div class="sub">' +
      esc(WORKFLOWS[session.workflow || ""]?.label || "Studio Session") +
      (when ? " · Last updated " + esc(when) : "") +
      '</div></div></div><div class="card-b fu-resume-b">' +
      (session.thumb ? '<img src="' + session.thumb + '" alt="Thumbnail of the space in your unfinished session">' : "") +
      "<div><b>" +
      esc(session.room || "Untitled Room") +
      "</b><span>" +
      esc(session.space === "landscape" ? "Garden" : session.space === "exterior" ? "Exterior" : "Interior") +
      (session.direction ? " · " + esc(session.direction) : "") +
      '</span></div><div class="fu-resume-a">' +
      '<button class="btn btn-primary btn-xs" id="fuResumeGo"><i data-lucide="play"></i>Continue Design</button>' +
      '<button class="btn btn-ghost btn-xs" id="fuResumeNew">Start Something New</button>' +
      '<button class="btn btn-ghost btn-xs" id="fuResumeX">Dismiss</button></div></div>';
    dash!.insertBefore(card, dash!.firstChild);
    lucide.createIcons();
    track("resume_session_offered", {});
    document.getElementById("fuResumeGo")?.addEventListener("click", () => {
      track("session_resumed", {});
      restoreSession(session);
      card.remove();
      go("studio");
    });
    document.getElementById("fuResumeNew")?.addEventListener("click", () => {
      track("new_session_selected", {});
      clearStudioSession(uid);
      card.remove();
      openChooser();
      go("studio");
    });
    document.getElementById("fuResumeX")?.addEventListener("click", () => card.remove());
  }

  function restoreSession(session: NonNullable<ReturnType<typeof getStudioSession>>) {
    if (session.space) applySpace(session.space);
    if (session.room) applyRoom(session.room);
    if (session.direction) applyDirection(session.direction);
    const wf = WORKFLOWS[session.workflow || ""];
    if (wf) applyTool(wf.tool);
    if (session.thumb) setSourceImage(session.thumb, "The space from your saved session");
    if (session.sample) sampleBanner(true, SAMPLES.find((s) => s.key === session.sample)?.name);
    const card = document.getElementById("canvasCard");
    if (card && !document.getElementById("fuRestored")) {
      const bn = document.createElement("div");
      bn.id = "fuRestored";
      bn.className = "note";
      bn.innerHTML = '<i data-lucide="history"></i><span>Your last Studio session was restored.</span>';
      card.parentElement?.insertBefore(bn, card);
      lucide.createIcons();
    }
  }

  /* ---------- dashboard empty state ---------- */
  function dashEmptyState(on: boolean) {
    const kpis = dash!.querySelector(".grid.g4") as HTMLElement | null;
    let box = document.getElementById("fuDashEmpty");
    if (!on) {
      if (box) box.remove();
      if (kpis) kpis.hidden = false;
      return;
    }
    if (kpis) kpis.hidden = true;
    document.getElementById("onbCard")?.setAttribute("hidden", "");
    if (!box) {
      box = document.createElement("div");
      box.id = "fuDashEmpty";
      box.className = "card fu-empty";
      dash!.insertBefore(box, dash!.firstChild);
    }
    box.innerHTML =
      '<div class="card-b"><h2>Create Your First Property Design.</h2>' +
      "<p>Upload a space, start from a sketch or try a sample to see what REAL DESIGNS can create.</p>" +
      '<div class="fu-acts"><button class="btn btn-primary" id="fuEmptyStudio"><i data-lucide="wand-2"></i>Start In Studio</button>' +
      '<button class="btn btn-dark" id="fuEmptySample">Try A Sample Space</button>' +
      '<button class="btn btn-ghost" id="fuEmptyProp">Create A Property</button></div></div>';
    lucide.createIcons();
    document.getElementById("fuEmptyStudio")?.addEventListener("click", () => {
      openFirstUse();
      go("studio");
    });
    document.getElementById("fuEmptySample")?.addEventListener("click", () => {
      state.mode = "samples";
      render();
      go("studio");
    });
    document.getElementById("fuEmptyProp")?.addEventListener("click", () => go("props"));
  }

  /* ---------- continue working ---------- */
  function continueCard(summary: any) {
    const recent = (summary?.recent || [])[0];
    if (!recent) return;
    if (document.getElementById("fuContinue")) return;
    const card = document.createElement("div");
    card.id = "fuContinue";
    card.className = "card fu-continue";
    card.innerHTML =
      '<div class="card-h"><div><h3>Continue Working</h3><div class="sub">Your most recent activity</div></div>' +
      '<button class="btn btn-primary btn-xs" id="fuNewDesign"><i data-lucide="plus"></i>New Design</button></div>' +
      '<div class="card-b fu-cont-b"><div class="rowt"><b>' +
      esc(recent.room_name || "Recent Room") +
      "</b><span>" +
      esc(recent.address || "") +
      " · " +
      esc(recent.status === "approved" ? "Approved" : "Awaiting review") +
      '</span></div><div class="fu-resume-a">' +
      '<button class="btn btn-dark btn-xs" id="fuContDesign">Continue Design</button>' +
      '<button class="btn btn-ghost btn-xs" id="fuContProp">Resume Property</button>' +
      '<button class="btn btn-ghost btn-xs" id="fuContProducts">Review Products</button></div></div>';
    dash!.insertBefore(card, dash!.firstChild);
    lucide.createIcons();
    document.getElementById("fuNewDesign")?.addEventListener("click", () => {
      openChooser();
      go("studio");
    });
    document.getElementById("fuContDesign")?.addEventListener("click", () => go("studio"));
    document.getElementById("fuContProp")?.addEventListener("click", () => go("props"));
    document.getElementById("fuContProducts")?.addEventListener("click", () => go("products"));
  }

  /* ---------- public-ish entry points ---------- */
  function openFirstUse() {
    state.mode = "start";
    render();
    track("first_login_studio_opened", {});
  }
  function openChooser() {
    state.mode = "chooser";
    render();
  }
  (window as any).rdFirstUse = () => {
    openFirstUse();
    go("studio");
  };
  (window as any).rdStudioChooser = () => {
    openChooser();
    go("studio");
  };

  function applyIntent(intent: StartIntent) {
    if (intent.space) applySpace(intent.space);
    if (intent.room) applyRoom(intent.room);
    if (intent.direction) applyDirection(intent.direction);
    if (intent.workflow) {
      const wf = WORKFLOWS[intent.workflow];
      if (wf) applyTool(wf.tool);
      if (wf?.space) applySpace(wf.space);
      saveStudioSession(uid, { workflow: intent.workflow, space: intent.space, direction: intent.direction });
    }
    if (intent.sample) {
      const s = SAMPLES.find((x) => x.key === intent.sample);
      if (s) {
        state.sample = s.key;
        setSourceImage(s.photo, s.alt, "intentional_sample");
        sampleBanner(true, s.name);
      }
    }
    track("cta_context_restored", { workflow: intent.workflow || null, source: intent.source || null });
  }

  /* ---------- route decision ---------- */
  (async function decide() {
    const hash = (location.hash || "").replace(/^#/, "").replace(/^v-/, "");
    const deepLink = !!hash;
    const shell = document.querySelector(".rd-app .content") as HTMLElement | null;
    if (!deepLink && shell) shell.classList.add("rd-routing");
    const reveal = () => shell?.classList.remove("rd-routing");
    const fallback = window.setTimeout(reveal, 2500);

    const intent = takeStartIntent();
    const back = takeCheckoutReturn();
    let summary: any = null;
    try {
      summary = await ctx.getSummary();
    } catch {
      /* offline or expired session: fall through to the dashboard */
    }
    const session = getStudioSession(uid);
    const counts = summary?.counts || { properties: 0, designs: 0, priced: 0 };
    const content = {
      properties: counts.properties || 0,
      designs: counts.designs || 0,
      scopes: counts.priced || 0,
      products: 0,
      hasSession: !!session,
      onboarded: isOnboardingComplete(uid),
    };
    const fresh = isNewUser(content);

    if (!content.properties && !content.designs) dashEmptyState(true);
    else continueCard(summary);

    let pref: "smart" | "dashboard" | "studio" | "last" = "smart";
    try {
      pref = await ctx.prefsStart();
    } catch {
      /* default smart */
    }

    if (deepLink) {
      // explicit deep link always wins
    } else if (back) {
      track("checkout_context_restored", { reason: back.reason || null });
      if (back.intent) applyIntent(back.intent);
      go(back.view || "studio");
      showPlanNote();
    } else if (intent) {
      applyIntent(intent);
      go("studio");
      if (fresh && !intent.sample) openFirstUse();
    } else if (fresh) {
      go("studio");
      openFirstUse();
    } else if (pref === "studio") {
      openChooser();
      go("studio");
    } else if (pref === "last") {
      const last = getLastView(uid);
      if (last) go(last);
    } else if (pref === "dashboard") {
      go("dash");
    } else if (session) {
      go("dash");
      resumeCard(session);
    }

    window.clearTimeout(fallback);
    reveal();
  })();

  function showPlanNote() {
    const host = document.querySelector(".rd-app .content");
    if (!host || document.getElementById("fuPlanNote")) return;
    const n = document.createElement("div");
    n.id = "fuPlanNote";
    n.className = "note";
    n.innerHTML =
      '<i data-lucide="check-circle-2"></i><span>Your plan is updated. We brought you back to the workflow you left. Anything that could not be restored is highlighted below.</span>';
    host.prepend(n);
    lucide.createIcons();
    setTimeout(() => n.remove(), 12000);
  }

  /* remember the last opened view for the Last Opened start preference */
  const rememberable = ["dash", "studio", "props", "designs", "explore", "scope", "products", "listings", "present", "reports"];
  const remember = () => {
    const v = (location.hash || "").replace(/^#/, "").replace(/^v-/, "");
    if (rememberable.includes(v)) setLastView(uid, v);
  };
  window.addEventListener("hashchange", remember);
  remember();

  /* Studio opened with no source and no workflow shows the chooser */
  document.querySelectorAll('.nav-i[data-v="studio"]').forEach((b) =>
    b.addEventListener("click", () => {
      const hasSource = !!document.querySelector("#cBefore img");
      if (!hasSource && state.mode === "hidden" && isOnboardingComplete(uid)) openChooser();
    }),
  );

  /* ---------- Start Page preference UI ---------- */
  mountStartPref(ctx);
}

/** Adds the Start Page control to the existing workspace Defaults pane. */
function mountStartPref(ctx: Ctx) {
  const pane = document.getElementById("p-defaults");
  if (!pane || document.getElementById("dfStart")) return;
  const grid = pane.querySelector(".grid.g2");
  if (!grid) return;
  const field = document.createElement("div");
  field.className = "field";
  field.innerHTML =
    "<label for=\"dfStart\">Start Page</label><select id=\"dfStart\">" +
    '<option value="smart">Smart</option><option value="dashboard">Dashboard</option>' +
    '<option value="studio">Studio</option><option value="last">Last Opened</option></select>' +
    '<p class="fu-help">Choose where REAL DESIGNS opens after a normal login. Links to a specific tool or project will still open their intended destination.</p>';
  grid.appendChild(field);
  const sel = field.querySelector("#dfStart") as HTMLSelectElement;
  ctx
    .prefsStart()
    .then((v) => {
      sel.value = v;
    })
    .catch(() => {});
  const help = field.querySelector(".fu-help") as HTMLElement;
  sel.addEventListener("change", async () => {
    ctx.track("start_page_preference_changed", { value: sel.value });
    try {
      await ctx.saveStart(sel.value);
      help.textContent = "Saved. REAL DESIGNS will open there after your next login.";
    } catch {
      help.textContent = "We could not save that preference. Try again.";
    }
  });
}
