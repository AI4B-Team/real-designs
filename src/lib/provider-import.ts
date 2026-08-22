/**
 * One shared cloud-import service for Google Drive and Dropbox.
 *
 * Every entry point in the app (Studio, Prepare Your Photos, Photo Design,
 * Video Builder, Media, Canvas, Replace Photo, Add More Photos) calls
 * `importFromProvider` and receives real `File` objects, which each host then
 * puts through its own durable upload pipeline. There is no second provider
 * modal anywhere else.
 *
 * Nothing here fakes a connection. When a provider SDK is configured we run the
 * real authorization and the real picker. When it is not, we fall back to the
 * genuinely working share-link import (server side, allowlisted hosts only) —
 * never a blank shell, never a fake success.
 */

import "@/styles/rd-provider-import.css";
import { DRIVE_ICON, DROPBOX_ICON } from "@/lib/brand-icons";

export type ProviderId = "drive" | "dropbox";
export type ProviderMode = "picker" | "link";

export type ProviderConfig = {
  id: ProviderId;
  label: string;
  icon: string;
  mode: ProviderMode;
  /** Config values missing for the real SDK picker (empty when mode is picker). */
  missing: string[];
};

export type ImportOptions = {
  /** Receives the imported photos. Called once, only with real files. */
  onFiles: (files: File[]) => void | Promise<void>;
  /** Fallback: open the computer file dialog. */
  onComputer?: () => void | Promise<void>;
  /** Where the import lands. Carried through for logging and host behaviour. */
  destination?:
    | "studio-project"
    | "photo-design"
    | "video-draft"
    | "media-library"
    | "replace-asset"
    | "canvas-room";
  /** Repaint hook so hosts can refresh Lucide icons. */
  paint?: () => void;
};

const OK_EXT = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
const OK_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function env(name: string): string {
  try {
    return String((import.meta as any).env?.[name] || "").trim();
  } catch {
    return "";
  }
}

/** Never guesses: a provider is "configured" only when every required key exists. */
export function providerConfig(id: ProviderId): ProviderConfig {
  if (id === "dropbox") {
    const key = env("VITE_DROPBOX_APP_KEY");
    return {
      id,
      label: "Dropbox",
      icon: DROPBOX_ICON,
      mode: key ? "picker" : "link",
      missing: key ? [] : ["VITE_DROPBOX_APP_KEY"],
    };
  }
  const clientId = env("VITE_GOOGLE_PICKER_CLIENT_ID");
  const apiKey = env("VITE_GOOGLE_PICKER_API_KEY");
  const missing: string[] = [];
  if (!clientId) missing.push("VITE_GOOGLE_PICKER_CLIENT_ID");
  if (!apiKey) missing.push("VITE_GOOGLE_PICKER_API_KEY");
  return {
    id,
    label: "Google Drive",
    icon: DRIVE_ICON,
    mode: missing.length ? "link" : "picker",
    missing,
  };
}

/** Drive and Dropbox always have a working path, so no button is ever dead. */
export function providerAvailable(id: ProviderId): boolean {
  const c = providerConfig(id);
  return c.mode === "picker" || c.mode === "link";
}

/* ------------------------------------------------------------------ modal */

type Modal = {
  root: HTMLElement;
  body: HTMLElement;
  footer: HTMLElement;
  /** Blocks Escape / backdrop while final persistence runs. */
  setLocked: (on: boolean) => void;
  isOpen: () => boolean;
  close: () => void;
};

let OPEN: Modal | null = null;

