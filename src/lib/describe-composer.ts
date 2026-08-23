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

import "@/styles/rd-describe.css";
import { areaByLabel, areaFitsSpace, areasForSpace, type CanvasSpace } from "@/lib/space-datasets";
import * as DS from "@/lib/describe-settings";
import { searchStyles } from "@/lib/canvas-style";

/** "Interior" | "Exterior" | "Garden" → the dataset key. */
export function spaceKey(space: string): CanvasSpace {
  const s = String(space || "").toLowerCase();
  return s === "exterior" || s === "garden" ? (s as CanvasSpace) : "interior";
}

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
  /** Style inspiration · Materials · Color palette · Layout inspiration. */
  role: DS.RefRole;
  status: "uploading" | "ready" | "error";
  progress: number;
  /** Durable storage URL once the upload finished. */
  remoteUrl?: string;
  /** Durable asset id / storage path used by the generation payload. */
  assetId?: string;
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
  /** Style inspiration · Materials · Color palette · Layout inspiration. */
  referenceRoles: string[];
  /** Durable ids so the server resolves the same assets on a retry. */
  referenceIds: string[];
  /** How closely the result should follow the references. */
  referenceStrength: string;

  /* The authoritative field names. */
  selectedSpace: string;
  selectedRoomType: string;
  selectedRoomTypeId: string;
  selectedStyleId: string;
  changeLevel: string;
  aspectRatio: string;
  optionCount: number;
  /** Mood and lighting, always sent because it is always visible. */
  moodLighting: string;

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
export const MAX_DESCRIBE_REFS = DS.MAX_REFS;

/** Contextual starting points. Clicking one only fills the description. */
export const DESCRIBE_EXAMPLES: string[] = [
  "Modern Luxury Kitchen",
  "Coastal Living Room",
  "Contemporary Exterior",
  "Resort-Style Backyard",
  "Warm Primary Bedroom",
];

