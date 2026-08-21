/**
 * Describe composer.
 *
 * One focused creation surface for real estate: a large description, optional
 * reference images, and a single primary action. Everything here is written in
 * plain property language — no model names, no slash commands, no provider
 * settings. The composer owns one authoritative value per field so nothing is
 * asked twice, and it protects the user's work: references upload to durable
 * storage before generation, the draft survives a refresh, a failed generation
 * keeps the text and the references, and a retry reuses the same request id so
 * it can never be charged twice.
 *
 * The output type is NOT chosen here. The project-type card above the picker
 * (Design A Space / Create A Video) is the single authority; the composer only
 * reads it, so there can never be two independent output selectors.
 */

export type RefKind =
  | "inspiration"
  | "property"
  | "sketch"
  | "floorplan"
  | "material"
  | "color";

export const REF_KINDS: { id: RefKind; label: string }[] = [
  { id: "inspiration", label: "Inspiration Image" },
  { id: "property", label: "Existing Property Photo" },
  { id: "sketch", label: "Sketch" },
  { id: "floorplan", label: "Floor Plan" },
  { id: "material", label: "Material Reference" },
  { id: "color", label: "Color Reference" },
];

export type DescribeRef = {
  id: string;
  name: string;
  /** Local preview, always available even while the upload is in flight. */
  url: string;
  kind: RefKind;
  status: "uploading" | "ready" | "error";
  progress: number;
  /** Durable storage URL once the upload finished. */
  remoteUrl?: string;
  file?: File;
};

export type DescribeOutput = "image" | "video";

/** Which backend the generation belongs to. A written idea is never billed or
    routed as a property listing video. */
export type DescribeJob = "image" | "listing-video" | "ai-video";

/** Everything the composer collects alongside the description. */
export type DescribeDetails = {
  /** Durable reference URLs when storage is wired, local data URLs otherwise. */
  references: string[];
  referenceKinds: RefKind[];
  /** How closely the result should follow the references. */
  referenceStrength: string;

  /* The authoritative field names. */
  selectedSpace: string;
  selectedRoomType: string;
  selectedStyleId: string;
  changeLevel: string;
  aspectRatio: string;
  optionCount: number;

  /** image · listing-video · ai-video. Decides backend and credit price. */
  job: DescribeJob;
  output: DescribeOutput;
  camera: string;
  duration: number;
  orientation: string;
  credits: number;
  /** Stable across retries so the same work is never charged twice. */
  requestId: string;

  /* Kept for hosts that still read the old field names. */
  space: string;
  room: string;
  style: string;
  level: string;
  ratio: string;
  options: number;
  mood: string;
  features: string;
};

export const DESCRIBE_SPACES = ["Interior", "Exterior", "Garden"] as const;
export const DESCRIBE_LEVELS = ["Subtle", "Balanced", "Bold"] as const;
export const DESCRIBE_RATIOS = ["16:9", "1:1", "9:16", "4:5"] as const;
export const DESCRIBE_OPTION_COUNTS = [1, 2, 4] as const;
export const DESCRIBE_STRENGTHS = ["Loosely", "Closely", "Very Closely"] as const;
export const DESCRIBE_CAMERAS = [
  "Slow Push In",
  "Gentle Pan",
  "Walk Through",
  "Orbit Exterior",
  "Drone-Style Rise",
  "Golden Hour Reveal",
] as const;

/** A camera move has to be possible in the space. A drone rise inside a
    kitchen, or an exterior orbit around a living room, is never offered. */
export const CAMERAS_BY_SPACE: Record<string, string[]> = {
  Interior: ["Slow Push In", "Gentle Pan", "Walk Through"],
  Exterior: ["Gentle Pan", "Orbit Exterior", "Drone-Style Rise", "Golden Hour Reveal"],
  Garden: [
    "Slow Push In",
    "Gentle Pan",
    "Walk Through",
    "Drone-Style Rise",
    "Golden Hour Reveal",
  ],
};

export function camerasForSpace(space: string): string[] {
  return CAMERAS_BY_SPACE[space] || CAMERAS_BY_SPACE["Interior"]!;
}