function esc(s: unknown): string {
  return String(s == null ? "" : s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}

export function closeProviderModal() {
  OPEN?.close();
}

/** The one authoritative modal. One node, one backdrop, one close path. */
export function openProviderModal(cfg: ProviderConfig, paint?: () => void): Modal {
  closeProviderModal();
  const returnFocus = document.activeElement as HTMLElement | null;
  const scrollY = window.scrollY || 0;
  const prevOverflow = document.body.style.overflow;

  const root = document.createElement("div");
  root.className = "rdpi-back";
  const titleId = "rdpi-title-" + Math.random().toString(36).slice(2, 8);
  root.innerHTML = `<div class="rdpi" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
    <div class="rdpi-h">
      <span class="rdpi-logo">${cfg.icon}</span>
      <h3 id="${titleId}">Import From ${esc(cfg.label)}</h3>
      <button type="button" class="rdpi-x" data-rdpi-close aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="rdpi-b" tabindex="-1"></div>
    <div class="rdpi-f"></div>
  </div>`;
  document.body.appendChild(root);
  document.body.style.overflow = "hidden";

  let locked = false;
  let open = true;

  const close = () => {
    if (!open) return;
    open = false;
    try {
      root.remove();
    } finally {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      window.scrollTo({ top: scrollY });
      if (OPEN === modal) OPEN = null;
      try {
        returnFocus?.focus?.();
      } catch {
        /* the trigger may be gone after a re-render */
      }
    }
  };

  function onKey(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape" && !locked) {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])',
      ),
    ).filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (!focusables.length) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  root.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-rdpi-close]")) {
      close();
      return;
    }
    if (t === root && !locked) close();
  });
  document.addEventListener("keydown", onKey, true);

  const modal: Modal = {
    root,
    body: root.querySelector(".rdpi-b") as HTMLElement,
    footer: root.querySelector(".rdpi-f") as HTMLElement,
    setLocked: (on) => {
      locked = on;
    },
    isOpen: () => open,
    close,
  };
  OPEN = modal;
  paint?.();
  root.querySelector<HTMLElement>("[data-rdpi-close]")?.focus();
  return modal;
}

function showState(m: Modal, label: string, note = "") {
  if (!m.isOpen()) return;
  m.body.innerHTML =
    `<div class="rdpi-state"><span class="rdpi-spin"></span><span>${esc(label)}</span></div>` +
    (note ? `<p>${esc(note)}</p>` : "");
}

function showError(m: Modal, message: string, retry: () => void, opts: ImportOptions) {
  if (!m.isOpen()) return;
  m.body.innerHTML = `<p class="rdpi-err">${esc(message)}</p>
    <p>Your photos, room types and design settings are untouched.</p>`;
  m.footer.innerHTML = `<button type="button" class="rdpi-btn rdpi-alt" data-rdpi-computer>Choose From Computer</button>
    <button type="button" class="rdpi-btn" data-rdpi-close>Cancel</button>
    <button type="button" class="rdpi-btn primary" data-rdpi-retry>Retry</button>`;
  m.footer.querySelector("[data-rdpi-retry]")?.addEventListener("click", () => retry());
  m.footer.querySelector("[data-rdpi-computer]")?.addEventListener("click", () => {
    m.close();
    void opts.onComputer?.();
  });
  m.footer.querySelector<HTMLElement>("[data-rdpi-retry]")?.focus();
}

/* ------------------------------------------------------------- utilities */

export function isSupportedPhotoName(name: string, mime = ""): boolean {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return OK_EXT.includes(ext) || OK_MIME.includes(mime.toLowerCase());
}

function loadScript(src: string, attrs: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const found = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (found) {
      if ((found as any).__rdLoaded) return resolve();
      found.addEventListener("load", () => resolve());
      found.addEventListener("error", () => reject(new Error("script failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    s.addEventListener("load", () => {
      (s as any).__rdLoaded = true;
      resolve();
    });
    s.addEventListener("error", () => reject(new Error("script failed")));
    document.head.appendChild(s);
  });
}

function dataUrlToFile(data: string, name: string, type: string): File {
  const bin = atob(data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type });
}

/* ------------------------------------------------------- share-link mode */

