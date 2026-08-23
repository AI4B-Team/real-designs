/**
 * One shared cloud-import service for Google Drive and Dropbox.
 *
 * Every entry point in the app calls `importFromProvider` and receives real
 * `File` objects, which each host then puts through its own durable upload
 * pipeline.
 *
 * Nothing here fakes a connection and nothing here is a second source picker.
 * A Google Drive modal contains only the Google Drive workflow; a Dropbox
 * modal contains only the Dropbox workflow. When a provider is not configured
 * there is no modal at all — the button is honestly disabled and the host
 * shows the "isn't available yet" message.
 */

import "@/styles/rd-provider-import.css";
import { DRIVE_ICON, DROPBOX_ICON } from "@/lib/brand-icons";
import { escapeHtml as esc } from "@/lib/safe-html";

export type ProviderId = "drive" | "dropbox";

export type ProviderConfig = {
  id: ProviderId;
  label: string;
  icon: string;
  /** True only when every key the real SDK flow needs is present. */
  configured: boolean;
  /** Config values missing for the real SDK picker. */
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
  /** Called instead of opening anything when the provider is not configured. */
  onUnavailable?: (message: string) => void;
};

const OK_EXT = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
const OK_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const FILE_NOTE = "Supported photos: JPG, PNG, WEBP and HEIC.";

function env(name: string): string {
  try {
    const override = (globalThis as any).__RD_PROVIDER_ENV?.[name];
    if (override) return String(override).trim();
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
      configured: !!key,
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
    configured: missing.length === 0,
    missing,
  };
}

/** A provider button is only real when its authorization flow is configured. */
export function providerAvailable(id: ProviderId): boolean {
  return providerConfig(id).configured;
}