export const DESCRIBE_DURATIONS = [5, 10, 15] as const;
export const DESCRIBE_ORIENTATIONS = ["Landscape", "Portrait", "Square"] as const;
export const MAX_DESCRIBE_REFS = 6;

/** Contextual starting points. Clicking one only fills the description. */
export const DESCRIBE_EXAMPLES: string[] = [
  "Modern Luxury Kitchen",
  "Coastal Living Room",
  "Contemporary Exterior",
  "Resort-Style Backyard",
  "Warm Primary Bedroom",
];

export const DESCRIBE_PLACEHOLDER =
  "Describe the room, exterior or outdoor space you want to create. Include the style, materials, colors and important features.";

/** Enough text to be worth rewriting. Below this, Improve stays disabled. */
export const IMPROVE_MIN_CHARS = 12;

/** One image credit per option; a video is the heavier job. */
export const IMAGE_CREDITS = 1;
export const VIDEO_CREDITS = 40;

export function describeCredits(output: DescribeOutput, options: number): number {
  return (output === "video" ? VIDEO_CREDITS : IMAGE_CREDITS) * Math.max(1, options);
}

export function ratioForOrientation(orientation: string): string {
  if (orientation === "Portrait") return "9:16";
  if (orientation === "Square") return "1:1";
  return "16:9";
}

/** "2 images · 2 credits" — the multiplication is never hidden. */
export function optionTotalLabel(output: DescribeOutput, options: number): string {
  const n = Math.max(1, options);
  const noun = output === "video" ? "video" : "image";
  const credits = describeCredits(output, n);
  return (
    n + " " + noun + (n === 1 ? "" : "s") + " · " + credits + (credits === 1 ? " credit" : " credits")
  );
}

type Cfg = {
  esc: (s: string) => string;
  alert: (msg: string) => void;
  /** Asks the picker to re-render. */
  render: () => void;
  /** Namespaced storage key so Design and Video keep separate drafts. */
  draftKey: string;
  /** The authoritative output type, owned by the project-type card. */
  output: () => DescribeOutput;
  onDescribe?: (prompt: string, details: DescribeDetails) => void | Promise<void>;
  onImprove?: (prompt: string) => Promise<string | void> | string | void;
  /** Uploads a reference to durable storage and returns its URL. */
  uploadReference?: (file: File) => Promise<string>;
  /** Opens the existing visual, searchable room / area picker. */
  openRoomPicker?: (space: string, current: string, apply: (label: string) => void) => void;
  /** Opens the existing visual, searchable style browser. */
  openStylePicker?: (
    space: string,
    room: string,
    currentId: string,
    apply: (styleId: string, label: string) => void,
  ) => void;
};