async function linkImport(m: Modal, cfg: ProviderConfig, opts: ImportOptions) {
  if (!m.isOpen()) return;
  const hint =
    cfg.id === "dropbox"
      ? "Copy a Dropbox share link for each photo (Share → Copy link) and paste them below, one per line."
      : "In Google Drive choose Share → Copy link for each photo (set to “Anyone with the link”) and paste them below, one per line.";
  m.body.innerHTML = `<p>${esc(hint)}</p>
    <textarea data-rdpi-links aria-label="${esc(cfg.label)} Share Links" placeholder="https://..."></textarea>`;
  m.footer.innerHTML = `<button type="button" class="rdpi-btn rdpi-alt" data-rdpi-computer>Choose From Computer</button>
    <button type="button" class="rdpi-btn" data-rdpi-close>Cancel</button>
    <button type="button" class="rdpi-btn primary" data-rdpi-go>Import Photos</button>`;
  const area = m.body.querySelector<HTMLTextAreaElement>("[data-rdpi-links]");
  area?.focus();
  m.footer.querySelector("[data-rdpi-computer]")?.addEventListener("click", () => {
    m.close();
    void opts.onComputer?.();
  });

  const go = m.footer.querySelector<HTMLButtonElement>("[data-rdpi-go]");
  go?.addEventListener("click", async () => {
    const urls = (area?.value || "")
      .split(/[\s,]+/)
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (!urls.length) {
      area?.focus();
      return;
    }
    go.disabled = true;
    showState(m, `Importing ${urls.length === 1 ? "1 Photo" : urls.length + " Photos"}…`);
    try {
      const { importCloudPhotos } = await import("@/lib/cloud-import.functions");
      const res: any = await importCloudPhotos({ data: { urls } });
      const files = (res?.files || []).map((f: any) => dataUrlToFile(f.data, f.name, f.type));
      if (!files.length) {
        showError(
          m,
          res?.errors?.[0]?.message ||
            "Nothing could be read from those links. Check that they are shared publicly.",
          () => void linkImport(m, cfg, opts),
          opts,
        );
        return;
      }
      await finish(m, files, opts);
    } catch {
      showError(
        m,
        "Those links could not be read. Please try again.",
        () => void linkImport(m, cfg, opts),
        opts,
      );
    }
  });
}

/** Hands the imported files to the host, then closes. */
async function finish(m: Modal, files: File[], opts: ImportOptions) {
  m.setLocked(true);
  showState(m, `Adding ${files.length === 1 ? "1 Photo" : files.length + " Photos"}…`);
  try {
    await opts.onFiles(files);
  } finally {
    m.setLocked(false);
    m.close();
  }
}

/* -------------------------------------------------------- Google Picker */

async function drivePicker(m: Modal, opts: ImportOptions) {
  const clientId = env("VITE_GOOGLE_PICKER_CLIENT_ID");
  const apiKey = env("VITE_GOOGLE_PICKER_API_KEY");
  const appId = env("VITE_GOOGLE_PICKER_APP_ID");
  showState(m, "Connecting To Google Drive…");
  await loadScript("https://accounts.google.com/gsi/client");
  await loadScript("https://apis.google.com/js/api.js");
  const g = (window as any).google;
  const gapi = (window as any).gapi;
  if (!g?.accounts?.oauth2 || !gapi) throw new Error("sdk");

  const token: string = await new Promise((resolve, reject) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      callback: (r: any) => (r?.access_token ? resolve(r.access_token) : reject(new Error("auth"))),
      error_callback: () => reject(new Error("auth")),
    });
    client.requestAccessToken();
  });

  showState(m, "Opening Google Drive…");
  await new Promise<void>((resolve) => gapi.load("picker", () => resolve()));
  const picker = (window as any).google.picker;

  const docs: any[] = await new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.DOCS_IMAGES)
      .setIncludeFolders(true)
      .setMimeTypes(OK_MIME.join(","));
    const p = new picker.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(apiKey)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .addView(view)
      .setCallback((d: any) => {
        if (d.action === picker.Action.PICKED) resolve(d.docs || []);
        else if (d.action === picker.Action.CANCEL) resolve([]);
      });
    if (appId) p.setAppId(appId);
    p.build().setVisible(true);
  });

  if (!docs.length) {
    m.close();
    return;
  }
  const files: File[] = [];
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    showState(m, `Importing ${i + 1} Of ${docs.length}…`);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(d.id)}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) continue;
    const blob = await res.blob();
    const name = String(d.name || `drive-${d.id}.jpg`);
    if (!isSupportedPhotoName(name, blob.type)) continue;
    files.push(new File([blob], name, { type: blob.type || "image/jpeg" }));
  }
  if (!files.length) throw new Error("import");
  await finish(m, files, opts);
}