/** The honest message shown when a provider has no working integration. */
export function providerUnavailableMessage(id: ProviderId): string {
  return `${providerConfig(id).label} isn't available yet. Choose photos from your computer.`;
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
  root.innerHTML = `<div class="rdpi" role="dialog" aria-modal="true" aria-labelledby="${titleId}" data-provider="${cfg.id}">
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
  m.footer.innerHTML = `<button type="button" class="rdpi-btn" data-rdpi-close>Cancel</button>`;
}

/** Honest, never-blank state for a provider with no working integration. */
function showUnavailable(m: Modal, cfg: ProviderConfig, opts: ImportOptions) {
  if (!m.isOpen()) return;
  m.body.innerHTML = `<p class="rdpi-err">${esc(cfg.label)} isn't connected yet.</p>
    <p>Choose photos from your computer for now. Your photos, room types and design settings are untouched.</p>`;
  m.footer.innerHTML = `<button type="button" class="rdpi-btn" data-rdpi-close>Cancel</button>
    <button type="button" class="rdpi-btn primary" data-rdpi-computer>Choose From Computer</button>`;
  m.footer.querySelector("[data-rdpi-computer]")?.addEventListener("click", () => {
    m.close();
    void opts.onComputer?.();
  });
  m.footer.querySelector<HTMLElement>("[data-rdpi-computer]")?.focus();
}

function showError(m: Modal, message: string, retry: () => void, opts: ImportOptions) {
  if (!m.isOpen()) return;
  m.setLocked(false);
  m.body.innerHTML = `<p class="rdpi-err">${esc(message)}</p>
    <p>Your photos, room types and design settings are untouched.</p>`;
  m.footer.innerHTML = `<button type="button" class="rdpi-btn rdpi-alt" data-rdpi-computer>Choose From Computer</button>
    <button type="button" class="rdpi-btn" data-rdpi-close>Cancel</button>
    <button type="button" class="rdpi-btn primary" data-rdpi-retry>Try Again</button>`;
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

/* ---------------------------------------------------------- shared states */

/** Disconnected: one primary connect action, one cancel. Nothing else. */
function showDisconnected(m: Modal, cfg: ProviderConfig, connect: () => void) {
  if (!m.isOpen()) return;
  m.body.innerHTML = `<div class="rdpi-hero"><span class="rdpi-hero-logo">${cfg.icon}</span>
      <p>Connect ${esc(cfg.label)} to choose photos from your account.</p></div>
    <p class="rdpi-note">${esc(FILE_NOTE)}</p>`;
  m.footer.innerHTML = `<button type="button" class="rdpi-btn" data-rdpi-close>Cancel</button>
    <button type="button" class="rdpi-btn primary" data-rdpi-connect>Connect ${esc(cfg.label)}</button>`;
  const go = m.footer.querySelector<HTMLElement>("[data-rdpi-connect]");
  go?.addEventListener("click", () => connect());
  go?.focus();
}

/** Connected: account identity, one primary choose action, switch account. */
function showConnected(
  m: Modal,
  cfg: ProviderConfig,
  account: string,
  choose: () => void,
  again: () => void,
) {
  if (!m.isOpen()) return;
  m.body.innerHTML = `<div class="rdpi-acct"><span class="rdpi-acct-logo">${cfg.icon}</span>
      <span class="rdpi-acct-t"><b>Connected</b><span>${esc(account)}</span></span></div>
    <p class="rdpi-note">${esc(FILE_NOTE)}</p>`;
  m.footer.innerHTML = `<button type="button" class="rdpi-link rdpi-alt" data-rdpi-switch>Switch Account</button>
    <button type="button" class="rdpi-btn" data-rdpi-close>Cancel</button>
    <button type="button" class="rdpi-btn primary" data-rdpi-choose>Choose Photos</button>`;
  m.footer.querySelector("[data-rdpi-switch]")?.addEventListener("click", () => again());
  const go = m.footer.querySelector<HTMLElement>("[data-rdpi-choose]");
  go?.addEventListener("click", () => choose());
  go?.focus();
}

/* -------------------------------------------------------- Google Picker */

async function driveToken(prompt: boolean): Promise<string> {
  const clientId = env("VITE_GOOGLE_PICKER_CLIENT_ID");
  await loadScript("https://accounts.google.com/gsi/client");
  const g = (window as any).google;
  if (!g?.accounts?.oauth2) throw new Error("sdk");
  return await new Promise<string>((resolve, reject) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope:
        "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email",
      prompt: prompt ? "consent select_account" : "",
      callback: (r: any) =>
        r?.access_token ? resolve(r.access_token) : reject(new Error("canceled")),
      error_callback: () => reject(new Error("canceled")),
    });
    client.requestAccessToken();
  });
}

async function driveAccount(token: string): Promise<string> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: any = res.ok ? await res.json() : null;
    return String(json?.email || json?.name || "Your Google Account");
  } catch {
    return "Your Google Account";
  }
}

async function drivePick(m: Modal, token: string, opts: ImportOptions) {
  const apiKey = env("VITE_GOOGLE_PICKER_API_KEY");
  const appId = env("VITE_GOOGLE_PICKER_APP_ID");
  showState(m, "Opening Google Drive…");
  await loadScript("https://apis.google.com/js/api.js");
  const gapi = (window as any).gapi;
  if (!gapi) throw new Error("sdk");
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

async function driveFlow(m: Modal, cfg: ProviderConfig, opts: ImportOptions) {
  const connect = (prompt: boolean) => {
    showState(m, "Connecting To Google Drive…");
    void (async () => {
      try {
        const token = await driveToken(prompt);
        const account = await driveAccount(token);
        showConnected(
          m,
          cfg,
          account,
          () => {
            void (async () => {
              try {
                await drivePick(m, token, opts);
              } catch (e) {
                fail(m, cfg, e, () => connect(false), opts);
              }
            })();
          },
          () => connect(true),
        );
      } catch (e) {
        fail(m, cfg, e, () => connect(true), opts);
      }
    })();
  };
  showDisconnected(m, cfg, () => connect(false));
}

/* ------------------------------------------------------- Dropbox Chooser */

async function dropboxPick(m: Modal, opts: ImportOptions) {
  const appKey = env("VITE_DROPBOX_APP_KEY");
  showState(m, "Connecting To Dropbox…");
  await loadScript("https://www.dropbox.com/static/api/2/dropins.js", {
    id: "dropboxjs",
    "data-app-key": appKey,
  });
  const Dropbox = (window as any).Dropbox;
  if (!Dropbox?.choose) throw new Error("sdk");

  showState(m, "Opening Dropbox…");
  const picked: any[] = await new Promise((resolve, reject) => {
    try {
      Dropbox.choose({
        linkType: "direct",
        multiselect: true,
        extensions: OK_EXT.map((e) => "." + e),
        success: (sel: any[]) => resolve(sel || []),
        cancel: () => resolve([]),
      });
    } catch {
      reject(new Error("sdk"));
    }
  });
  if (!picked.length) {
    m.close();
    return;
  }

  const files: File[] = [];
  for (let i = 0; i < picked.length; i++) {
    const item = picked[i];
    showState(m, `Importing ${i + 1} Of ${picked.length}…`);
    try {
      const res = await fetch(item.link);
      if (!res.ok) throw new Error("fetch");
      const blob = await res.blob();
      files.push(
        new File([blob], String(item.name || "dropbox.jpg"), {
          type: blob.type || "image/jpeg",
        }),
      );
    } catch {
      /* one unreadable file must not abort the rest of the import */
    }
  }
  if (!files.length) throw new Error("import");
  await finish(m, files, opts);
}

function dropboxFlow(m: Modal, cfg: ProviderConfig, opts: ImportOptions) {
  const connect = () => {
    void (async () => {
      try {
        await dropboxPick(m, opts);
      } catch (e) {
        fail(m, cfg, e, connect, opts);
      }
    })();
  };
  showDisconnected(m, cfg, connect);
}

/* ------------------------------------------------------------ entry point */

function fail(
  m: Modal,
  cfg: ProviderConfig,
  error: unknown,
  retry: () => void,
  opts: ImportOptions,
) {
  const code = (error as Error)?.message;
  const why =
    code === "canceled"
      ? "Connection was canceled."
      : code === "import"
        ? `Those photos could not be read from ${cfg.label}. Please try again.`
        : `${cfg.label} could not be opened. Please try again, or choose photos from your computer.`;
  showError(m, why, retry, opts);
}

let RUNNING = false;

/**
 * The single import entry point. Opens one provider-specific modal, or nothing
 * at all when the integration is not configured. Always leaves the page
 * unlocked — success, cancel or failure.
 */
export async function importFromProvider(id: ProviderId, opts: ImportOptions): Promise<boolean> {
  if (RUNNING) return false;
  const cfg = providerConfig(id);
  if (!cfg.configured) {
    /* Hosts that render their own inline note keep that behaviour. Everyone
       else gets an honest, compact explanation instead of a dead button. */
    if (opts.onUnavailable) {
      opts.onUnavailable(providerUnavailableMessage(id));
      return false;
    }
    showUnavailable(openProviderModal(cfg, opts.paint), cfg, opts);
    return true;
  }
  RUNNING = true;
  const m = openProviderModal(cfg, opts.paint);
  try {
    if (id === "drive") await driveFlow(m, cfg, opts);
    else dropboxFlow(m, cfg, opts);
  } catch (e) {
    fail(m, cfg, e, () => void importFromProvider(id, opts), opts);
  } finally {
    RUNNING = false;
    /* A crash before any state rendered must never leave a blank overlay. */
    if (m.isOpen() && !m.body.textContent?.trim()) m.close();
    opts.paint?.();
  }
  return true;
}

/* ------------------------------------------------------- canonical ids */

/** Stable, provider-specific values used by hosts and persisted state. The
    "Cloud" tab is only a visual grouping: these never collapse into one id. */
export type CloudProvider = "google-drive" | "dropbox";

export const CLOUD_PROVIDERS: CloudProvider[] = ["google-drive", "dropbox"];

/** Maps a canonical cloud provider id onto the internal adapter id. */
export function toProviderId(p: CloudProvider): ProviderId {
  return p === "google-drive" ? "drive" : "dropbox";
}

/** True when that provider's real SDK flow has every key it needs. */
export function cloudProviderAvailable(p: CloudProvider): boolean {
  return providerAvailable(toProviderId(p));
}