const rid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function createDescribeComposer(cfg: Cfg) {
  const esc = cfg.esc;

  const state = {
    prompt: "",
    /** Set by Improve Description so the rewrite is always recoverable. */
    undo: null as string | null,
    improving: false,
    busy: false,
    refs: [] as DescribeRef[],
    strength: "Closely" as string,
    detailsOpen: false,
    /** Validation stays quiet until the user engages with the composer. */
    touched: false,
    space: "Interior" as string,
    room: "",
    style: "",
    styleId: "",
    level: "Balanced" as string,
    ratio: "16:9",
    options: 1,
    camera: "Slow Push In",
    duration: 10,
    orientation: "Landscape",
    preview: null as string | null,
    /** Reused by a retry so a failed generation cannot double-charge. */
    requestId: rid("req_"),
  };

  const output = (): DescribeOutput => (cfg.output() === "video" ? "video" : "image");
  const isVideo = () => output() === "video";

  /* ---------- draft persistence ---------- */

  function store(): Storage | null {
    try {
      return typeof localStorage === "undefined" ? null : localStorage;
    } catch (_) {
      return null;
    }
  }

  function saveDraft() {
    const s = store();
    if (!s) return;
    try {
      s.setItem(
        cfg.draftKey,
        JSON.stringify({
          prompt: state.prompt,
          strength: state.strength,
          space: state.space,
          room: state.room,
          style: state.style,
          styleId: state.styleId,
          level: state.level,
          ratio: state.ratio,
          options: state.options,
          camera: state.camera,
          duration: state.duration,
          orientation: state.orientation,
          /* Only durable references survive a refresh; local blobs do not. */
          refs: state.refs
            .filter((r) => r.remoteUrl)
            .map((r) => ({ id: r.id, name: r.name, url: r.remoteUrl, kind: r.kind })),
        }),
      );
    } catch (_) {
      /* a full or blocked storage must never break the composer */
    }
  }

  function loadDraft() {
    const s = store();
    if (!s) return;
    try {
      const raw = s.getItem(cfg.draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as any;
      if (typeof d?.prompt === "string") state.prompt = d.prompt;
      for (const k of [
        "strength",
        "space",
        "room",
        "style",
        "styleId",
        "level",
        "ratio",
        "camera",
        "orientation",
      ] as const)
        if (typeof d?.[k] === "string") (state as any)[k] = d[k];
      if (Number(d?.options)) state.options = Number(d.options);
      if (Number(d?.duration)) state.duration = Number(d.duration);
      if (Array.isArray(d?.refs))
        state.refs = d.refs
          .filter((r: any) => r && typeof r.url === "string")
          .slice(0, MAX_DESCRIBE_REFS)
          .map((r: any) => ({
            id: String(r.id || rid("r_")),
            name: String(r.name || "Reference"),
            url: r.url,
            remoteUrl: r.url,
            kind: (REF_KINDS.some((k) => k.id === r.kind) ? r.kind : "inspiration") as RefKind,
            status: "ready" as const,
            progress: 100,
          }));
    } catch (_) {
      /* a corrupt draft is simply ignored */
    }
  }

  loadDraft();
  ensureCamera();

  /** Keeps the camera move possible in the currently selected space. */
  function ensureCamera() {
    const list = camerasForSpace(state.space);
    if (!list.includes(state.camera)) state.camera = list[0]!;
  }

  /* ---------- references ---------- */

  function readDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(new Error("read failed"));
      fr.readAsDataURL(file);
    });
  }

  async function addReferences(files: File[], replaceId?: string, kind?: RefKind) {
    const room = replaceId ? 1 : MAX_DESCRIBE_REFS - state.refs.length;
    if (room <= 0) {
      cfg.alert("You can attach up to " + MAX_DESCRIBE_REFS + " references.");
      return;
    }
    for (const file of files.slice(0, room)) {
      let url = "";
      try {
        url = await readDataUrl(file);
      } catch (_) {
        cfg.alert(file.name + ": This Reference Could Not Be Added.");
        continue;
      }
      const ref: DescribeRef = {
        id: replaceId || rid("r_"),
        name: file.name,
        url,
        kind: kind || guessKind(file.name),
        status: cfg.uploadReference ? "uploading" : "ready",
        progress: cfg.uploadReference ? 10 : 100,
        file,
      };
      if (replaceId) {
        const i = state.refs.findIndex((r) => r.id === replaceId);
        if (i > -1) {
          if (!kind) ref.kind = state.refs[i]!.kind;
          state.refs[i] = ref;
        } else state.refs.push(ref);
      } else state.refs.push(ref);
      cfg.render();
      void uploadRef(ref);
    }
    cfg.render();
    saveDraft();
  }

  function guessKind(name: string): RefKind {
    const n = name.toLowerCase();
    if (/floor.?plan|plan/.test(n)) return "floorplan";
    if (/sketch|draw/.test(n)) return "sketch";
    if (/material|tile|wood|stone/.test(n)) return "material";
    if (/color|colour|palette|swatch/.test(n)) return "color";
    return "inspiration";
  }

  /** Puts a reference in durable storage so generation never depends on the tab. */
  async function uploadRef(ref: DescribeRef) {
    if (!cfg.uploadReference || !ref.file) {
      ref.status = "ready";
      ref.progress = 100;
      return;
    }
    ref.status = "uploading";
    ref.progress = 15;
    cfg.render();
    const tick = setInterval(() => {
      if (ref.status !== "uploading") return;
      ref.progress = Math.min(90, ref.progress + 12);
      paintProgress(ref);
    }, 350);
    try {
      const remote = await cfg.uploadReference(ref.file);
      ref.remoteUrl = remote || ref.url;
      ref.status = "ready";
      ref.progress = 100;
      saveDraft();
    } catch (_) {
      /* Recoverable: the thumbnail stays with a visible Retry action. */
      ref.status = "error";
    } finally {
      clearInterval(tick);
      cfg.render();
    }
  }

  /** Progress moves without a full re-render so typing is never interrupted. */
  function paintProgress(ref: DescribeRef) {
    const bar = document.querySelector(
      '[data-sp-refbar="' + ref.id + '"]',
    ) as HTMLElement | null;
    if (bar) bar.style.width = ref.progress + "%";
  }

  const uploadsPending = () => state.refs.some((r) => r.status === "uploading");
  const uploadsFailed = () => state.refs.some((r) => r.status === "error");

  /* ---------- derived ---------- */

  const credits = () => describeCredits(output(), state.options);

  /** A written idea is an AI video; a video built from the property's own
      photos is a listing video. They are different backends and prices. */
  function job(): DescribeJob {
    if (!isVideo()) return "image";
    return state.refs.some((r) => r.kind === "property") ? "listing-video" : "ai-video";
  }

  function actionLabel(): string {
    const j = job();
    if (j === "listing-video") return "Create Listing Video";
    if (j === "ai-video") return "Generate AI Video";
    return "Generate";
  }

  /** What still has to happen before Generate can do anything. The details
      are genuinely optional: only a description is required. */
  function missing(): string | null {
    if (!state.prompt.trim()) return "Add a description to continue";
    if (uploadsPending()) return "References are still uploading";
    if (uploadsFailed()) return "Retry or remove the reference that failed to upload";
    return null;
  }

  function summary(): string {
    const parts: string[] = [];
    if (state.room) parts.push(state.room);
    if (isVideo()) {
      parts.push(state.camera, state.duration + " seconds", state.orientation);
    } else {
      if (state.style) parts.push(state.style);
      parts.push(state.level, state.ratio);
    }
    return parts.join(" · ");
  }

  /** Left-hand footer text: the blocking requirement once the user has
      actually engaged, otherwise a quiet readiness line. Nothing shouts on
      first paint. */
  function footMessage(): string {
    const gap = missing();
    if (gap) return state.touched ? gap + "." : "";
    return summary();
  }

  const ready = () => !missing() && !state.busy;


  /* ---------- html ---------- */

  const chip = (label: string, attr: string, value: string | number, on: boolean, title = "") =>
    '<button type="button" class="sp-chip' +
    (on ? " on" : "") +
    '" data-sp-' +
    attr +
    '="' +
    esc(String(value)) +
    '" aria-pressed="' +
    on +
    '"' +
    (title ? ' title="' + esc(title) + '"' : "") +
    ">" +
    esc(label) +
    "</button>";

  const chipRow = (
    label: string,
    attr: string,
    values: readonly (string | number)[],
    current: string | number,
    suffix = "",
  ) =>
    '<div class="sp-dopts"><span class="sp-dopt-l">' +
    esc(label) +
    '</span><div class="sp-chips">' +
    values.map((v) => chip(String(v) + suffix, attr, v, String(v) === String(current))).join("") +
    "</div></div>";

  function refCard(r: DescribeRef): string {
    return (
      '<figure class="sp-ref' +
      (r.status === "error" ? " is-error" : "") +
      (r.status === "uploading" ? " is-uploading" : "") +
      '" data-sp-refid="' +
      esc(r.id) +
      '">' +
      '<img src="' +
      esc(r.url) +
      '" alt="' +
      esc(r.name) +
      '">' +
      '<div class="sp-ref-a">' +
      '<button type="button" class="sp-ref-b" data-sp-refview="' +
      esc(r.id) +
      '" aria-label="Preview Reference" title="Preview"><i data-lucide="eye"></i></button>' +
      '<button type="button" class="sp-ref-b" data-sp-refswap="' +
      esc(r.id) +
      '" aria-label="Replace Reference" title="Replace"><i data-lucide="repeat"></i></button>' +
      '<button type="button" class="sp-ref-b" data-sp-refx="' +
      esc(r.id) +
      '" aria-label="Remove Reference" title="Remove"><i data-lucide="x"></i></button>' +
      "</div>" +
      (r.status === "uploading"
        ? '<div class="sp-ref-p"><i data-sp-refbar="' +
          esc(r.id) +
          '" style="width:' +
          r.progress +
          '%"></i></div>'
        : "") +
      (r.status === "error"
        ? '<button type="button" class="sp-ref-retry" data-sp-refretry="' +
          esc(r.id) +
          '">Upload Failed · Retry</button>'
        : "") +
      '<figcaption><select class="sp-ref-k" data-sp-refkind="' +
      esc(r.id) +
      '" aria-label="Reference Type">' +
      REF_KINDS.map(
        (k) =>
          '<option value="' +
          k.id +
          '"' +
          (k.id === r.kind ? " selected" : "") +
          ">" +
          esc(k.label) +
          "</option>",
      ).join("") +
      "</select></figcaption>" +
      "</figure>"
    );
  }

  /** The Add Reference menu doubles as the only place a floor plan is added. */
  function refMenu(): string {
    return (
      '<div class="sp-refmenu" role="menu">' +
      REF_KINDS.map(
        (k) =>
          '<button type="button" role="menuitem" data-sp-refkindpick="' +
          k.id +
          '">' +
          esc(k.label) +
          "</button>",
      ).join("") +
      "</div>"
    );
  }

  let menuOpen = false;

  function html(): string {
    const showStarters = state.prompt.trim().length === 0;
    const video = isVideo();
    const improveOk = state.prompt.trim().length >= IMPROVE_MIN_CHARS;
    return (
      '<div class="sp-pane sp-describe">' +
      '<div class="sp-dhead"><h3>Describe Your Space</h3>' +
      "<p>Describe what you want to create and optionally add reference images.</p></div>" +
      '<div class="sp-composer' +
      (state.busy ? " is-busy" : "") +
      '">' +
      (state.refs.length
        ? '<div class="sp-refs" aria-label="Attached References">' +
          state.refs.map(refCard).join("") +
          "</div>"
        : "") +
      '<textarea data-sp-f="prompt" aria-label="Describe Your Space" ' +
      (state.busy ? "disabled " : "") +
      'placeholder="' +
      esc(DESCRIBE_PLACEHOLDER) +
      '">' +
      esc(state.prompt) +
      "</textarea>" +
      '<div class="sp-composer-t">' +
      '<div class="sp-refwrap">' +
      '<button type="button" class="sp-tool" data-sp="addref"' +
      (state.refs.length >= MAX_DESCRIBE_REFS ? " disabled" : "") +
      ' aria-haspopup="true" aria-expanded="' +
      menuOpen +
      '"><i data-lucide="plus"></i>Add Reference <span class="sp-opt">Optional</span></button>' +
      (menuOpen ? refMenu() : "") +
      "</div>" +
      '<span class="sp-toolwrap' +
      (improveOk ? "" : " is-off") +
      '" data-sp="improvewrap" tabindex="0">' +
      '<button type="button" class="sp-tool" data-sp="improve"' +
      (improveOk && !state.improving && !state.busy ? "" : " disabled") +
      ">" +
      (state.improving
        ? '<span class="sp-spin dark" aria-hidden="true"></span>Improving…'
        : '<i data-lucide="wand-sparkles"></i>Improve Description') +
      "</button>" +
      (improveOk
        ? ""
        : '<span class="sp-tip" role="note">Write a short description first.</span>') +
      "</span>" +
      (state.undo
        ? '<button type="button" class="sp-tool" data-sp="undo"><i data-lucide="undo-2"></i>Restore Original</button>'
        : "") +
      "</div>" +
      "</div>" +
      (state.refs.length
        ? '<div class="sp-dopts sp-strength"><span class="sp-dopt-l" title="Controls how closely the generated design follows the reference\u2019s style and composition.">Follow Reference <i data-lucide="info"></i></span><div class="sp-chips">' +
          DESCRIBE_STRENGTHS.map((s) =>
            chip(
              s,
              "strength",
              s,
              state.strength === s,
              "How closely the design follows the reference’s style and composition.",
            ),
          ).join("") +
          "</div></div>"
        : "") +
      (showStarters
        ? '<div class="sp-try"><span class="sp-try-l">Start With An Example</span><div class="sp-chips">' +
          DESCRIBE_EXAMPLES.slice(0, 5)
            .map(
              (x) =>
                '<button type="button" class="sp-chip" data-sp-ex="' +
                esc(x) +
                '">' +
                esc(x) +
                "</button>",
            )
            .join("") +
          "</div></div>"
        : "") +
      '<details class="sp-details"' +
      (state.detailsOpen ? " open" : "") +
      '><summary data-sp="details">Add Details <span class="sp-opt">Optional</span></summary>' +
      chipRow("Space", "space", DESCRIBE_SPACES, state.space) +
      '<div class="sp-dgrid">' +
      dSelect("room", "Room Or Area", state.room, "Select Room Or Area") +
      dSelect("style", "Design Style", state.style, "Select Design Style") +
      "</div>" +
      chipRow("Change Level", "level", DESCRIBE_LEVELS, state.level) +
      (video
        ? '<div class="sp-video">' +
          chipRow("Camera Movement", "cam", camerasForSpace(state.space), state.camera) +
          chipRow("Duration", "dur", DESCRIBE_DURATIONS, state.duration, "s") +
          chipRow("Orientation", "orient", DESCRIBE_ORIENTATIONS, state.orientation) +
          '<p class="sp-hint">Orientation sets the video shape: ' +
          esc(ratioForOrientation(state.orientation)) +
          ".</p>" +
          "</div>"
        : chipRow("Aspect Ratio", "ratio", DESCRIBE_RATIOS, state.ratio)) +
      chipRow(
        video ? "Number Of Videos" : "Number Of Images",
        "opt",
        DESCRIBE_OPTION_COUNTS,
        state.options,
      ) +
      "</details>" +
      (uploadsFailed()
        ? '<p class="sp-warn">A reference did not finish uploading. Retry it or remove it before generating.</p>'
        : "") +
      '<div class="sp-describe-foot' +
      (footMessage() && missing() ? " is-blocked" : "") +
      '">' +
      '<span class="sp-meta">' +
      esc(footMessage()) +
      "</span>" +
      '<span class="sp-foot-r"><span class="sp-cost">' +
      esc(optionTotalLabel(output(), state.options)) +
      "</span>" +
      '<button type="button" class="btn btn-primary btn-sm sp-create" data-sp="describe" aria-label="' +
      esc(actionLabel()) +
      '"' +
      (ready() ? "" : " disabled") +
      ">" +
      (state.busy
        ? '<span class="sp-spin" aria-hidden="true"></span>Generating…'
        : uploadsPending()
          ? '<span class="sp-spin" aria-hidden="true"></span>Uploading References…'
          : '<i data-lucide="sparkles"></i>' + esc(actionLabel())) +
      "</button></span>" +
      "</div>" +
      (state.preview
        ? '<div class="sp-lightbox" data-sp="closepreview"><img src="' +
          esc(state.preview) +
          '" alt="Reference Preview"></div>'
        : "") +
      "</div>"
    );
  }

  /** A real selector, not a text field: it opens the visual picker. */
  function dSelect(name: string, label: string, value: string, ph: string) {
    return (
      '<div class="sp-dfield"><span>' +
      esc(label) +
      '</span><button type="button" class="sp-dpick' +
      (value ? " has" : "") +
      '" data-sp="pick' +
      name +
      '" aria-haspopup="dialog"><span>' +
      esc(value || ph) +
      '</span><i data-lucide="chevron-down"></i></button></div>'
    );
  }

  /* ---------- behaviour ---------- */

  async function submit() {
    if (state.busy) return;
    const prompt = state.prompt.trim();
    if (!prompt) return;
    if (uploadsPending()) {
      cfg.alert("References are still uploading. They will be ready in a moment.");
      return;
    }
    if (uploadsFailed()) {
      cfg.alert("Retry or remove the reference that failed to upload.");
      return;
    }
    const gap = missing();
    if (gap) {
      cfg.alert(gap + ".");
      return;
    }
    state.busy = true;
    cfg.render();
    const ratio = isVideo() ? ratioForOrientation(state.orientation) : state.ratio;
    try {
      /* Nothing is charged here: credits are taken only when the server
         accepts the job, and a retry reuses the same request id. */
      await cfg.onDescribe?.(prompt, {
        references: state.refs.map((r) => r.remoteUrl || r.url),
        referenceKinds: state.refs.map((r) => r.kind),
        referenceStrength: state.strength,
        selectedSpace: state.space,
        selectedRoomType: state.room.trim(),
        selectedStyleId: state.styleId || state.style.trim(),
        changeLevel: state.level,
        aspectRatio: ratio,
        optionCount: state.options,
        job: job(),
        output: output(),
        camera: state.camera,
        duration: state.duration,
        orientation: state.orientation,
        credits: credits(),
        requestId: state.requestId,
        space: state.space,
        room: state.room.trim(),
        style: state.style.trim(),
        level: state.level,
        ratio,
        options: state.options,
        mood: "",
        features: "",
      });
      /* Accepted work gets a fresh id; the description stays for the next idea. */
      state.requestId = rid("req_");
      saveDraft();
    } catch (err: any) {
      /* The description and references are deliberately left untouched, and
         the request id is kept so a retry can never be charged twice. */
      cfg.alert((err && err.message) || "Could not create that. Your description was kept.");
    } finally {
      state.busy = false;
      cfg.render();
    }
  }

  async function improve() {
    if (state.improving || state.busy) return;
    const prompt = state.prompt.trim();
    if (prompt.length < IMPROVE_MIN_CHARS || !cfg.onImprove) return;
    state.improving = true;
    cfg.render();
    try {
      const better = await cfg.onImprove(prompt);
      const text = String(better || "").trim();
      if (text) {
        state.undo = prompt;
        state.prompt = text;
        saveDraft();
      }
    } catch (err: any) {
      cfg.alert((err && err.message) || "Could not improve that description.");
    } finally {
      state.improving = false;
      cfg.render();
    }
  }

  /** Returns true when the click belonged to the composer. */
  function onClick(t: HTMLElement, pick: (replaceId?: string, kind?: RefKind) => void): boolean {
    const hit = (attr: string) =>
      (t.closest("[data-sp-" + attr + "]") as HTMLElement | null)?.dataset?.[
        "sp" + attr.charAt(0).toUpperCase() + attr.slice(1)
      ];

    const refKindPick = hit("refkindpick");
    if (refKindPick) {
      menuOpen = false;
      pick(undefined, refKindPick as RefKind);
      cfg.render();
      return true;
    }
    const refx = hit("refx");
    if (refx) {
      state.refs = state.refs.filter((r) => r.id !== refx);
      saveDraft();
      cfg.render();
      return true;
    }
    const view = hit("refview");
    if (view) {
      state.preview = state.refs.find((r) => r.id === view)?.url || null;
      cfg.render();
      return true;
    }
    const swap = hit("refswap");
    if (swap) {
      pick(swap);
      return true;
    }
    const retry = hit("refretry");
    if (retry) {
      const ref = state.refs.find((r) => r.id === retry);
      if (ref) void uploadRef(ref);
      return true;
    }
    const ex = hit("ex");
    if (ex) {
      /* A starting point only fills the description. Nothing generates. */
      state.prompt = ex;
      saveDraft();
      cfg.render();
      return true;
    }
    const set: [string, (v: string) => void][] = [
      ["strength", (v) => (state.strength = v)],
      ["space", (v) => {
        state.space = v;
        ensureCamera();
      }],
      ["level", (v) => (state.level = v)],
      ["ratio", (v) => (state.ratio = v)],
      ["opt", (v) => (state.options = Number(v) || 1)],
      ["cam", (v) => (state.camera = v)],
      ["dur", (v) => (state.duration = Number(v) || 10)],
      ["orient", (v) => (state.orientation = v)],
    ];
    for (const [attr, apply] of set) {
      const v = hit(attr);
      if (v != null) {
        apply(v);
        state.detailsOpen = state.detailsOpen || isDetail(attr);
        saveDraft();
        cfg.render();
        return true;
      }
    }
    const act = (t.closest("[data-sp]") as HTMLElement | null)?.dataset?.["sp"];
    if (act === "describe") {
      void submit();
      return true;
    }
    if (act === "addref") {
      menuOpen = !menuOpen;
      cfg.render();
      return true;
    }
    if (act === "pickroom") {
      state.detailsOpen = true;
      if (cfg.openRoomPicker)
        cfg.openRoomPicker(state.space, state.room, (label) => {
          state.room = label;
          saveDraft();
          cfg.render();
        });
      else cfg.alert("The room library is not available here yet.");
      return true;
    }
    if (act === "pickstyle") {
      state.detailsOpen = true;
      if (cfg.openStylePicker)
        cfg.openStylePicker(state.space, state.room, state.styleId, (id, label) => {
          state.styleId = id;
          state.style = label || id;
          saveDraft();
          cfg.render();
        });
      else cfg.alert("The style library is not available here yet.");
      return true;
    }
    if (act === "improve") {
      void improve();
      return true;
    }
    if (act === "undo") {
      if (state.undo != null) {
        state.prompt = state.undo;
        state.undo = null;
        saveDraft();
        cfg.render();
      }
      return true;
    }
    if (act === "details") {
      state.detailsOpen = !state.detailsOpen;
      return true;
    }
    if (act === "closepreview") {
      state.preview = null;
      cfg.render();
      return true;
    }
    if (menuOpen) {
      menuOpen = false;
      cfg.render();
    }
    return false;
  }

  const isDetail = (attr: string) =>
    attr === "space" ||
    attr === "level" ||
    attr === "ratio" ||
    attr === "opt" ||
    attr === "cam" ||
    attr === "dur" ||
    attr === "orient";

  /** Returns true when the input belonged to the composer. */
  function onInput(name: string, value: string): boolean {
    if (name === "prompt") {
      state.prompt = value;
      saveDraft();
      return true;
    }
    return false;
  }

  function onChange(t: HTMLElement): boolean {
    const id = (t.closest("[data-sp-refkind]") as HTMLElement | null)?.dataset?.["spRefkind"];
    if (!id) return false;
    const ref = state.refs.find((r) => r.id === id);
    if (ref) ref.kind = (t as HTMLSelectElement).value as RefKind;
    saveDraft();
    cfg.render();
    return true;
  }

  /** Keeps the textarea height and the action states honest between renders. */
  function sync(root: HTMLElement | null) {
    const ta = root?.querySelector('[data-sp-f="prompt"]') as HTMLTextAreaElement | null;
    if (ta) {
      /* A compact resting height that grows with the text. */
      ta.style.height = "auto";
      ta.style.height = Math.min(Math.max(ta.scrollHeight, 58), 260) + "px";
    }
    const btn = root?.querySelector(".sp-create") as HTMLButtonElement | null;
    if (btn) btn.disabled = !ready();
    const imp = root?.querySelector('[data-sp="improve"]') as HTMLButtonElement | null;
    if (imp)
      imp.disabled =
        state.prompt.trim().length < IMPROVE_MIN_CHARS || state.improving || state.busy;
    const meta = root?.querySelector(".sp-describe-foot .sp-meta") as HTMLElement | null;
    if (meta) meta.textContent = summary();
  }

  return {
    state,
    html,
    onClick,
    onInput,
    onChange,
    sync,
    submit,
    improve,
    addReferences,
    credits,
    summary,
    missing,
    actionLabel,
    job,
  };
}
