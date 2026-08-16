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

export type SourceId = "upload" | "cloud" | "address" | "url" | "property" | "design";
export type PickerContext = "design" | "video" | "property-media" | "batch";

export type PickedFile = { file: File; flags: string[] };

export const SOURCE_META: Record<SourceId, { icon: string; label: string; desc: string }> = {
  upload: { icon: "upload-cloud", label: "Upload", desc: "Drag and drop or browse." },
  cloud: { icon: "cloud", label: "Google Drive Or Dropbox", desc: "Paste a public share link." },
  address: { icon: "map-pin", label: "Property Address", desc: "Fills in the address only." },
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

export const CONTEXT_CONFIG: Record<PickerContext, ContextConfig> = {
  design: {
    sources: ["upload", "cloud", "url", "property"],
    multiple: false,
    accept: "image/*,application/pdf",
    acceptHint: "JPG, PNG, HEIC, WEBP, PDF",
  },
  video: {
    sources: ["upload", "cloud", "url", "property", "design"],
    multiple: true,
    accept: "image/*",
    acceptHint: "JPG, PNG, HEIC, WEBP",
  },
  "property-media": {
    sources: ["upload", "cloud", "url"],
    multiple: true,
    accept: "image/*",
    acceptHint: "JPG, PNG, HEIC, WEBP",
  },
  batch: {
    sources: ["upload", "cloud", "url", "property"],
    multiple: true,
    accept: "image/*",
    acceptHint: "JPG, PNG, HEIC, WEBP",
  },
};

export const MAX_MB = 10;

export type PickerOptions = {
  context: PickerContext;
  esc: (s: string) => string;
  lucide?: { createIcons: (o?: any) => void };
  /** Properties already in the workspace, for the property source. */
  properties?: () => Array<{ address: string; meta?: string; disabled?: boolean }>;
  /** Finished designs, for the design source. */
  designs?: () => Array<{ id: string; label: string; sub?: string; badge?: string }>;
  /** Which source opens first, so a host can remember the tab across renders. */
  initialTab?: SourceId;
  onTab?: (tab: SourceId) => void;
  /** Called with everything the user picked, after measurement. */
  onPick: (picked: PickedFile[]) => void;
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
    /** Listing link line expanded inline. */
    listing: false,
    /** Many photos landed in a single-image context: let the user choose one. */
    choose: [] as PickedFile[],
  };


  /**
   * Address lookup only exists when a licensed listing-data provider is
   * connected. Nothing to configure here: it appears on its own.
   */
  (async () => {
    if (cfg.sources.includes("address")) return;
    try {
      const { readIntegrations } = await import("@/lib/integrations.functions");
      const r: any = await readIntegrations();
      const on = (r?.items || []).some((i: any) => i.key === "listing" && i.connected);
      if (on && !cfg.sources.includes("address")) {
        cfg.sources.splice(cfg.sources.indexOf("url"), 0, "address");
        render();
      }
    } catch {
      /* readiness is advisory */
    }
  })();

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
  async function intake(files: File[]) {
    const ok: File[] = [];
    for (const f of files) {
      if (f.size > MAX_MB * 1024 * 1024) {
        alert(esc(f.name) + " Is Larger Than " + MAX_MB + " MB. Try A Smaller File.");
        continue;
      }
      ok.push(f);
    }
    if (!ok.length) return;
    const measured: PickedFile[] = [];
    for (const f of ok) {
      let flags: string[] = [];
      try {
        if (/^image\//.test(f.type)) flags = classify(f.name || "", await measureImage(f)).flags || [];
      } catch (_) {
        /* measurement is advisory */
      }
      measured.push({ file: f, flags });
    }
    if (!cfg.multiple && measured.length > 1) {
      state.choose = measured;
      render();
      return;
    }
    opts.onPick(measured);
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

  function dropbox() {
    return (
      '<div class="sp-drop' + (state.dragging ? " over" : "") + '" data-sp-drop="1">' +
      '<i data-lucide="upload-cloud"></i>' +
      "<b>" + (cfg.multiple ? "Drop Your Photos, Or" : "Drop A Photo, Sketch Or Plan, Or") + "</b>" +
      '<div class="sp-acts">' +
      '<button type="button" class="btn btn-dark btn-sm" data-sp="browse">Browse Files</button>' +
      (cfg.sources.includes("cloud")
        ? '<button type="button" class="sp-cloudbtn" data-sp="tab-cloud">' + DRIVE_ICON + "Drive</button>" +
          '<button type="button" class="sp-cloudbtn" data-sp="tab-cloud">' + DROPBOX_ICON + "Dropbox</button>"
        : "") +
      "</div>" +
      '<span class="sp-hint">' + esc(cfg.acceptHint) + " · Up To " + MAX_MB + " MB Each</span>" +
      (opts.onSample ? '<button type="button" class="sp-link" data-sp="sample">No Photo Yet? Try A Sample Space</button>' : "") +
      "</div>"
    );
  }

  function backLink() {
    return '<button type="button" class="sp-link sp-back" data-sp="tab-upload"><i data-lucide="arrow-left"></i>Back To Upload</button>';
  }

  function panel() {
    if (state.tab === "upload") return dropbox();

    if (state.tab === "cloud") {
      return (
        '<div class="sp-pane">' + backLink() +
        '<div class="sp-cloudrow"><span>' + DRIVE_ICON + "Google Drive</span><span>" + DROPBOX_ICON + "Dropbox</span></div>" +
        '<label class="sp-f">Public Share Link<input type="text" id="spCloud" placeholder="https://drive.google.com/file/d/..."></label>' +
        '<button type="button" class="btn btn-primary btn-sm" data-sp="cloudgo">' + (state.busy ? "Importing" : "Import Photos") + "</button>" +
        '<p class="sp-note">The link must be shared publicly so we can read it.</p>' +
        "</div>"
      );
    }
    if (state.tab === "address") {
      return (
        '<div class="sp-pane">' + backLink() +
        '<label class="sp-f sp-search">Property Address<span><i data-lucide="search"></i>' +
        '<input type="text" id="spAddr" placeholder="3417 Hoover Dr, Holiday, FL 34691" value="' + esc(state.address) + '"></span></label>' +
        '<button type="button" class="btn btn-primary btn-sm" data-sp="addrgo">' + (state.busy ? "Looking Up" : "Look Up Address") + "</button>" +
        '<p class="sp-note">An address lookup files your work under that property and fills in listing details such as beds, baths and square footage. It does not download photos from a listing.</p>' +
        "</div>"
      );
    }
    if (state.tab === "property") {
      const list = (opts.properties ? opts.properties() : []).slice(0, 30);
      if (!list.length) return '<div class="sp-pane">' + backLink() + '<p class="sp-note">No Properties Yet. Upload Photos To Start.</p></div>';
      return (
        '<div class="sp-pane">' + backLink() + '<div class="sp-props">' +
        list
          .map(
            (p) =>
              '<button type="button" class="sp-prop' + (p.disabled ? " off" : "") + '"' + (p.disabled ? " disabled" : "") +
              ' data-sp-prop="' + esc(p.address) + '"><i data-lucide="home"></i><b>' +
              esc(p.address) + "</b><span class=\"mono\">" + esc(p.meta || "") + "</span></button>",
          )
          .join("") +
        "</div></div>"
      );
    }
    if (state.tab === "design") {
      const list = (opts.designs ? opts.designs() : []).slice(0, 40);
      if (!list.length)
        return '<div class="sp-pane">' + backLink() + '<p class="sp-note">No Finished Designs Yet. Start From Photos Instead.</p></div>';
      return (
        '<div class="sp-pane">' + backLink() + '<div class="sp-props">' +
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

  /** One quiet line for things already in the workspace. */
  function workspaceLine() {
    const has: string[] = [];
    if (cfg.sources.includes("property")) has.push('<button type="button" class="sp-inline" data-sp="tab-property">Existing Property</button>');
    if (cfg.sources.includes("design")) has.push('<button type="button" class="sp-inline" data-sp="tab-design">Existing Design</button>');
    if (cfg.sources.includes("address")) has.push('<button type="button" class="sp-inline" data-sp="tab-address">Property Address</button>');
    if (!has.length) return "";
    return '<p class="sp-line">Or Use Something You Already Have: ' + has.join('<em class="sp-dot">·</em>') + "</p>";
  }

  /** One collapsed line for a listing link, expanding to an input inline. */
  function listingLine() {
    if (!cfg.sources.includes("url")) return "";
    if (!state.listing) {
      return (
        '<p class="sp-line"><b>Have A Listing Link?</b> ' +
        '<button type="button" class="sp-inline" data-sp="listing">Paste It To Fill In The Property Details</button></p>'
      );
    }
    return (
      '<div class="sp-listing">' +
      '<div class="sp-listing-h"><b>Have A Listing Link?</b><span>Paste It To Fill In The Property Details</span></div>' +
      '<div class="sp-listing-r">' +
      '<input type="text" id="spUrl" placeholder="https://www.zillow.com/homedetails/..." value="' + esc(state.url) + '">' +
      '<button type="button" class="btn btn-primary btn-sm" data-sp="urlgo">' + (state.busy ? "Reading" : "Read Listing Details") + "</button>" +
      "</div>" +
      '<p class="sp-note">We pull the address, price, beds, baths and square footage to set up your project. Photos come from you, because listing photos usually belong to the photographer or the brokerage.</p>' +
      "</div>"
    );
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
      panel() +
      (state.tab === "upload" ? workspaceLine() + listingLine() : "") +
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

  function onClick(e: Event) {
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
      if (picked) opts.onPick([picked]);
      return;
    }
    const act = t.closest("[data-sp]") as HTMLElement | null;
    if (!act) return;
    const k = act.dataset["sp"];
    if (k && k.startsWith("tab-")) {
      state.tab = k.slice(4) as SourceId;
      state.note = "";
      opts.onTab?.(state.tab);
      render();
      return;
    }
    if (k === "listing") {
      state.listing = true;
      render();
      return;
    }
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
