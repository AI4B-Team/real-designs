/**
 * One shared source picker.
 *
 * Every import surface in REAL DESIGNS offers the same six sources, the same
 * dropzone, the same error handling and the same upload pipeline. Which
 * sources appear, which file types are accepted and whether one or many images
 * can be chosen is configured per context, never re-implemented.
 *
 * Listing URLs are read as text only. No media is ever imported from a public
 * listing page, in any context.
 */

import { DRIVE_ICON, DROPBOX_ICON } from "@/lib/brand-icons";
import { measureImage, classify, FLAG_LABEL } from "@/lib/media-analysis";
import { MAX_FILE_MB, rejectReason } from "@/lib/upload-manager";
import { splitAddressLines, photoCountLabel, type ProjectAddress } from "@/lib/property-address";

export type SourceId = "upload" | "cloud" | "address" | "url" | "property" | "design" | "describe";
export type PickerContext = "design" | "video" | "property-media" | "batch";

export type PickedFile = { file: File; flags: string[] };

export const SOURCE_META: Record<
  SourceId,
  { icon: string; label: string; tab: string; desc: string }
> = {
  upload: {
    icon: "upload-cloud",
    label: "Upload",
    tab: "Upload",
    desc: "Drag and drop or browse.",
  },
  cloud: {
    icon: "cloud",
    label: "Google Drive",
    tab: "Google Drive",
    desc: "Import photos from your Google Drive.",
  },
  address: {
    icon: "map-pin",
    label: "Property Address",
    tab: "Address",
    desc: "Fills in address and listing details.",
  },
  url: {
    icon: "link",
    label: "Listing Link",
    tab: "Listing Link",
    desc: "Zillow, Realtor.com, supported MLS or a public listing gallery URL.",
  },
  property: {
    icon: "home",
    label: "Existing Property",
    tab: "Property",
    desc: "Reuse photos already uploaded.",
  },
  design: {
    icon: "images",
    label: "Designs",
    tab: "Designs",
    desc: "Start from designs you have already generated.",
  },
  describe: {
    icon: "message-square-text",
    label: "Describe",
    tab: "Describe",
    desc: "No photo yet: describe the space instead.",
  },
};

export type ContextConfig = {
  sources: SourceId[];
  multiple: boolean;
  accept: string;
  acceptHint: string;
};

/** Chrome greys out .heic when accept is image/*, so list extensions explicitly. */
const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif";

export const CONTEXT_CONFIG: Record<PickerContext, ContextConfig> = {
  design: {
    sources: ["upload", "cloud", "property", "describe"],
    /* Many photos are handed to the staging review grid, never dropped. */
    multiple: true,
    accept: IMAGE_ACCEPT + ",application/pdf,.pdf",
    acceptHint: "JPG, PNG, HEIC, WEBP, PDF",
  },
  video: {
    sources: ["upload", "cloud", "property", "design", "url"],
    multiple: true,
    accept: IMAGE_ACCEPT,
    acceptHint: "JPG, PNG, HEIC, WEBP",
  },
  "property-media": {
    sources: ["upload", "cloud", "address"],
    multiple: true,
    accept: IMAGE_ACCEPT,
    acceptHint: "JPG, PNG, HEIC, WEBP",
  },
  batch: {
    sources: ["upload", "cloud", "address", "property"],
    multiple: true,
    accept: IMAGE_ACCEPT,
    acceptHint: "JPG, PNG, HEIC, WEBP",
  },
};

/** Browsers other than Safari cannot decode HEIC. Convert once, on the way in,
    so every downstream preview, thumbnail and upload is a normal JPEG. */
export async function normalizeImageFile(f: File): Promise<File> {
  const isHeic = /\.(heic|heif)$/i.test(f.name) || /image\/hei[cf]/i.test(f.type || "");
  if (!isHeic) return f;
  try {
    const { default: heic2any } = await import("heic2any");
    const blob: any = await heic2any({ blob: f, toType: "image/jpeg", quality: 0.9 });
    const out = Array.isArray(blob) ? blob[0] : blob;
    if (!out) throw new Error("No converted image was returned.");
    return new File([out], f.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
  } catch (_) {
    throw new Error(
      f.name + ": This HEIC Photo Could Not Be Converted. Export It As JPG And Try Again.",
    );
  }
}

export const MAX_MB = MAX_FILE_MB;

/** One selectable property (or the Unassigned Photos utility card). */
export type PickerProperty = {
  id?: string;
  address: string;
  /** Legacy free-text meta such as "12 Photos"; prefer count. */
  meta?: string;
  /** Structured address fields, used before the free-text address. */
  parts?: Partial<ProjectAddress> | null;
  count?: number | null;
  /** Storage path of a representative photo. */
  thumb?: string | null;
  /** Up to four storage paths, used for the Unassigned mosaic. */
  thumbs?: string[] | null;

  unassigned?: boolean;
  /** Filled in by the picker. */
  line1?: string;
  line2?: string;
};

export type PickerPhoto = { id: string; path: string; name?: string; room?: string };

/** One completed, generated design that can become a video scene. */
export type PickerDesign = {
  id: string;
  /** Storage path or displayable URL of the generated image. */
  path: string;
  /** Source photo, when the design was staged from one. */
  beforePath?: string | null;
  room: string;
  address?: string | null;
  propertyId?: string | null;
  createdAt?: string | null;
  versionId?: string | null;
};

/** One photo in the upload-card stack: a bundled example or a stored path. */
export type HeroPhoto = { src?: string; path?: string; alt: string };

/** Context-aware copy and photography for the upload workspace card. */
export type PickerHero = {
  variant?: "design" | "video";
  title: string;
  copy: string;
  /** Back, middle then front. Three photos read best. */
  stack: HeroPhoto[];
  /** True once the stack shows the user's own photos, not examples. */
  isUser?: boolean;
};

export type PickerOptions = {
  /** Turns the plain dropzone into the two-column upload workspace card. */
  hero?: () => PickerHero | null;
  context: PickerContext;
  esc: (s: string) => string;
  lucide?: { createIcons: (o?: any) => void };
  /** Properties already in the workspace, for the property source. */
  properties?: () => Array<PickerProperty>;
  /** Photos of one property. When present, choosing a property opens a
      selection panel instead of importing everything. */
  loadPropertyPhotos?: (p: PickerProperty) => Promise<PickerPhoto[]>;
  /** Resolves a storage path into a displayable URL (signed, cached). */
  resolvePhoto?: (path: string) => Promise<string | null>;
  /** Called with the photos the user confirmed for a property. */
  onPropertyPhotos?: (p: PickerProperty, photos: PickerPhoto[]) => void | Promise<void>;

  /** Finished designs, for the design source (legacy synchronous list). */
  designs?: () => Array<{ id: string; label: string; sub?: string; badge?: string }>;
  /** Finished designs read from the database, for the design source. */
  loadDesigns?: () => Promise<PickerDesign[]>;
  /** Called with the finished designs the user selected, in order. */
  onDesigns?: (designs: PickerDesign[]) => void | Promise<void>;
  /** Which source opens first, so a host can remember the tab across renders. */
  initialTab?: SourceId;
  onTab?: (tab: SourceId) => void;
  /** Called with everything the user picked, after measurement. */
  onPick: (picked: PickedFile[]) => void | Promise<void>;
  /** Advisory quality flags, measured after onPick so intake never blocks. */
  onFlags?: (picked: PickedFile[]) => void;

  /** Called when the user chooses an existing property instead of files. */
  onProperty?: (address: string) => void;
  /** Called when the user chooses a finished design. */
  onDesign?: (id: string) => void;
  /** Called when the user writes an idea instead of adding photos. */
  onDescribe?: (prompt?: string, details?: DescribeDetails) => void | Promise<void>;
  /** Optional AI rewrite of the description. Returns the improved text. */
  onImprove?: (prompt: string) => Promise<string | void> | string | void;
  /** Optional "Try A Sample Space" affordance under the dropzone. */
  onSample?: () => void;
  showAlert?: (msg: string) => void;
};

/** Everything the Describe composer collects alongside the prompt. */
export type DescribeDetails = {
  /** Reference images as data URLs, styling inspiration only. */
  references: string[];
  room: string;
  style: string;
  mood: string;
  features: string;
  ratio: string;
  options: number;
};

export const DESCRIBE_RATIOS = ["16:9", "1:1", "9:16", "4:5"] as const;
export const DESCRIBE_OPTION_COUNTS = [1, 2, 4] as const;
export const MAX_DESCRIBE_REFS = 3;

/** Quiet starting points under the describe composer. */
export const DESCRIBE_EXAMPLES: string[] = ["Modern Kitchen", "Luxury Exterior", "Resort Backyard"];


const esc0 = (v: string) =>
  String(v == null ? "" : v).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );

let pickerSeq = 0;

export function mountSourcePicker(host: HTMLElement, opts: PickerOptions) {
  const cfg = CONTEXT_CONFIG[opts.context];
  /* Several pickers can live in the DOM at once (Studio, Video, Listings).
     Element ids must stay unique per instance, and every lookup must be
     scoped to this picker, or a hidden picker answers for the visible one. */
  const uid = "p" + ++pickerSeq;
  const pid = (name: string) => name + "-" + uid;
  /* Field lookups go through data attributes inside this picker only. */
  const field = (name: string) =>
    (body?.querySelector('[data-sp-f="' + name + '"]') as
      HTMLInputElement | HTMLTextAreaElement | null) || null;
  const fieldName = (t: Element | null) => (t as HTMLElement | null)?.dataset?.["spF"] || "";
  let escFail = false;
  const esc = (v: string) =>
    escFail || !opts.esc
      ? esc0(v)
      : (() => {
          try {
            return opts.esc!(v);
          } catch {
            escFail = true;
            return esc0(v);
          }
        })();
  const alert = opts.showAlert || ((m: string) => console.warn(m));

  const state = {
    tab: (opts.initialTab && cfg.sources.includes(opts.initialTab)
      ? opts.initialTab
      : cfg.sources[0]) as SourceId,
    busy: false,
    note: "",
    address: "",
    url: "",
    prompt: "",
    describeBusy: false,
    improving: false,
    /** Reference images attached to the description, data URLs. */
    refs: [] as { id: string; name: string; url: string }[],
    detailsOpen: false,
    dRoom: "",
    dStyle: "",
    dMood: "",
    dFeatures: "",
    ratio: "16:9",
    options: 2,


    dragging: false,
    busyLabel: "Adding Photos",
    /** Existing-property selection and its photo panel. */
    propSel: null as string | null,
    /** Zero-photo properties are hidden until the user asks for them. */
    showEmpty: false,

    propPhotos: [] as PickerPhoto[],
    propChecked: new Set<string>(),
    /* Guards double submission: a second click while the add is in flight is
       the classic way the same photos land in the project twice. */
    adding: false,
    propLoading: false,
    /** Finished designs, their load state and the selection order. */
    designs: [] as PickerDesign[],
    designState: "idle" as "idle" | "loading" | "ready" | "error",
    designSel: [] as string[],
    /** Many photos landed in a single-image context: let the user choose one. */
    choose: [] as PickedFile[],
  };

  const input = document.createElement("input");
  input.type = "file";
  input.hidden = true;
  input.accept = cfg.accept;
  input.multiple = cfg.multiple;
  host.appendChild(input);
  input.addEventListener("change", () => {
    const files = Array.from(input.files || []);
    input.value = "";
    if (files.length) intake(files);
  });

  /** One size limit, one measurement pass, one error message, every source. */
  async function intake(raw: File[]) {
    const files: File[] = [];
    state.busy = true;
    state.note = "";
    const hasHeic = raw.some(
      (f) => /\.(heic|heif)$/i.test(f.name) || /image\/hei[cf]/i.test(f.type || ""),
    );
    state.busyLabel = hasHeic ? "Converting Photos" : "Adding Photos";
    render();
    for (const file of raw) {
      try {
        files.push(await normalizeImageFile(file));
      } catch (error) {
        alert(
          error instanceof Error ? error.message : file.name + ": This Photo Could Not Be Added.",
        );
      }
    }
    const ok: File[] = [];
    for (const f of files) {
      const why = rejectReason(f);
      if (why) {
        alert(f.name + ": " + why);
        continue;
      }
      ok.push(f);
    }
    if (!ok.length) {
      state.busy = false;
      render();
      return;
    }

    /* Navigation never waits on image decoding. Every context hands the
       accepted files to its host immediately; advisory quality flags are
       measured afterwards and pushed through onFlags. A large property shoot
       used to spend seconds in a sequential measureImage() pass here, which
       looked exactly like "nothing happened" on the Add Photos screen. */
    const picked: PickedFile[] = ok.map((file) => ({ file, flags: [] }));
    state.busy = false;

    if (!cfg.multiple && picked.length > 1) {
      state.choose = picked;
      render();
      void measureFlags(picked);
      return;
    }
    try {
      await opts.onPick(picked);
    } finally {
      /* The picker may still be on screen behind a builder or overlay:
         clear the busy card so returning here is not a frozen spinner. */
      render();
    }
    void measureFlags(picked);
  }

  /** Advisory quality flags, measured after the files have been handed over. */
  async function measureFlags(picked: PickedFile[]) {
    let changed = false;
    for (const p of picked) {
      try {
        if (!/^image\//.test(p.file.type)) continue;
        const flags = classify(p.file.name || "", await measureImage(p.file)).flags || [];
        if (flags.length) {
          p.flags = flags;
          changed = true;
        }
      } catch (_) {
        /* measurement is advisory */
      }
    }
    if (changed) {
      try {
        opts.onFlags?.(picked);
      } catch (_) {}
      if (state.choose.length) render();
    }
  }

  async function importCloud(raw: string) {
    const urls = raw
      .split(/[\s,]+/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (!urls.length) return;
    state.busy = true;
    state.note = "";
    render();
    try {
      const { importCloudPhotos } = await import("@/lib/cloud-import.functions");
      const res = await importCloudPhotos({ data: { urls: urls.slice(0, 20) } });
      const files = (res.files || []).map((f: any) => dataUrlToFile(f.data, f.name, f.type));
      if (res.errors?.length)
        state.note = res.errors[0]?.message || "Some Links Could Not Be Read.";
      if (files.length) await intake(files);
      else if (!state.note)
        state.note = "Nothing Could Be Read From That Link. Upload The Photos Instead.";
    } catch (_) {
      state.note = "That Link Could Not Be Read. Upload The Photos Instead.";
    }
    state.busy = false;
    render();
  }

  async function lookupAddress() {
    const v = state.address.trim();
    if (v.length < 3) return;
    state.busy = true;
    state.note = "";
    render();
    try {
      const { lookupListingByAddress } = await import("@/lib/listing-import.functions");
      const r = await lookupListingByAddress({ data: { address: v } });
      if (r?.ok && r.listing) {
        const listing = (r.listing || {}) as Record<string, unknown>;
        opts.onProperty?.(String(listing["address"] || v));
        const photos = ((r.photos || []) as Array<Record<string, unknown>>)
          .map((p) => String(p["url"] || p["path"] || ""))
          .filter(Boolean);
        state.note = photos.length
          ? photos.length + " Listing Photos Found."
          : "Listing Found. Upload The Photos To Continue.";
        if (photos.length) {
          const files = await Promise.all(
            photos
              .slice(0, 40)
              .map((u: string, i: number) => urlToFile(u, "Listing Photo " + (i + 1) + ".jpg")),
          );
          await intake(files.filter(Boolean) as File[]);
        }
      } else {
        const { NO_IMPORT_MESSAGE } = await import("@/lib/listing-source");
        // Never a dead end: keep the address and fall through to Upload.
        opts.onProperty?.(v);
        state.note = (r?.message || NO_IMPORT_MESSAGE) + " Upload The Photos Below Instead.";
        state.tab = "upload";
      }
    } catch (_) {
      const { NO_IMPORT_MESSAGE } = await import("@/lib/listing-source");
      opts.onProperty?.(v);
      state.note = NO_IMPORT_MESSAGE + " Upload The Photos Below Instead.";
      state.tab = "upload";
    }
    state.busy = false;
    render();
  }

  async function readListingUrl() {
    const v = state.url.trim();
    if (v.length < 8) return;
    state.busy = true;
    state.note = "";
    render();
    try {
      const { startListingImport } = await import("@/lib/listing-import.functions");
      const r: any = await startListingImport({ data: { url: v } });
      const addr = r?.import?.address || r?.import?.raw_address || "";
      if (addr) opts.onProperty?.(addr);
      state.note =
        (r?.message || (addr ? "Listing Read: " + addr + "." : "Listing Read.")) +
        " Listing Links Are Read As Text Only. No Photos Are Imported From A Public Listing Page.";
    } catch (_) {
      state.note =
        "That Link Could Not Be Read. Listing Links Are Read As Text Only, So Upload The Photos Below.";
    }
    state.busy = false;
    render();
  }

  /* ---------- markup ---------- */

  function tabs() {
    return (
      '<div class="sp-tabs" role="tablist" aria-label="Photo source">' +
      cfg.sources
        .map((s) => {
          const m = SOURCE_META[s];
          const on = state.tab === s;
          return (
            '<button type="button" role="tab" class="sp-tab' +
            (on ? " on" : "") +
            '" data-sp-tab="' +
            s +
            '" id="' +
            pid("spTab-" + s) +
            '" aria-selected="' +
            (on ? "true" : "false") +
            '" aria-controls="' +
            pid("spPanel") +
            '"' +
            ' tabindex="' +
            (on ? "0" : "-1") +
            '" aria-pressed="' +
            (on ? "true" : "false") +
            '" title="' +
            esc(m.desc) +
            '">' +
            (s === "cloud" ? DRIVE_ICON : '<i data-lucide="' + m.icon + '"></i>') +
            esc(m.tab) +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  /** The stacked-photo composition on the right of the upload card. */
  function heroStack(hero: PickerHero) {
    const rot = ["7deg", "2deg", "-6deg"];
    const cards = hero.stack.slice(0, 3);
    return (
      '<div class="sp-work-stack' +
      (hero.variant === "video" ? " is-video" : "") +
      '" aria-hidden="true">' +
      cards
        .map((ph, i) => {
          const inner = ph.path
            ? '<span class="sp-th is-load" data-sp-thumb="' +
              esc(ph.path) +
              '" data-sp-thumb-alt="' +
              esc(ph.alt) +
              '"></span>'
            : '<img src="' + esc(ph.src || "") + '" alt="" loading="lazy" decoding="async">';
          return (
            '<figure class="sp-work-ph sp-work-ph' +
            (i + 1) +
            '" style="--rot:' +
            rot[i] +
            '">' +
            inner +
            "</figure>"
          );
        })
        .join("") +
      (hero.variant === "video"
        ? '<figure class="sp-work-vid">' +
          (cards[2]?.path
            ? '<span class="sp-th is-load" data-sp-thumb="' + esc(cards[2].path) + '"></span>'
            : '<img src="' + esc(cards[2]?.src || cards[0]?.src || "") + '" alt="" loading="lazy">') +
          '<span class="sp-work-play"><i data-lucide="play"></i></span>' +
          '<figcaption><i data-lucide="clapperboard"></i>Listing Video</figcaption>' +
          "</figure>"
        : "") +
      "</div>"
    );
  }

  function workspace(hero: PickerHero) {
    return (
      '<div class="sp-work' +
      (state.dragging ? " over" : "") +
      (hero.isUser ? " is-mine" : "") +
      '" data-sp-drop="1" role="button" tabindex="0" ' +
      'aria-label="Add photos: drop them on this card or choose files">' +
      '<div class="sp-work-main">' +
      '<div class="sp-work-l">' +
      "<h4>" +
      esc(hero.title) +
      "</h4>" +
      "<p>" +
      esc(hero.copy) +
      "</p>" +
      '<button type="button" class="btn btn-dark sp-work-cta" data-sp="browse">' +
      '<i data-lucide="folder-open"></i>Choose Photos</button>' +
      "</div>" +
      '<div class="sp-work-r">' +
      heroStack(hero) +
      "</div>" +
      "</div>" +
      '<div class="sp-work-f"><span>' +
      esc(cfg.acceptHint.split(", ").join(" \u00b7 ")) +
      '</span><span class="sp-work-dot">\u2022</span><span>Up to ' +
      MAX_MB +
      "MB each</span>" +
      /* The footer states file rules only: no "Your Photos" label before the
         card has actually taken any uploads. */

      "</div>" +
      '<div class="sp-work-over"><i data-lucide="upload-cloud"></i><b>Drop Photos To Upload</b></div>' +
      "</div>"
    );
  }

  /** One contextual heading per source, so the card explains itself. */
  function paneHead(title: string, copy: string) {
    return '<div class="sp-panehead"><h4>' + esc(title) + "</h4><p>" + esc(copy) + "</p></div>";
  }

  function panel() {
    if (state.tab === "upload") {
      if (state.busy) {
        return (
          '<div class="sp-drop" data-sp-drop="1">' +
          '<i data-lucide="loader"></i>' +
          "<b>" +
          state.busyLabel +
          "</b>" +
          '<span class="sp-hint">' +
          (state.busyLabel === "Converting Photos"
            ? "iPhone photos are being converted. This takes a moment."
            : "Preparing previews. This takes a moment.") +
          "</span>" +
          "</div>"
        );
      }
      const hero = (() => {
        try {
          return opts.hero?.() || null;
        } catch (_) {
          return null;
        }
      })();
      if (!hero) {
        return (
          '<div class="sp-drop' +
          (state.dragging ? " over" : "") +
          '" data-sp-drop="1" role="button" tabindex="0" ' +
          'aria-label="Add photos: drop them here or choose files">' +
          '<i data-lucide="upload-cloud"></i>' +
          "<b>" +
          (cfg.multiple ? "Drop Photos Here" : "Drop A Photo, Sketch Or Plan") +
          "</b>" +
          '<span class="sp-hint">Drag and drop, or</span>' +
          '<button type="button" class="btn btn-dark btn-sm" data-sp="browse">Choose Photos</button>' +
          '<span class="sp-hint">' +
          esc(cfg.acceptHint) +
          " \u00b7 " +
          MAX_MB +
          "MB each</span>" +
          "</div>"
        );
      }
      return workspace(hero);
    }

    if (state.tab === "cloud") {
      return (
        '<div class="sp-pane">' +
        paneHead(
          "Import From Google Drive",
          "Choose photos from your connected Google Drive account.",
        ) +
        '<div class="sp-cloudrow"><span>' +
        DRIVE_ICON +
        "Google Drive</span><span>" +
        DROPBOX_ICON +
        "Dropbox</span></div>" +
        '<label class="sp-f">Public Share Link<input type="text" data-sp-f="cloud" id="' +
        pid("spCloud") +
        '" placeholder="https://drive.google.com/file/d/..."></label>' +
        '<button type="button" class="btn btn-primary btn-sm" data-sp="cloudgo">' +
        (state.busy ? "Importing" : "Browse Google Drive") +
        "</button>" +
        '<p class="sp-note">The link must be shared publicly so we can read it.</p>' +
        "</div>"
      );
    }
    if (state.tab === "address") {
      return (
        '<div class="sp-pane">' +
        '<label class="sp-f sp-search">Property Address<span><i data-lucide="search"></i>' +
        '<input type="text" data-sp-f="addr" id="' +
        pid("spAddr") +
        '" placeholder="3417 Hoover Dr, Holiday, FL 34691" value="' +
        esc(state.address) +
        '"></span></label>' +
        '<button type="button" class="btn btn-primary btn-sm" data-sp="addrgo">' +
        (state.busy ? "Looking Up" : "Look Up Address") +
        "</button>" +
        '<p class="sp-note">An address lookup files your work under that property and fills in listing details such as beds, baths and square footage. It does not download photos from a listing — add those from Upload.</p>' +
        "</div>"
      );
    }
    if (state.tab === "url") {
      return (
        '<div class="sp-pane">' +
        paneHead(
          "Import From A Listing Link",
          "Paste a Zillow, Realtor.com, supported MLS or public property gallery link.",
        ) +
        '<label class="sp-f">Listing Link<input type="text" data-sp-f="url" id="' +
        pid("spUrl") +
        '" placeholder="https://www.zillow.com/homedetails/..." value="' +
        esc(state.url) +
        '"></label>' +
        '<button type="button" class="btn btn-primary btn-sm" data-sp="urlgo">' +
        (state.busy ? "Reading Link" : "Import Listing Details") +
        "</button>" +
        '<p class="sp-note">Listing links are read as text only. No photos or media are imported from a public listing page.</p>' +
        "</div>"
      );
    }
    if (state.tab === "property") {
      const list = properties();
      if (!list.length)
        return '<div class="sp-pane"><p class="sp-note">No Properties Yet. Upload Photos To Start.</p></div>';
      /* Properties with nothing to select stay out of the way by default. */
      const withPhotos = list.filter((p) => p.count !== 0);
      const emptyCount = list.length - withPhotos.length;
      const shown = state.showEmpty ? list : withPhotos;
      const toggle = emptyCount
        ? '<button type="button" class="sp-link sp-empty-t" data-sp="emptytoggle">' +
          (state.showEmpty
            ? "Hide Properties Without Photos"
            : "Show Properties Without Photos (" + emptyCount + ")") +
          "</button>"
        : "";
      if (!shown.length)
        return (
          '<div class="sp-pane"><p class="sp-note">No Properties With Photos Yet.</p>' +
          toggle +
          "</div>"
        );
      return (
        '<div class="sp-pane">' +
        paneHead("Choose An Existing Property", "Reuse photos already saved to your workspace.") +
        '<div class="sp-props" role="listbox" aria-label="Your Properties">' +
        shown.map(propCard).join("") +
        "</div>" +
        toggle +
        photoPanel() +
        "</div>"
      );
    }

    if (state.tab === "describe") {
      const ready = state.prompt.trim().length > 0 && !state.describeBusy;
      return (
        '<div class="sp-pane sp-describe">' +
        paneHead(
          "Create From A Description",
          "Describe the space you want to create without uploading a photo.",
        ) +
        '<div class="sp-composer' +
        (state.describeBusy ? " is-busy" : "") +
        '">' +
        '<textarea data-sp-f="prompt" id="' +
        pid("spPrompt") +
        '" aria-label="Describe the space you want to create" ' +
        (state.describeBusy ? "disabled " : "") +
        'placeholder="Describe the space you want to create. Include the room, style, colors, materials and anything you want included.">' +
        esc(state.prompt) +
        "</textarea>" +
        '<div class="sp-composer-a">' +
        '<button type="button" class="btn btn-primary btn-sm sp-create" data-sp="describe" ' +
        'aria-label="Create an AI concept from your description"' +
        (ready ? "" : " disabled") +
        ">" +
        (state.describeBusy
          ? '<span class="sp-spin" aria-hidden="true"></span>Creating…'
          : '<i data-lucide="sparkles"></i>Create <em><span aria-hidden="true">·</span> 1 Credit</em>') +
        "</button>" +
        "</div>" +
        "</div>" +
        '<p class="sp-note">Be specific for better results.</p>' +
        '<div class="sp-chips">' +
        DESCRIBE_EXAMPLES.map(
          (x) =>
            '<button type="button" class="sp-chip" data-sp-ex="' +
            esc(x) +
            '">' +
            esc(x) +
            "</button>",
        ).join("") +
        "</div>" +
        "</div>"
      );
    }

    if (state.tab === "design") return designPanel();
    return "";
  }

  /* ---------- finished designs ---------- */

  let designToken = 0;

  /** Loads real, completed designs once per tab visit. Nothing is shown as
      empty until the request has actually succeeded. */
  function loadDesigns(force = false) {
    if (!opts.loadDesigns) {
      /* Legacy synchronous hosts. */
      const legacy = (opts.designs ? opts.designs() : []).map((d) => ({
        id: d.id,
        path: "",
        room: d.label,
        address: d.sub || null,
      })) as PickerDesign[];
      state.designs = legacy;
      state.designState = "ready";
      return;
    }
    if (!force && (state.designState === "loading" || state.designState === "ready")) return;
    state.designState = "loading";
    render();
    const token = ++designToken;
    opts
      .loadDesigns()
      .then((list) => {
        if (token !== designToken) return;
        state.designs = (list || []).filter((d) => d && d.path);
        state.designState = "ready";
        render();
      })
      .catch((err) => {
        if (token !== designToken) return;
        console.warn("[source-picker] finished designs failed to load", err);
        state.designState = "error";
        render();
      });
  }

  function designDate(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function designPanel() {
    if (state.designState === "loading" || state.designState === "idle") {
      return (
        '<div class="sp-pane"><div class="sp-dgrid" aria-busy="true" aria-live="polite" aria-label="Loading your finished designs">' +
        Array.from({ length: 6 })
          .map(
            () =>
              '<div class="sp-dcard is-skel"><span class="sp-dth"></span><span class="sp-db"><i></i><i></i></span></div>',
          )
          .join("") +
        "</div></div>"
      );
    }
    if (state.designState === "error") {
      return (
        '<div class="sp-pane sp-dempty" role="alert">' +
        '<i data-lucide="triangle-alert"></i>' +
        "<b>We Couldn\u2019t Load Your Designs</b>" +
        "<span>Something went wrong reading your library.</span>" +
        '<span class="sp-dacts"><button type="button" class="btn btn-primary btn-sm" data-sp="dretry">Retry</button></span>' +
        "</div>"
      );
    }
    if (!state.designs.length) {
      return (
        '<div class="sp-pane sp-dempty">' +
        '<i data-lucide="images"></i>' +
        "<b>No Finished Designs Yet</b>" +
        "<span>Create a design first, or start your video with property photos.</span>" +
        '<span class="sp-dacts">' +
        '<button type="button" class="btn btn-primary btn-sm" data-sp="dupload" aria-label="Upload photos for your video">Upload Photos</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-sp="dproperty" aria-label="Choose an existing property">Choose Property</button>' +
        "</span></div>"
      );
    }
    const n = state.designSel.length;
    return (
      '<div class="sp-pane">' +
      '<div class="sp-dgrid" role="group" aria-label="Your Finished Designs">' +
      state.designs.map(designCard).join("") +
      "</div>" +
      (n
        ? '<div class="sp-dfoot"><button type="button" class="btn btn-primary btn-sm" data-sp="dcontinue">' +
          "Continue With " +
          n +
          " Design" +
          (n === 1 ? "" : "s") +
          "</button></div>"
        : "") +
      "</div>"
    );
  }

  function designCard(d: PickerDesign) {
    const i = state.designSel.indexOf(d.id);
    const on = i > -1;
    const meta = [d.address || "", designDate(d.createdAt)].filter(Boolean);
    return (
      '<button type="button" class="sp-dcard' +
      (on ? " is-sel" : "") +
      '" data-sp-design="' +
      esc(d.id) +
      '"' +
      ' role="checkbox" aria-checked="' +
      (on ? "true" : "false") +
      '"' +
      ' aria-label="' +
      esc((on ? "Selected: " : "") + (d.room || "Design") + (d.address ? ", " + d.address : "")) +
      '">' +
      '<span class="sp-dth" data-sp-thumb="' +
      esc(d.path) +
      '"></span>' +
      '<span class="sp-dpick' +
      (on ? " on" : "") +
      '">' +
      (on ? '<i data-lucide="check"></i>' : "") +
      (on ? '<em class="sp-dn">' + (i + 1) + "</em>" : "") +
      "</span>" +
      '<span class="sp-db"><b>' +
      esc(d.room || "Design") +
      "</b>" +
      (meta.length ? "<span>" + esc(meta.join(" \u00b7 ")) + "</span>" : "") +
      "</span></button>"
    );
  }

  function chooser() {
    if (!state.choose.length) return "";
    return (
      '<div class="sp-modal" role="dialog" aria-modal="true" aria-label="Choose One Photo">' +
      '<div class="sp-scrim" data-sp="closechoose"></div>' +
      '<div class="sp-choose"><div class="sp-choose-h"><b>' +
      state.choose.length +
      " Photos Imported. Choose One To Design.</b>" +
      '<button type="button" class="sp-link" data-sp="closechoose">Cancel</button></div>' +
      '<div class="sp-choose-g">' +
      state.choose
        .map((p, i) => {
          const flag = p.flags.length ? FLAG_LABEL[p.flags[0]!] || "Photo Quality" : "";
          return (
            '<button type="button" class="sp-choice" data-sp-choice="' +
            i +
            '">' +
            '<img alt="' +
            esc(p.file.name) +
            '" src="' +
            URL.createObjectURL(p.file) +
            '">' +
            "<b>" +
            esc(p.file.name) +
            "</b>" +
            (flag ? '<em class="sp-flag">' + esc(flag) + "</em>" : "") +
            "</button>"
          );
        })
        .join("") +
      "</div></div></div>"
    );
  }

  /* ---------- existing properties ---------- */

  function properties(): PickerProperty[] {
    let list: PickerProperty[] = [];
    try {
      list = (opts.properties ? opts.properties() : []) as PickerProperty[];
    } catch (_) {
      list = [];
    }
    return list.slice(0, 30).map((p, i) => {
      const unassigned =
        !!p.unassigned ||
        /^unsorted uploads$/i.test(String(p.address || "")) ||
        /^unassigned photos$/i.test(String(p.address || ""));
      const lines = unassigned
        ? { line1: "Unassigned Photos", line2: "Photos not assigned to a property" }
        : splitAddressLines(p.address, p.parts);
      const count =
        p.count == null ? countFromMeta(p.meta) : Math.max(0, Math.floor(Number(p.count) || 0));
      return {
        ...p,
        id: p.id || p.address || "p" + i,
        unassigned,
        line1: lines.line1 || p.address || "Property",
        line2: lines.line2,
        count,
      };
    });
  }

  function countFromMeta(meta?: string): number | null {
    const m = /(\d+)/.exec(String(meta || ""));
    return m ? Number(m[1]) : null;
  }

  /** Up to six candidate thumbnail paths; extras act as fallbacks when one fails. */
  function thumbsOf(p: PickerProperty): string[] {
    const out: string[] = [];
    for (const t of (p.thumbs || []) as string[]) {
      if (t && !out.includes(t)) out.push(t);
      if (out.length === 6) break;
    }
    if (!out.length && p.thumb) out.push(p.thumb);
    return out;
  }

  /** One photo area: skeleton first, real image when the signed URL resolves,
      deliberate fallback when it fails. Never a permanent blank panel. */
  function thumbArea(p: PickerProperty) {
    const icon = p.unassigned ? "images" : "home";
    const list = thumbsOf(p);
    /* Spare paths ride along so a dead file or expired URL falls forward to the next photo. */
    const tile = (path: string, alts: string[] = []) =>
      '<span class="sp-th-i is-load" data-sp-thumb="' +
      esc(path) +
      '"' +
      (alts.length ? ' data-sp-alt="' + esc(alts.join("|")) + '"' : "") +
      '><i data-lucide="' +
      icon +
      '"></i></span>';
    const inner = !list.length
      ? '<span class="sp-th-i is-none"><i data-lucide="' + icon + '"></i></span>'
      : list.length >= 2 && p.unassigned
        ? '<span class="sp-th-mosaic">' +
          list
            .slice(0, 4)
            .map((t, i) =>
              tile(t, list.slice(4).concat(list.slice(0, 4).filter((_, j) => j !== i))),
            )
            .join("") +
          "</span>"
        : tile(list[0]!, list.slice(1));
    return '<span class="sp-prop-th">' + inner + "</span>";
  }

  function propCard(p: PickerProperty) {
    const selected = state.propSel === p.id;
    const empty = p.count === 0;
    const cls = [
      "sp-prop",
      p.unassigned ? "is-util" : "",
      selected ? "is-sel" : "",
      empty ? "is-empty" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const count = empty ? "No Photos Yet" : photoCountLabel(p.count == null ? "" : p.count);
    if (empty) {
      /* Kept out of the way: nothing to select, so the card offers photos. */
      return (
        '<div class="' +
        cls +
        '" role="option" aria-selected="false" aria-disabled="true">' +
        '<span class="sp-prop-th"><span class="sp-th-i is-none"><i data-lucide="image-off"></i></span></span>' +
        '<span class="sp-prop-b"><b>' +
        esc(p.line1 || "") +
        "</b>" +
        (p.line2 ? "<span>" + esc(p.line2) + "</span>" : "") +
        '<em class="sp-prop-c">' +
        esc(count) +
        '<button type="button" class="sp-link" data-sp="browse">Upload Photos</button></em></span></div>'
      );
    }
    return (
      '<div class="' +
      cls +
      '" role="option" aria-selected="' +
      (selected ? "true" : "false") +
      '"' +
      ' tabindex="0" data-sp-prop="' +
      esc(p.id!) +
      '">' +
      thumbArea(p) +
      '<span class="sp-pick' +
      (selected ? " on" : "") +
      '" aria-hidden="true">' +
      (selected ? '<i data-lucide="check"></i>' : "") +
      "</span>" +
      '<span class="sp-prop-b"><b>' +
      esc(p.line1 || "") +
      "</b>" +
      (p.line2 ? "<span>" + esc(p.line2) + "</span>" : "") +
      '<em class="sp-prop-c">' +
      esc(count) +
      "</em></span></div>"
    );
  }

  function photoPanel() {
    const id = state.propSel;
    if (!id || !opts.loadPropertyPhotos) return "";
    if (state.propLoading) {
      /* Skeletons, not a bare sentence: the grid keeps its shape while photos load. */
      return (
        '<div class="sp-photos"><div class="sp-photos-h"><b>Loading Photos…</b></div>' +
        '<div class="sp-photo-grid">' +
        Array.from({ length: 6 })
          .map(() => '<span class="sp-photo is-skel"><span class="sp-th-i is-load"></span></span>')
          .join("") +
        "</div></div>"
      );
    }
    const photos = state.propPhotos;
    if (!photos.length)
      return '<div class="sp-photos"><p class="sp-note">This Property Has No Photos Yet.</p></div>';
    const n = state.propChecked.size;
    return (
      '<div class="sp-photos"><div class="sp-photos-h"><b>' +
      esc(n + " Of " + photos.length + " Selected") +
      "</b>" +
      '<span><button type="button" class="btn btn-ghost btn-sm" data-sp="pall">Select All</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-sp="pnone">Clear</button>' +
      '<button type="button" class="btn btn-primary btn-sm" data-sp="padd"' +
      (n && !state.adding ? "" : " disabled") +
      ">" +
      esc(
        state.adding ? "Adding…" : n ? "Add " + n + " Photo" + (n === 1 ? "" : "s") : "Add Photos",
      ) +
      "</button></span></div>" +
      '<div class="sp-photo-grid">' +
      photos
        .map((ph) => {
          const on = state.propChecked.has(ph.id);
          const label = String(ph.room || ph.name || "Photo");
          return (
            '<button type="button" class="sp-photo' +
            (on ? " is-sel" : "") +
            '" aria-pressed="' +
            (on ? "true" : "false") +
            '" data-sp-photo="' +
            esc(ph.id) +
            '" aria-label="' +
            esc(label) +
            '">' +
            '<span class="sp-th-i is-load" data-sp-thumb="' +
            esc(ph.path) +
            '" data-sp-thumb-id="' +
            esc(ph.id) +
            '"' +
            ' data-sp-thumb-alt="' +
            esc(label) +
            '"><i data-lucide="image"></i></span>' +
            '<span class="sp-photo-x" aria-hidden="true"><i data-lucide="' +
            (on ? "check" : "circle") +
            '"></i></span>' +
            '<span class="sp-photo-l">' +
            esc(label) +
            "</span>" +
            "</button>"
          );
        })
        .join("") +
      "</div></div>"
    );
  }

  async function selectProperty(id: string) {
    const p = properties().find((x) => x.id === id);
    if (!p || p.count === 0) return;
    if (!opts.loadPropertyPhotos) {
      opts.onProperty?.(p.address);
      return;
    }
    state.propSel = id;
    state.propPhotos = [];
    state.propChecked = new Set();
    state.propLoading = true;
    render();
    try {
      const photos = (await opts.loadPropertyPhotos(p)) || [];
      if (state.propSel !== id) return;
      state.propPhotos = photos;
      state.propChecked = new Set(photos.map((x) => x.id));
    } catch (err: any) {
      alert((err && err.message) || "Those Photos Could Not Be Loaded.");
    } finally {
      state.propLoading = false;
      render();
    }
  }

  /** Thumbnails resolve after paint so the grid never waits on signed URLs. */
  const thumbCache = new Map<string, string>();
  function hydrateThumbs() {
    if (!body) return;
    const nodes = Array.from(body.querySelectorAll<HTMLElement>("[data-sp-thumb]"));
    for (const el of nodes) {
      if (el.dataset["spThumbDone"] === "1") continue;
      el.dataset["spThumbDone"] = "1";
      const first = el.dataset["spThumb"]!;
      const alts = (el.dataset["spAlt"] || "").split("|").filter(Boolean);
      void loadThumb(el, [first, ...alts]);
    }
  }

  /** Walks the candidate paths until one signed URL actually decodes. */
  async function loadThumb(el: HTMLElement, paths: string[]) {
    /* A real <img> with object-fit, not a background: it scales predictably in
       every tile size and never renders a mis-sized band of colour. */
    const paint = (url: string) => {
      el.classList.remove("is-load", "is-fail");
      el.classList.add("has-img");
      el.innerHTML = "";
      const img = document.createElement("img");
      img.className = "sp-th-img";
      img.loading = "lazy";
      img.decoding = "async";
      img.alt = el.dataset["spThumbAlt"] || "";
      img.src = url;
      el.appendChild(img);
    };
    for (const path of paths) {
      if (!el.isConnected) return;
      try {
        let url = thumbCache.get(path);
        if (!url) {
          if (!opts.resolvePhoto) throw new Error("No resolvePhoto helper was provided.");
          url = (await opts.resolvePhoto(path)) || "";
          if (!url) throw new Error("No signed URL was returned.");
          await decode(url);
          thumbCache.set(path, url);
        }
        if (!el.isConnected) return;
        paint(url);
        return;
      } catch (err) {
        /* The real storage / signed-URL error, not a silent blank panel. */
        console.warn(
          "[source-picker] thumbnail failed — id=" +
            (el.dataset["spThumbId"] || "?") +
            " path=" +
            path,
          err,
        );
        thumbCache.delete(path);
      }
    }
    if (!el.isConnected) return;
    el.classList.remove("is-load");
    el.classList.add("is-fail");
    el.innerHTML =
      '<i data-lucide="image-off"></i><span class="sp-th-msg">Preview Unavailable</span>';
    try {
      opts.lucide?.createIcons();
    } catch (_) {}
  }

  function decode(url: string) {
    return new Promise<void>((res, rej) => {
      const img = new Image();
      img.onload = () => res();
      img.onerror = () => rej(new Error("The image could not be loaded: " + url.split("?")[0]));
      img.src = url;
    });
  }

  function html() {
    return (
      '<div class="sp">' +
      tabs() +
      /* The tablist's aria-controls needs a real panel to point at. */
      '<div id="' +
      pid("spPanel") +
      '" role="tabpanel" aria-labelledby="' +
      pid("spTab-" + state.tab) +
      '">' +
      panel() +
      "</div>" +
      (state.note ? '<div class="sp-msg">' + esc(state.note) + "</div>" : "") +
      "</div>" +
      chooser()
    );
  }

  let body: HTMLElement | null = null;

  function render() {
    if (!body) {
      body = document.createElement("div");
      body.className = "sp-host";
      host.appendChild(body);
      body.addEventListener("click", onClick);
      body.addEventListener("input", onInput);
      body.addEventListener("keydown", onKey);
      wireDrag(body);
    }
    /* A host helper that fails must never leave an empty picker behind. */
    try {
      body.innerHTML = html();
    } catch (err) {
      console.error("[source-picker] render failed", err);
      escFail = true;
      body.innerHTML = html();
    }

    try {
      opts.lucide?.createIcons();
    } catch (_) {
      /* icons are cosmetic */
    }
    if (state.tab === "describe") syncComposer();
    if (state.tab === "property" || state.tab === "design" || state.tab === "upload")
      hydrateThumbs();
    if (state.tab === "design" && state.designState === "idle") loadDesigns();
  }

  function wireDrag(el: HTMLElement) {
    ["dragenter", "dragover"].forEach((e) =>
      el.addEventListener(e, (ev: any) => {
        if (!ev.target?.closest?.("[data-sp-drop]")) return;
        ev.preventDefault();
        if (!state.dragging) {
          state.dragging = true;
          render();
        }
      }),
    );
    ["dragleave", "drop"].forEach((e) =>
      el.addEventListener(e, (ev: any) => {
        ev.preventDefault();
        if (state.dragging) {
          state.dragging = false;
          render();
        }
      }),
    );
    el.addEventListener("drop", (ev: any) => {
      const files = Array.from(ev.dataTransfer?.files || []) as File[];
      if (files.length) intake(cfg.multiple ? files : files.slice(0, 1));
    });
  }

  /** The dropzone is clickable and keyboard-operable, not only its button. */
  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (fieldName(t) === "prompt") {
      /* Enter still writes a new line; only the shortcut submits. */
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submitDescribe();
      }
      return;
    }
    const card = t.closest?.("[data-sp-prop]") as HTMLElement | null;
    if (card) {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      selectProperty(card.dataset["spProp"]!);
      return;
    }
    if (!t.closest?.("[data-sp-drop]")) return;
    if (t.closest("button")) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    input.click();
  }

  /** Grows the composer with the text and keeps the submit state honest. */
  function syncComposer() {
    const ta = field("prompt") as HTMLTextAreaElement | null;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 260) + "px";
    }
    const btn = body?.querySelector(".sp-create") as HTMLButtonElement | null;
    if (btn) btn.disabled = !(state.prompt.trim().length > 0) || state.describeBusy;
  }

  async function submitDescribe() {
    if (state.describeBusy) return;
    const prompt = state.prompt.trim();
    if (!prompt) return;
    state.describeBusy = true;
    render();
    try {
      await opts.onDescribe?.(prompt);
    } catch (err: any) {
      alert((err && err.message) || "Could not create that concept.");
    } finally {
      state.describeBusy = false;
      render();
    }
  }

  function onInput(e: Event) {
    const t = e.target as HTMLInputElement;
    const f = fieldName(t);
    if (f === "addr") state.address = t.value;
    if (f === "url") state.url = t.value;
    if (f === "prompt") {
      state.prompt = t.value;
      syncComposer();
    }
  }

  async function onClick(e: Event) {
    const t = e.target as HTMLElement;
    const tab = t.closest("[data-sp-tab]") as HTMLElement | null;
    if (tab) {
      const next = tab.dataset["spTab"] as SourceId;
      if (next !== state.tab) {
        /* Changing source starts a clean selection. */
        state.propSel = null;
        state.propPhotos = [];
        state.propChecked = new Set();
      }
      state.tab = next;
      state.note = "";
      opts.onTab?.(state.tab);
      render();
      return;
    }
    const prop = t.closest("[data-sp-prop]") as HTMLElement | null;
    if (prop) {
      await selectProperty(prop.dataset["spProp"]!);
      return;
    }
    const photo = t.closest("[data-sp-photo]") as HTMLElement | null;
    if (photo) {
      const id = photo.dataset["spPhoto"]!;
      if (state.propChecked.has(id)) state.propChecked.delete(id);
      else state.propChecked.add(id);
      render();
      return;
    }
    const ex = t.closest("[data-sp-ex]") as HTMLElement | null;
    if (ex) {
      /* Examples fill the prompt; the user still presses Create. */
      state.prompt = ex.dataset["spEx"] || "";
      render();
      const ta = field("prompt") as HTMLTextAreaElement | null;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
      return;
    }
    const dsn = t.closest("[data-sp-design]") as HTMLElement | null;
    if (dsn) {
      const id = dsn.dataset["spDesign"]!;
      if (opts.onDesigns || opts.loadDesigns) {
        const i = state.designSel.indexOf(id);
        if (i > -1) state.designSel.splice(i, 1);
        else state.designSel.push(id);
        render();
        return;
      }
      opts.onDesign?.(id);
      return;
    }

    const choice = t.closest("[data-sp-choice]") as HTMLElement | null;
    if (choice) {
      const picked = state.choose[Number(choice.dataset["spChoice"])];
      state.choose = [];
      render();
      if (picked) await opts.onPick([picked]);
      return;
    }
    const act = t.closest("[data-sp]") as HTMLElement | null;
    if (!act) {
      if (t.closest("[data-sp-drop]")) input.click();
      return;
    }
    const k = act.dataset["sp"];
    if (k === "browse") input.click();
    else if (k === "sample") opts.onSample?.();
    else if (k === "describe") await submitDescribe();
    else if (k === "cloudgo") importCloud(field("cloud")?.value || "");
    else if (k === "addrgo") lookupAddress();
    else if (k === "urlgo") readListingUrl();
    else if (k === "emptytoggle") {
      state.showEmpty = !state.showEmpty;
      render();
    } else if (k === "dretry") loadDesigns(true);
    else if (k === "dupload") {
      state.tab = "upload";
      opts.onTab?.(state.tab);
      render();
      input.click();
    } else if (k === "dproperty") {
      state.tab = "property";
      opts.onTab?.(state.tab);
      render();
    } else if (k === "dcontinue") {
      if (state.adding) return;
      const byId = new Map(state.designs.map((d) => [d.id, d]));
      const ids = [...new Set(state.designSel)];
      const picked = ids.map((id) => byId.get(id)).filter(Boolean) as PickerDesign[];
      if (!picked.length) return;
      state.adding = true;
      render();
      try {
        await opts.onDesigns?.(picked);
      } finally {
        state.adding = false;
        render();
      }
    } else if (k === "pall") {
      state.propChecked = new Set(state.propPhotos.map((x) => x.id));
      render();
    } else if (k === "pnone") {
      state.propChecked = new Set();
      render();
    } else if (k === "padd") {
      if (state.adding) return;
      const p = properties().find((x) => x.id === state.propSel);
      /* Unique asset ids only, whatever the selection state contains. */
      const ids = new Set(state.propChecked);
      const seen = new Set<string>();
      const photos = state.propPhotos.filter((x) => {
        if (!ids.has(x.id) || seen.has(x.id)) return false;
        seen.add(x.id);
        return true;
      });
      if (!p || !photos.length) return;
      state.adding = true;
      render();
      try {
        await opts.onPropertyPhotos?.(p, photos);
      } finally {
        state.adding = false;
        render();
      }
    } else if (k === "closechoose") {
      state.choose = [];
      render();
    }
  }

  render();

  return {
    render,
    destroy() {
      body?.remove();
      body = null;
      input.remove();
    },
  };
}

/* ---------- helpers ---------- */

export function dataUrlToFile(data: string, name: string, type: string): File {
  const base64 = data.includes(",") ? data.split(",")[1]! : data;
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name || "photo.jpg", { type: type || "image/jpeg" });
}

async function urlToFile(url: string, name: string): Promise<File | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || "image/jpeg" });
  } catch (_) {
    return null;
  }
}