export const DESCRIBE_PLACEHOLDER =
  "Describe the room or outdoor space you want to create. Include the style, materials, colors and important features.";

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
  /** Quiet, non-blocking notice. Falls back to alert when absent. */
  toast?: (msg: string) => void;
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
  const notice = (m: string) => (cfg.toast ? cfg.toast(m) : cfg.alert(m));

  const state = {
    prompt: "",
    /** Set by Improve Description so the rewrite is always recoverable. */
    undo: null as string | null,
    improving: false,
    /** Before / after text waiting for Apply or Keep Original. */
    impPreview: null as null | { before: string; after: string },
    /** Inline, recoverable failure of Improve Description. */
    impError: null as string | null,
    busy: false,
    refs: [] as DescribeRef[],
    strength: "Closely" as string,
    detailsOpen: false,
    /** Validation stays quiet until the user engages with the composer. */
    touched: false,
    space: "Interior" as string,
    room: "",
    roomId: "" as string,
    /** True when the room came from the description, not from a click. */
    roomDetected: false,
    /** True when the style came from the description, not from a click. */
    styleDetected: false,

    moodId: DS.DEFAULT_MOOD_ID,
    advOpen: false,
    /** "room" | "style" | null — the searchable View All browser. */
    browse: null as null | "room" | "style",
    browseQuery: "",
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
          roomId: state.roomId,
          moodId: state.moodId,
          roomDetected: state.roomDetected,
          styleDetected: state.styleDetected,
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
            .map((r) => ({
              id: r.id,
              name: r.name,
              url: r.remoteUrl,
              kind: r.kind,
              role: r.role,
              assetId: r.assetId,
            })),
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
      if (typeof d?.roomDetected === "boolean") state.roomDetected = d.roomDetected;
      if (typeof d?.styleDetected === "boolean") state.styleDetected = d.styleDetected;
      for (const k of [
        "strength",
        "space",
        "room",
        "roomId",
        "moodId",
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
            assetId: r.assetId ? String(r.assetId) : undefined,
            name: String(r.name || "Reference"),
            url: r.url,
            remoteUrl: r.url,
            kind: (REF_KINDS.some((k) => k.id === r.kind) ? r.kind : "inspiration") as RefKind,
            role: (DS.REF_ROLES.some((x) => x.id === r.role) ? r.role : "style") as DS.RefRole,
            status: "ready" as const,
            progress: 100,
          }));
    } catch (_) {
      /* a corrupt draft is simply ignored */
    }
  }

  loadDraft();
  ensureCamera();
  state.moodId = DS.ensureMood(state.moodId, state.space);
  if (state.room && !state.roomId) state.roomId = areaByLabel(state.room)?.id || "";
  /* A restored or preset description still selects the room and style it
     names, so Generate is never blocked by an invisible requirement. */
  if (state.prompt.trim()) {
    if (!state.roomId) {
      const a = DS.inferAreaFromPrompt(state.prompt, state.space);
      if (a) {
        state.roomId = a.id;
        state.room = a.label;
        state.roomDetected = true;
      }
    }
    if (!state.styleId) {
      const st = DS.inferStyleFromPrompt(state.prompt, state.space);
      if (st) {
        state.styleId = st.id;
        state.style = st.displayName;
        state.styleDetected = true;
      }
    }
  }

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
        role: roleForKind(kind || guessKind(file.name)),
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

  function roleForKind(kind: RefKind): DS.RefRole {
    if (kind === "material") return "materials";
    if (kind === "color") return "color";
    if (kind === "floorplan" || kind === "sketch") return "layout";
    return "style";
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
      if (remote) ref.assetId = remote;
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
    if (uploadsPending()) return "References are still uploading";
    if (uploadsFailed()) return "Retry or remove the reference that failed to upload";
    return DS.nextRequirement(settingsState());
  }

  function summary(): string {
    if (isVideo())
      return [state.room, state.camera, state.duration + " seconds", state.orientation]
        .filter(Boolean)
        .join(" · ");
    return DS.generationSummary(settingsState());
  }

  /** Left-hand footer text: the blocking requirement once the user has
      actually engaged, otherwise a quiet readiness line. Nothing shouts on
      first paint. */
  function footMessage(): string {
    const gap = missing();
    if (gap) return gap;
    return isVideo() ? summary() : DS.compactSummary(settingsState());
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

  function refCard(r: DescribeRef, i: number): string {
    return (
      '<figure class="sp-ref' +
      (r.status === "error" ? " is-error" : "") +
      (r.status === "uploading" ? " is-uploading" : "") +
      '" draggable="true" data-sp-refidx="' +
      i +
      '" data-sp-refid="' +
      esc(r.id) +
      '">' +
      '<img src="' +
      esc(r.url) +
      '" alt="' +
      esc(r.name) +
      '">' +
      '<button type="button" class="sp-ref-x" data-sp-refx="' +
      esc(r.id) +
      '" aria-label="Remove Reference" title="Remove"><i data-lucide="x"></i></button>' +
      (r.status === "uploading"
        ? '<div class="sp-ref-p"><i data-sp-refbar="' +
          esc(r.id) +
          '" style="width:' +
          r.progress +
          '%"></i></div>'
        : "") +
      (r.status === "error"
        ? '<div class="sp-ref-fail"><button type="button" data-sp-refretry="' +
          esc(r.id) +
          '">Retry</button><button type="button" data-sp-refx="' +
          esc(r.id) +
          '">Remove</button></div>'
        : "") +
      '<figcaption><select class="sp-ref-k" data-sp-refrole="' +
      esc(r.id) +
      '" aria-label="Reference Role">' +
      DS.REF_ROLES.map(
        (k) =>
          '<option value="' +
          k.id +
          '"' +
          (k.id === r.role ? " selected" : "") +
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

  /* ---------- design settings markup ---------- */

  function settingsState(): DS.SettingsState {
    return {
      prompt: state.prompt,
      refCount: state.refs.length,
      space: state.space,
      roomId: state.roomId || null,
      roomLabel: state.room,
      styleId: state.styleId || null,
      styleLabel: state.style,
      level: state.level,
      ratio: isVideo() ? ratioForOrientation(state.orientation) : state.ratio,
      options: state.options,
      moodId: state.moodId,
    };
  }

  function spaceSeg(): string {
    return (
      '<div class="rdset-row"><span class="rdset-l">Space</span>' +
      '<div class="rdset-seg" role="radiogroup" aria-label="Space">' +
      DS.SPACE_OPTIONS.map(
        (o) =>
          '<button type="button" class="rdset-segb' +
          (state.space === o.id ? " on" : "") +
          '" role="radio" aria-checked="' +
          (state.space === o.id) +
          '" data-sp-space="' +
          o.id +
          '"><i data-lucide="' +
          o.icon +
          '"></i>' +
          esc(o.id) +
          "</button>",
      ).join("") +
      "</div></div>"
    );
  }

  function roomCards(): string {
    const inferred = DS.inferAreaFromPrompt(state.prompt, state.space);
    const cards = DS.quickAreas(state.space, state.roomId, 4, { inferredId: inferred?.id ?? null });
    const label = DS.spaceKeyOf(state.space) === "interior" ? "Room Or Area" : "Area";
    return (
      '<div class="rdset-row" data-sp-sec="room"><header class="rdset-h"><span class="rdset-l">' +
      esc(label) +
      "</span>" +
      (state.roomDetected && state.room
        ? '<span class="rdset-note"><i data-lucide="sparkles"></i>Detected from description</span>'
        : "") +
      '<button type="button" class="rdset-all" data-sp="allroom">View All<i data-lucide="chevron-right"></i></button></header>' +
      '<div class="rdset-cards" role="listbox" aria-label="' +
      esc(label) +
      '">' +
      cards
        .map((a) => {
          const on = state.roomId === a.id;
          const img = DS.areaImage(a);
          return (
            '<button type="button" class="rdset-card' +
            (on ? " on" : "") +
            '" role="option" aria-selected="' +
            on +
            '" data-sp-room="' +
            esc(a.id) +
            '">' +
            (img
              ? '<img src="' + esc(img) + '" alt="' + esc(a.label) + '" loading="lazy">'
              : '<span class="rdset-ph"><i data-lucide="' + esc(a.icon) + '"></i></span>') +
            '<span class="rdset-cn">' +
            esc(a.label) +
            "</span>" +
            (on ? '<span class="rdset-ck"><i data-lucide="check"></i></span>' : "") +
            "</button>"
          );
        })
        .join("") +
      "</div></div>"
    );
  }

  function styleCards(): string {
    const inferred = DS.inferStyleFromPrompt(state.prompt, state.space);
    const cards = DS.quickStyleCards(state.space, state.styleId, 4, inferred?.id ?? null);
    return (
      '<div class="rdset-row" data-sp-sec="style"><header class="rdset-h"><span class="rdset-l">Design Style</span>' +
      (state.styleDetected && state.style
        ? '<span class="rdset-note"><i data-lucide="sparkles"></i>Detected from description</span>'
        : "") +
      '<button type="button" class="rdset-all" data-sp="allstyle">View All<i data-lucide="chevron-right"></i></button></header>' +
      '<div class="rdset-cards is-style" role="listbox" aria-label="Design Style">' +
      cards
        .map((st) => {
          const on = state.styleId === st.id;
          return (
            '<button type="button" class="rdset-card' +
            (on ? " on" : "") +
            '" role="option" aria-selected="' +
            on +
            '" data-sp-style="' +
            esc(st.id) +
            '">' +
            '<img src="' +
            esc(DS.styleImage(st, state.space)) +
            '" alt="' +
            esc(st.displayName) +
            '" loading="lazy">' +
            '<span class="rdset-cn">' +
            esc(st.displayName) +
            "</span>" +
            (on ? '<span class="rdset-ck"><i data-lucide="check"></i></span>' : "") +
            "</button>"
          );
        })
        .join("") +
      "</div></div>"
    );
  }


  function advanced(): string {
    const video = isVideo();
    return (
      '<div class="rdset-adv' +
      (state.advOpen ? " is-open" : "") +
      '"><button type="button" class="rdset-advh" data-sp="details" aria-expanded="' +
      (state.advOpen ? "true" : "false") +
      '"><span class="rdset-advt">Advanced Settings</span><span class="rdset-sum">' +
      esc(DS.advancedSummary(settingsState())) +
      '</span><i data-lucide="' +
      (state.advOpen ? "chevron-up" : "chevron-down") +
      '"></i></button>' +
      '<div class="rdset-advb"' +
      (state.advOpen ? "" : " hidden") +
      ">" +
      chipRow("Change level", "level", DESCRIBE_LEVELS, state.level) +
      (video
        ? '<div class="sp-video">' +
          chipRow("Camera movement", "cam", camerasForSpace(state.space), state.camera) +
          chipRow("Duration", "dur", DESCRIBE_DURATIONS, state.duration, "s") +
          chipRow("Orientation", "orient", DESCRIBE_ORIENTATIONS, state.orientation) +
          "</div>"
        : chipRow("Aspect ratio", "ratio", DESCRIBE_RATIOS, state.ratio)) +
      chipRow(
        video ? "Number of videos" : "Number of images",
        "opt",
        DESCRIBE_OPTION_COUNTS,
        state.options,
      ) +
      '<div class="sp-dopts rdset-moods"><span class="sp-dopt-l">Mood and lighting</span><div class="sp-chips">' +
      DS.moodsForSpace(state.space)
        .map(
          (m) =>
            '<button type="button" class="sp-chip' +
            (state.moodId === m.id ? " on" : "") +
            '" data-sp-mood="' +
            m.id +
            '" aria-pressed="' +
            (state.moodId === m.id) +
            '"><i data-lucide="' +
            m.icon +
            '"></i><span>' +
            esc(m.label) +
            "</span></button>",
        )
        .join("") +
      "</div></div>" +
      "</div></div>"
    );
  }

  /** The searchable View All browser for rooms and styles. */
  function browser(): string {
    if (!state.browse) return "";
    const room = state.browse === "room";
    const q = state.browseQuery;
    const rows = room
      ? DS.searchAreas(state.space, q).map(
          (a) =>
            '<button type="button" class="rdset-card' +
            (state.roomId === a.id ? " on" : "") +
            '" data-sp-room="' +
            esc(a.id) +
            '">' +
            (DS.areaImage(a)
              ? '<img src="' + esc(DS.areaImage(a) || "") + '" alt="' + esc(a.label) + '">'
              : '<span class="rdset-ph"><i data-lucide="' + esc(a.icon) + '"></i></span>') +
            '<span class="rdset-cn">' +
            esc(a.label) +
            "</span></button>",
        )
      : searchStyles(DS.stylePool(state.space), q).map(
          (st) =>
            '<button type="button" class="rdset-card' +
            (state.styleId === st.id ? " on" : "") +
            '" data-sp-style="' +
            esc(st.id) +
            '">' +
            '<img src="' +
            esc(DS.styleImage(st, state.space)) +
            '" alt="' +
            esc(st.displayName) +
            '">' +
            '<span class="rdset-cn">' +
            esc(st.displayName) +
            "</span>" +
            '<span class="rdset-cd">' +
            esc(st.shortDescription || "") +
            "</span></button>",
        );
    return (
      '<div class="rdset-modal" role="dialog" aria-modal="true" aria-label="' +
      (room ? "All Rooms And Areas" : "All Design Styles") +
      '"><div class="rdset-modal-c">' +
      '<header><h4>' +
      (room ? "All Rooms And Areas" : "All Design Styles") +
      '</h4><button type="button" class="rdset-x" data-sp="closebrowse" aria-label="Close"><i data-lucide="x"></i></button></header>' +
      '<input class="rdset-search" type="search" data-sp-f="browseq" placeholder="Search" value="' +
      esc(q) +
      '" aria-label="Search">' +
      '<div class="rdset-cards is-browse">' +
      (rows.join("") || '<p class="rdset-empty">Nothing matches that search.</p>') +
      "</div></div></div>"
    );
  }

  function html(): string {
    const showStarters = state.prompt.trim().length === 0;
    const improveOk = state.prompt.trim().length >= IMPROVE_MIN_CHARS;
    const st = settingsState();
    const gap = missing();
    return (
      '<div class="sp-pane sp-describe">' +
      '<div class="sp-dhead"><h3>Describe Your Space</h3>' +
      "<p>Describe what you want to create and optionally add reference images.</p></div>" +
      '<div class="sp-composer' +
      (state.busy ? " is-busy" : "") +
      '">' +
      '<textarea data-sp-f="prompt" aria-label="Describe Your Space" maxlength="' +
      DS.PROMPT_LIMIT +
      '" ' +
      (state.busy ? "disabled " : "") +
      'placeholder="' +
      esc(DESCRIBE_PLACEHOLDER) +
      '">' +
      esc(state.prompt) +
      "</textarea>" +
      (state.refs.length
        ? '<div class="sp-refs" aria-label="Attached References">' +
          state.refs.map((r, i) => refCard(r, i)).join("") +
          "</div>"
        : "") +
      '<div class="sp-composer-t">' +
      '<div class="sp-refwrap">' +
      '<button type="button" class="sp-tool" data-sp="addref"' +
      (state.refs.length >= MAX_DESCRIBE_REFS ? " disabled" : "") +
      ' aria-haspopup="true" aria-expanded="' +
      menuOpen +
      '"><i data-lucide="plus"></i>Add Reference</button>' +
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
      '<span class="sp-count" data-sp="count"' +
      (DS.showCharCount(state.prompt.length) ? "" : " hidden") +
      ">" +
      state.prompt.length +
      " / " +
      DS.PROMPT_LIMIT +
      "</span>" +
      (state.impError
        ? '<span class="sp-inline-err" role="alert">' + esc(state.impError) + "</span>"
        : "") +
      "</div>" +
      "</div>" +
      (state.impPreview
        ? '<div class="sp-improve-prev"><div><span class="rdset-l">Before</span><p>' +
          esc(state.impPreview.before) +
          '</p></div><div><span class="rdset-l">After</span><p>' +
          esc(state.impPreview.after) +
          '</p></div><div class="sp-improve-a"><button type="button" class="btn btn-sm btn-ghost" data-sp="impkeep">Keep Original</button><button type="button" class="btn btn-sm btn-primary" data-sp="impapply">Apply</button></div></div>'
        : "") +
      (state.refs.length
        ? '<div class="sp-dopts sp-strength"><span class="sp-dopt-l">Follow Reference</span><div class="sp-chips">' +
          DESCRIBE_STRENGTHS.map((x) => chip(x, "strength", x, state.strength === x)).join("") +
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
      '<section class="rdset"><h4 class="rdset-t">Design Settings</h4>' +
      spaceSeg() +
      roomCards() +
      styleCards() +
      advanced() +
      "</section>" +
      (uploadsFailed()
        ? '<p class="sp-warn">A reference did not finish uploading. Retry it or remove it before generating.</p>'
        : "") +
      '<div class="sp-describe-foot' +
      (gap ? " is-blocked" : "") +
      '">' +
      (gap
        ? '<button type="button" class="sp-meta sp-meta-fix" data-sp="fix">' +
          esc(gap) +
          "</button>"
        : '<span class="sp-meta">' + esc(DS.compactSummary(st)) + "</span>") +

      '<span class="sp-foot-r"><span class="sp-cost">' +
      esc(optionTotalLabel(output(), state.options)) +
      "</span>" +
      '<button type="button" class="btn btn-primary btn-sm sp-create" data-sp="describe" aria-label="' +
      esc(actionLabel()) +
      '"' +
      (state.busy ? " disabled" : "") +
      ">" +
      (state.busy
        ? '<span class="sp-spin" aria-hidden="true"></span>Generating…'
        : '<i data-lucide="sparkles"></i>' + esc(actionLabel())) +
      "</button></span>" +
      "</div>" +
      (state.preview
        ? '<div class="sp-lightbox" data-sp="closepreview"><img src="' +
          esc(state.preview) +
          '" alt="Reference Preview"></div>'
        : "") +
      browser() +
      "</div>"
    );
  }

  /* ---------- behaviour ---------- */

  async function submit() {
    if (state.busy) return;
    state.touched = true;
    const prompt = state.prompt.trim();
    const gap = missing();
    if (gap) {
      cfg.render();
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
        referenceRoles: state.refs.map((r) => r.role),
        referenceIds: state.refs.map((r) => r.assetId || r.remoteUrl || r.id),
        referenceStrength: state.strength,
        selectedSpace: state.space,
        selectedRoomType: state.room.trim(),
        selectedRoomTypeId: state.roomId,
        selectedStyleId: state.styleId || state.style.trim(),
        changeLevel: state.level,
        aspectRatio: ratio,
        optionCount: state.options,
        moodLighting: DS.moodLabel(state.moodId),
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
        mood: DS.moodLabel(state.moodId),
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
    state.impError = null;
    cfg.render();
    try {
      const better = await cfg.onImprove(prompt);
      const text = String(better || "").trim();
      /* Nothing is overwritten silently: the rewrite is offered as a
         before / after the user can apply or discard. */
      if (text && text !== prompt) state.impPreview = { before: prompt, after: text };
    } catch (err: any) {
      state.impError = (err && err.message) || "Could not improve that description.";
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
      ["mood", (v) => (state.moodId = v)],
      ["room", (v) => {
        const a = areasForSpace(spaceKey(state.space)).find((x) => x.id === v);
        if (a) {
          state.roomId = a.id;
          state.room = a.label;
          state.roomDetected = false;
          DS.rememberArea(a.id);
        }
        state.browse = null;
      }],
      ["style", (v) => {
        const rec = DS.stylePool(state.space).find((x) => x.id === v);
        if (rec) {
          state.styleId = rec.id;
          state.style = rec.displayName;
          state.styleDetected = false;
        }
        state.browse = null;
      }],

      ["space", (v) => {
        const lost = DS.incompatibleAfterSpace(
          { roomLabel: state.room, styleId: state.styleId },
          v,
        );
        state.space = v;
        state.moodId = DS.ensureMood(state.moodId, v);
        if (lost.length) notice("Choose a room and style for " + v + ".");
        /* An interior room or style can never survive a switch to Garden:
           the user is asked for an applicable replacement instead. */
        if (state.room && !areaFitsSpace(state.room, spaceKey(v))) {
          state.room = "";
          state.roomId = "";
        }
        state.style = "";
        state.styleId = "";
        state.styleDetected = false;

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
    if (act === "fix") {
      /* The footer message is the way back to whatever is still missing. */
      const target = DS.nextRequirementTarget(settingsState());
      const root = t.closest(".sp-describe") as HTMLElement | null;
      if (target === "prompt") {
        const ta = root?.querySelector('[data-sp-f="prompt"]') as HTMLTextAreaElement | null;
        ta?.scrollIntoView({ behavior: "smooth", block: "center" });
        ta?.focus();
      } else if (target) {
        const sec = root?.querySelector('[data-sp-sec="' + target + '"]') as HTMLElement | null;
        sec?.scrollIntoView({ behavior: "smooth", block: "center" });
        sec?.classList.add("is-wanted");
        setTimeout(() => sec?.classList.remove("is-wanted"), 1600);
      }
      return true;
    }


    if (act === "addref") {
      menuOpen = !menuOpen;
      cfg.render();
      return true;
    }
    if (act === "allroom" || act === "allstyle") {
      state.browse = act === "allroom" ? "room" : "style";
      state.browseQuery = "";
      cfg.render();
      return true;
    }
    if (act === "closebrowse") {
      state.browse = null;
      cfg.render();
      return true;
    }
    if (act === "impapply" || act === "impkeep") {
      if (act === "impapply" && state.impPreview) {
        state.undo = state.impPreview.before;
        state.prompt = state.impPreview.after;
        state.touched = true;
        saveDraft();
      }
      state.impPreview = null;
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
    if (act === "improvewrap") {
      /* The helper text sits inside the wrapper; clicking it does nothing
         else, but the click still belongs to the composer. */
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
      state.advOpen = !state.advOpen;
      cfg.render();
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
      state.touched = true;
      /* A room named in the description selects itself, visibly, and the
         user can still override it by clicking another card. */
      let changed = false;
      if (!state.roomId || state.roomDetected) {
        const found = DS.inferAreaFromPrompt(value, state.space);
        if (found && found.id !== state.roomId) {
          state.roomId = found.id;
          state.room = found.label;
          state.roomDetected = true;
          changed = true;
        }
      }
      /* Same for a style the user names, e.g. "modern luxury kitchen". */
      if (!state.styleId || state.styleDetected) {
        const st = DS.inferStyleFromPrompt(value, state.space);
        if (st && st.id !== state.styleId) {
          state.styleId = st.id;
          state.style = st.displayName;
          state.styleDetected = true;
          changed = true;
        }
      }
      if (changed) cfg.render();
      saveDraft();
      return true;

    }
    if (name === "browseq") {
      state.browseQuery = value;
      cfg.render();
      return true;
    }
    return false;
  }

  function onChange(t: HTMLElement): boolean {
    const id = (t.closest("[data-sp-refrole]") as HTMLElement | null)?.dataset?.["spRefrole"];
    if (!id) return false;
    const ref = state.refs.find((r) => r.id === id);
    if (ref) ref.role = (t as HTMLSelectElement).value as DS.RefRole;
    saveDraft();
    cfg.render();
    return true;
  }

  /** References are reordered by dragging the thumbnails. */
  function bindRefDrag(root: HTMLElement | null) {
    const cards = Array.from(
      root?.querySelectorAll("[data-sp-refidx]") || [],
    ) as HTMLElement[];
    for (const el of cards) {
      if (el.dataset["spDrag"]) continue;
      el.dataset["spDrag"] = "1";
      el.addEventListener("dragstart", (e) => {
        (e as DragEvent).dataTransfer?.setData("text/plain", el.dataset["spRefidx"] || "");
      });
      el.addEventListener("dragover", (e) => e.preventDefault());
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = Number((e as DragEvent).dataTransfer?.getData("text/plain"));
        const to = Number(el.dataset["spRefidx"]);
        if (Number.isNaN(from) || Number.isNaN(to) || from === to) return;
        state.refs = DS.reorder(state.refs, from, to);
        saveDraft();
        cfg.render();
      });
    }
  }

  /** Keeps the textarea height and the action states honest between renders. */
  function sync(root: HTMLElement | null) {
    const ta = root?.querySelector('[data-sp-f="prompt"]') as HTMLTextAreaElement | null;
    if (ta) {
      /* A compact resting height that grows with the text, then scrolls. */
      ta.style.height = "auto";
      ta.style.height = DS.promptHeight(ta.scrollHeight) + "px";
    }
    const count = root?.querySelector('[data-sp="count"]') as HTMLElement | null;
    if (count) {
      count.hidden = !DS.showCharCount(state.prompt.length);
      count.textContent = state.prompt.length + " / " + DS.PROMPT_LIMIT;
    }
    bindRefDrag(root);
    /* The browser re-renders as the user types, so the caret goes back. */
    const search = root?.querySelector(".rdset-search") as HTMLInputElement | null;
    if (search && document.activeElement !== search) {
      search.focus();
      const n = search.value.length;
      search.setSelectionRange(n, n);
    }
    const btn = root?.querySelector(".sp-create") as HTMLButtonElement | null;
    /* Generate is never silently disabled: clicking it says what is missing. */
    if (btn) btn.disabled = state.busy;
    const impOk = state.prompt.trim().length >= IMPROVE_MIN_CHARS;
    const imp = root?.querySelector('[data-sp="improve"]') as HTMLButtonElement | null;
    if (imp) imp.disabled = !impOk || state.improving || state.busy;
    const wrap = root?.querySelector('[data-sp="improvewrap"]') as HTMLElement | null;
    if (wrap) wrap.classList.toggle("is-off", !impOk);
    const foot = root?.querySelector(".sp-describe-foot") as HTMLElement | null;
    if (foot) foot.classList.toggle("is-blocked", !!(missing() && footMessage()));
    const meta = root?.querySelector(".sp-describe-foot .sp-meta") as HTMLElement | null;
    if (meta) meta.textContent = footMessage();
    const cost = root?.querySelector(".sp-describe-foot .sp-cost") as HTMLElement | null;
    if (cost) cost.textContent = optionTotalLabel(output(), state.options);
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
