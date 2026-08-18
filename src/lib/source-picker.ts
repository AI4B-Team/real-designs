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

export type SourceId = "upload" | "cloud" | "address" | "url" | "property" | "design";
export type PickerContext = "design" | "video" | "property-media" | "batch";

export type PickedFile = { file: File; flags: string[] };

export const SOURCE_META: Record<SourceId, { icon: string; label: string; desc: string }> = {
  upload: { icon: "upload-cloud", label: "Upload", desc: "Drag and drop or browse." },
  cloud: { icon: "cloud", label: "Google Drive Or Dropbox", desc: "Paste a public share link." },
  address: { icon: "map-pin", label: "Property Address", desc: "Fills in address and listing details." },
  url: { icon: "link", label: "Listing URL", desc: "Reads listing text, no media." },
  property: { icon: "home", label: "Existing Property", desc: "Reuse photos already uploaded." },
  design: { icon: "images", label: "Existing Design", desc: "Start from a finished design." },
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
    sources: ["upload", "cloud", "property"],
    /* Many photos are handed to the staging review grid, never dropped. */
    multiple: true,
    accept: IMAGE_ACCEPT + ",application/pdf,.pdf",
    acceptHint: "JPG, PNG, HEIC, WEBP, PDF",
  },
  video: {
    sources: ["upload", "cloud", "property", "design"],
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
    throw new Error(f.name + ": This HEIC Photo Could Not Be Converted. Export It As JPG And Try Again.");
  }
}

export const MAX_MB = MAX_FILE_MB;

export type PickerOptions = {
  context: PickerContext;
  esc: (s: string) => string;
  lucide?: { createIcons: (o?: any) => void };
  /** Properties already in the workspace, for the property source. */
  properties?: () => Array<{ address: string; meta?: string }>;
  /** Finished designs, for the design source. */
  designs?: () => Array<{ id: string; label: string; sub?: string; badge?: string }>;
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
  /** Optional "Try A Sample Space" affordance under the dropzone. */
  onSample?: () => void;
  showAlert?: (msg: string) => void;
};