/* ------------------------------------------------------- Dropbox Chooser */

async function dropboxChooser(m: Modal, opts: ImportOptions) {
  const appKey = env("VITE_DROPBOX_APP_KEY");
  showState(m, "Connecting To Dropbox…");
  await loadScript("https://www.dropbox.com/static/api/2/dropins.js", {
    id: "dropboxjs",
    "data-app-key": appKey,
  });
  const Dropbox = (window as any).Dropbox;
  if (!Dropbox?.choose) throw new Error("sdk");

  showState(m, "Opening Dropbox…");
  const picked: any[] = await new Promise((resolve) => {
    Dropbox.choose({
      linkType: "direct",
      multiselect: true,
      extensions: OK_EXT.map((e) => "." + e),
      success: (sel: any[]) => resolve(sel || []),
      cancel: () => resolve([]),
    });
  });
  if (!picked.length) {
    m.close();
    return;
  }

  const files: File[] = [];
  const fallback: string[] = [];
  for (let i = 0; i < picked.length; i++) {
    const item = picked[i];
    showState(m, `Importing ${i + 1} Of ${picked.length}…`);
    try {
      const res = await fetch(item.link);
      if (!res.ok) throw new Error("fetch");
      const blob = await res.blob();
      files.push(new File([blob], String(item.name || "dropbox.jpg"), {
        type: blob.type || "image/jpeg",
      }));
    } catch {
      /* Expiring preview links are never stored: re-fetch server side instead. */
      fallback.push(String(item.link));
    }
  }
  if (fallback.length) {
    const { importCloudPhotos } = await import("@/lib/cloud-import.functions");
    const res: any = await importCloudPhotos({ data: { urls: fallback.slice(0, 20) } });
    (res?.files || []).forEach((f: any) => files.push(dataUrlToFile(f.data, f.name, f.type)));
  }
  if (!files.length) throw new Error("import");
  await finish(m, files, opts);
}

/* ------------------------------------------------------------ entry point */

let RUNNING = false;

/**
 * The single import entry point. Opens the modal only with meaningful content,
 * and always leaves the page unlocked — success, cancel or failure.
 */
export async function importFromProvider(id: ProviderId, opts: ImportOptions): Promise<void> {
  if (RUNNING) return;
  RUNNING = true;
  const cfg = providerConfig(id);
  const m = openProviderModal(cfg, opts.paint);
  m.footer.innerHTML = `<button type="button" class="rdpi-btn" data-rdpi-close>Cancel</button>`;
  try {
    const run = async () => {
      if (cfg.mode === "picker") {
        if (id === "drive") await drivePicker(m, opts);
        else await dropboxChooser(m, opts);
      } else {
        await linkImport(m, cfg, opts);
      }
    };
    try {
      await run();
    } catch (error) {
      const why =
        (error as Error)?.message === "auth"
          ? `${cfg.label} did not finish authorizing. Please try again.`
          : `${cfg.label} could not be opened. Please try again, or choose photos from your computer.`;
      showError(m, why, () => void importRetry(id, opts), opts);
    }
  } finally {
    RUNNING = false;
    /* A crash before any state rendered must never leave a blank overlay. */
    if (m.isOpen() && !m.body.textContent?.trim()) m.close();
    opts.paint?.();
  }
}

function importRetry(id: ProviderId, opts: ImportOptions) {
  closeProviderModal();
  void importFromProvider(id, opts);
}