const esc0 = (v: string) =>
  String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export function mountSourcePicker(host: HTMLElement, opts: PickerOptions) {
  const cfg = CONTEXT_CONFIG[opts.context];
  const esc = opts.esc || esc0;
  const alert = opts.showAlert || ((m: string) => console.warn(m));

  const state = {
    tab: (opts.initialTab && cfg.sources.includes(opts.initialTab) ? opts.initialTab : cfg.sources[0]) as SourceId,
    busy: false,
    note: "",
    address: "",
    url: "",
    dragging: false,
    busyLabel: "Adding Photos",
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
    let files: File[] = [];
    state.busy = true;
    state.note = "";
    const hasHeic = raw.some((f) => /\.(heic|heif)$/i.test(f.name) || /image\/hei[cf]/i.test(f.type || ""));
    state.busyLabel = hasHeic ? "Converting Photos" : "Adding Photos";
    render();
    for (const file of raw) {
      try {
        files.push(await normalizeImageFile(file));
      } catch (error) {
        alert(error instanceof Error ? error.message : file.name + ": This Photo Could Not Be Added.");
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
      try { opts.onFlags?.(picked); } catch (_) {}
      if (state.choose.length) render();
    }
  }


  async function importCloud(raw: string) {
    const urls = raw.split(/[\s,]+/).map((u) => u.trim()).filter(Boolean);
    if (!urls.length) return;
    state.busy = true;
    state.note = "";
    render();
    try {
      const { importCloudPhotos } = await import("@/lib/cloud-import.functions");
      const res = await importCloudPhotos({ data: { urls: urls.slice(0, 20) } });
      const files = (res.files || []).map((f: any) => dataUrlToFile(f.data, f.name, f.type));
      if (res.errors?.length) state.note = res.errors[0]?.message || "Some Links Could Not Be Read.";
      if (files.length) await intake(files);
      else if (!state.note) state.note = "Nothing Could Be Read From That Link. Upload The Photos Instead.";
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
        opts.onProperty?.(r.listing.address || v);
        const photos = (r.photos || []).map((p: any) => p.url || p.path).filter(Boolean);
        state.note = photos.length
          ? photos.length + " Listing Photos Found."
          : "Listing Found. Upload The Photos To Continue.";
        if (photos.length) {
          const files = await Promise.all(photos.slice(0, 40).map((u: string, i: number) => urlToFile(u, "Listing Photo " + (i + 1) + ".jpg")));
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
      state.note = "That Link Could Not Be Read. Listing Links Are Read As Text Only, So Upload The Photos Below.";
    }
    state.busy = false;
    render();
  }

  /* ---------- markup ---------- */

  function tabs() {
    return (
      '<div class="sp-tabs">' +
      cfg.sources
        .map((s) => {
          const m = SOURCE_META[s];
          return (
            '<button type="button" class="sp-tab' + (s === "upload" && state.tab === "upload" ? " sp-primary" : "") + (state.tab === s ? " on" : "") + '" data-sp-tab="' + s + '">' +
            (s === "cloud" ? DRIVE_ICON : '<i data-lucide="' + m.icon + '"></i>') +
            esc(m.label) +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function panel() {
    if (state.tab === "upload") {
      if (state.busy) {
        return (
          '<div class="sp-drop" data-sp-drop="1">' +
          '<i data-lucide="loader"></i>' +
          "<b>" + state.busyLabel + "</b>" +
          '<span class="sp-hint">' + (state.busyLabel === "Converting Photos" ? "iPhone photos are being converted. This takes a moment." : "Preparing previews. This takes a moment.") + "</span>" +
          "</div>"
        );
      }
      return (
        '<div class="sp-drop' + (state.dragging ? " over" : "") + '" data-sp-drop="1">' +
        '<i data-lucide="upload-cloud"></i>' +
        "<b>" + (cfg.multiple ? "Drop Photos Here" : "Drop A Photo, Sketch Or Plan") + "</b>" +
        '<span class="sp-or">Drag and drop, or</span>' +
        '<button type="button" class="btn btn-dark btn-sm" data-sp="browse">Browse Files</button>' +
        '<span class="sp-hint">Supported files: ' + esc(cfg.acceptHint) + ' · Up to ' + MAX_MB + " MB each</span>" +
        (opts.onSample ? '<button type="button" class="sp-link" data-sp="sample">Not Ready To Upload? Try A Sample Space</button>' : "") +
        "</div>"
      );
    }
    if (state.tab === "cloud") {
      return (
        '<div class="sp-pane">' +
        '<div class="sp-cloudrow"><span>' + DRIVE_ICON + "Google Drive</span><span>" + DROPBOX_ICON + "Dropbox</span></div>" +
        '<label class="sp-f">Public Share Link<input type="text" id="spCloud" placeholder="https://drive.google.com/file/d/..."></label>' +
        '<button type="button" class="btn btn-primary btn-sm" data-sp="cloudgo">' + (state.busy ? "Importing" : "Import Photos") + "</button>" +
        '<p class="sp-note">The link must be shared publicly so we can read it.</p>' +
        "</div>"
      );
    }
    if (state.tab === "address") {
      return (
        '<div class="sp-pane">' +
        '<label class="sp-f sp-search">Property Address<span><i data-lucide="search"></i>' +
        '<input type="text" id="spAddr" placeholder="3417 Hoover Dr, Holiday, FL 34691" value="' + esc(state.address) + '"></span></label>' +
        '<button type="button" class="btn btn-primary btn-sm" data-sp="addrgo">' + (state.busy ? "Looking Up" : "Look Up Address") + "</button>" +
        '<p class="sp-note">An address lookup files your work under that property and fills in listing details such as beds, baths and square footage. It does not download photos from a listing — add those from Upload.</p>' +
        "</div>"
      );
    }
    if (state.tab === "url") {
      return (
        '<div class="sp-pane">' +
        '<label class="sp-f">Listing Link<input type="text" id="spUrl" placeholder="https://www.zillow.com/homedetails/..." value="' + esc(state.url) + '"></label>' +
        '<button type="button" class="btn btn-primary btn-sm" data-sp="urlgo">' + (state.busy ? "Reading Link" : "Import Listing Details") + "</button>" +
        '<p class="sp-note">Listing links are read as text only. No photos or media are imported from a public listing page.</p>' +
        "</div>"
      );
    }
    if (state.tab === "property") {
      const list = (opts.properties ? opts.properties() : []).slice(0, 30);
      if (!list.length) return '<div class="sp-pane"><p class="sp-note">No Properties Yet. Upload Photos To Start.</p></div>';
      return (
        '<div class="sp-pane"><div class="sp-props">' +
        list
          .map(
            (p) =>
              '<button type="button" class="sp-prop" data-sp-prop="' + esc(p.address) + '"><i data-lucide="home"></i><b>' +
              esc(p.address) + "</b><span class=\"mono\">" + esc(p.meta || "") + "</span></button>",
          )
          .join("") +
        "</div></div>"
      );
    }
    if (state.tab === "design") {
      const list = (opts.designs ? opts.designs() : []).slice(0, 40);
      if (!list.length)
        return '<div class="sp-pane"><p class="sp-note">No Finished Designs Yet. Start From Photos Instead.</p></div>';
      return (
        '<div class="sp-pane"><div class="sp-props">' +
        list
          .map(
            (d) =>
              '<button type="button" class="sp-prop" data-sp-design="' + esc(d.id) + '"><i data-lucide="images"></i><b>' +
              esc(d.label) + '</b><span class="mono">' + esc(d.sub || d.badge || "") + "</span></button>",
          )
          .join("") +
        "</div></div>"
      );
    }
    return "";

  }

  function chooser() {
    if (!state.choose.length) return "";
    return (
      '<div class="sp-modal" role="dialog" aria-modal="true" aria-label="Choose One Photo">' +
      '<div class="sp-scrim" data-sp="closechoose"></div>' +
      '<div class="sp-choose"><div class="sp-choose-h"><b>' +
      state.choose.length + ' Photos Imported. Choose One To Design.</b>' +
      '<button type="button" class="sp-link" data-sp="closechoose">Cancel</button></div>' +
      '<div class="sp-choose-g">' +
      state.choose
        .map((p, i) => {
          const flag = p.flags.length ? FLAG_LABEL[p.flags[0]!] || "Photo Quality" : "";
          return (
            '<button type="button" class="sp-choice" data-sp-choice="' + i + '">' +
            '<img alt="' + esc(p.file.name) + '" src="' + URL.createObjectURL(p.file) + '">' +
            "<b>" + esc(p.file.name) + "</b>" +
            (flag ? '<em class="sp-flag">' + esc(flag) + "</em>" : "") +
            "</button>"
          );
        })
        .join("") +
      "</div></div></div>"
    );
  }

  function html() {
    return (
      '<div class="sp">' +
      tabs() +
      panel() +
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
      wireDrag(body);
    }
    body.innerHTML = html();
    try {
      opts.lucide?.createIcons();
    } catch (_) {
      /* icons are cosmetic */
    }
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

  function onInput(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.id === "spAddr") state.address = t.value;
    if (t.id === "spUrl") state.url = t.value;
  }

  async function onClick(e: Event) {
    const t = e.target as HTMLElement;
    const tab = t.closest("[data-sp-tab]") as HTMLElement | null;
    if (tab) {
      state.tab = tab.dataset["spTab"] as SourceId;
      state.note = "";
      opts.onTab?.(state.tab);
      render();
      return;
    }
    const prop = t.closest("[data-sp-prop]") as HTMLElement | null;
    if (prop) {
      opts.onProperty?.(prop.dataset["spProp"]!);
      return;
    }
    const dsn = t.closest("[data-sp-design]") as HTMLElement | null;
    if (dsn) {
      opts.onDesign?.(dsn.dataset["spDesign"]!);
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
    if (!act) return;
    const k = act.dataset["sp"];
    if (k === "browse") input.click();
    else if (k === "sample") opts.onSample?.();
    else if (k === "cloudgo") importCloud((document.getElementById("spCloud") as HTMLInputElement | null)?.value || "");
    else if (k === "addrgo") lookupAddress();
    else if (k === "urlgo") readListingUrl();
    else if (k === "closechoose") {
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
