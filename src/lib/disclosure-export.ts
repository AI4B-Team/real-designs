/**
 * REAL DESIGNS — the single export sheet for disclosures and watermarks.
 *
 * Every download, share, presentation or listing export goes through
 * `openDisclosureExport`. It classifies each version on its own, recommends a
 * disclosure, previews exactly what will be baked, then writes the files and
 * the audit trail. Re-exporting with different wording never re-runs AI and
 * never costs credits.
 */
import { escapeHtml as esc } from "@/lib/safe-html";

import { formDialog } from "@/lib/photo-editor-dialogs";
import { rdToast } from "@/lib/rd-toast";
import { bakeDisclosure } from "@/lib/disclosure-render";
import { buildZip, dataUrlToBytes } from "@/lib/zip-store";
import { recordExportAudit } from "@/lib/disclosure-audit.functions";
import { loadDisclosureSettings, saveDisclosureSettings } from "@/lib/disclosure-settings";
import {
  buildExportAudit,
  captionFor,
  classifyVersion,
  COMPLIANCE_NOTE,
  CUSTOM_DISCLOSURE_LIMIT,
  DISCLOSURE_OPTIONS,
  EXPORT_SCOPES,
  noDisclosureWarning,
  normalizeSettings,
  planBatchExport,
  POSITIONS,
  recommendDisclosure,
  STYLES,
  type DisclosureId,
  type DisclosurePosition,
  type DisclosureSettings,
  type DisclosureStyle,
  type ExportItem,
  type ExportPurpose,
  type ExportScope,
} from "@/lib/disclosure";


const SIZES: { id: string; label: string; maxEdge: number; quality: number }[] = [
  { id: "mls", label: "MLS Standard — 1024px", maxEdge: 1024, quality: 0.85 },
  { id: "mls-hd", label: "MLS High Resolution — 2048px", maxEdge: 2048, quality: 0.9 },
  { id: "web", label: "Web & Social — 1600px", maxEdge: 1600, quality: 0.85 },
  { id: "full", label: "Full Resolution", maxEdge: 0, quality: 0.95 },
];

export type DisclosureExportOptions = {
  items: ExportItem[];
  /** What the export is for; changes the recommendation. */
  purpose?: ExportPurpose;
  scope?: ExportScope;
  title?: string;
  /** Quality-review lines shown above the controls. */
  notes?: string[];
  /** Called with the exported files instead of downloading them. */
  onExported?: (files: { name: string; dataUrl: string }[]) => void;
};

function fileBase(name: string): string {
  return (
    String(name || "photo")
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase() || "photo"
  );
}

function readSettings(root: HTMLElement, base: DisclosureSettings): DisclosureSettings {
  const get = (k: string) => root.querySelector(`[data-x="${k}"]`) as HTMLInputElement | null;
  const num = (k: string, dflt: number) => {
    const v = Number(get(k)?.value);
    return Number.isFinite(v) ? v : dflt;
  };
  return normalizeSettings({
    ...base,
    id: (get("disc")?.value as DisclosureId) || base.id,
    customText: get("custom")?.value ?? base.customText,
    position: (get("pos")?.value as DisclosurePosition) || base.position,
    style: (get("style")?.value as DisclosureStyle) || base.style,
    fontScale: num("font", base.fontScale * 1000) / 1000,
    textColor: get("tcol")?.value || base.textColor,
    bgColor: get("bcol")?.value || base.bgColor,
    bgOpacity: num("opac", base.bgOpacity * 100) / 100,
    padding: num("pad", base.padding * 100) / 100,
    margin: num("marg", base.margin * 1000) / 1000,
    logoScale: num("logo", base.logoScale * 100) / 100,
    logoPosition: (get("logopos")?.value as "left" | "right") || base.logoPosition,
    radius: num("rad", base.radius * 100) / 100,
    autoContrast: get("contrast")?.checked ?? base.autoContrast,
  });
}

/**
 * Open the export sheet. Resolves once files have been produced (or the user
 * cancelled). Never mutates the clean master.
 */
export async function openDisclosureExport(opts: DisclosureExportOptions): Promise<boolean> {
  const items = (opts.items || []).filter((i) => i && i.src);
  if (!items.length) {
    rdToast("There Is Nothing To Export Yet.");
    return false;
  }
  const purpose: ExportPurpose = opts.purpose || "listing";
  const scope: ExportScope = opts.scope || (items.length > 1 ? "selected-photos" : "current-photo");
  const saved = await loadDisclosureSettings();
  const first = items[0] as ExportItem;
  const firstClass = classifyVersion({
    operations: first.operations || [],
    hasAdjustments: !!first.hasAdjustments,
    override: first.classificationOverride ?? null,
  });
  const rec = recommendDisclosure({
    classification: firstClass,
    purpose,
    workspaceDefault: saved.id,
    customText: saved.customText,
  });
  const base = normalizeSettings({ ...saved, id: rec.id });

  const scopeLabel = EXPORT_SCOPES.find((s) => s.id === scope)?.label || "Current Photo";
  const opt = (v: string, label: string, on: boolean) =>
    `<option value="${esc(v)}"${on ? " selected" : ""}>${esc(label)}</option>`;

  let latest: DisclosureSettings = base;
  let timer: number | null = null;

  const body = `
    <p class="rdpe-hint">${esc(scopeLabel)} · ${items.length} File${items.length === 1 ? "" : "s"} · Classified As <strong>${esc(firstClass)}</strong>${items.length > 1 ? " And Others" : ""}.</p>
    ${(opts.notes || []).length ? `<ul class="rdpe-review">${(opts.notes || []).map((n) => `<li class="rdpe-review-warn">${esc(n)}</li>`).join("")}</ul>` : ""}
    <div class="rdde-prev"><img data-x="preview" alt="Disclosure Preview" /></div>
    <p class="rdpe-hint" data-x="warn"></p>
    <label class="rdpe-dlg-l">Disclosure</label>
    <select class="rdpe-dlg-s" data-x="disc">${DISCLOSURE_OPTIONS.map((d) => opt(d.id, d.label, d.id === base.id)).join("")}</select>
    <p class="rdpe-hint" data-x="reason">${esc(rec.reason)}</p>
    <label class="rdpe-dlg-l">Custom Wording</label>
    <input class="rdpe-dlg-i" data-x="custom" maxlength="${CUSTOM_DISCLOSURE_LIMIT}" value="${esc(base.customText)}" placeholder="Virtually Staged — Furniture Is Not Included" />
    <div class="rdde-two">
      <div><label class="rdpe-dlg-l">Position</label>
        <select class="rdpe-dlg-s" data-x="pos">${POSITIONS.map((p) => opt(p.id, p.label, p.id === base.position)).join("")}</select></div>
      <div><label class="rdpe-dlg-l">Style</label>
        <select class="rdpe-dlg-s" data-x="style">${STYLES.map((s) => opt(s.id, s.label, s.id === base.style)).join("")}</select></div>
    </div>
    <details class="rdde-adv"><summary>Visual Settings</summary>
      <div class="rdde-two">
        <div><label class="rdpe-dlg-l">Font Size</label><input class="rdpe-dlg-r" type="range" min="12" max="60" data-x="font" value="${Math.round(base.fontScale * 1000)}" /></div>
        <div><label class="rdpe-dlg-l">Background Opacity</label><input class="rdpe-dlg-r" type="range" min="0" max="100" data-x="opac" value="${Math.round(base.bgOpacity * 100)}" /></div>
        <div><label class="rdpe-dlg-l">Internal Padding</label><input class="rdpe-dlg-r" type="range" min="0" max="150" data-x="pad" value="${Math.round(base.padding * 100)}" /></div>
        <div><label class="rdpe-dlg-l">Edge Margin</label><input class="rdpe-dlg-r" type="range" min="0" max="80" data-x="marg" value="${Math.round(base.margin * 1000)}" /></div>
        <div><label class="rdpe-dlg-l">Corner Radius</label><input class="rdpe-dlg-r" type="range" min="0" max="120" data-x="rad" value="${Math.round(base.radius * 100)}" /></div>
        <div><label class="rdpe-dlg-l">Logo Size</label><input class="rdpe-dlg-r" type="range" min="60" max="320" data-x="logo" value="${Math.round(base.logoScale * 100)}" /></div>
        <div><label class="rdpe-dlg-l">Text Color</label><input class="rdpe-dlg-i" type="color" data-x="tcol" value="${esc(base.textColor)}" /></div>
        <div><label class="rdpe-dlg-l">Background Color</label><input class="rdpe-dlg-i" type="color" data-x="bcol" value="${esc(base.bgColor)}" /></div>
        <div><label class="rdpe-dlg-l">Logo Position</label>
          <select class="rdpe-dlg-s" data-x="logopos">${opt("left", "Left", base.logoPosition === "left")}${opt("right", "Right", base.logoPosition === "right")}</select></div>
      </div>
      <label class="rdpe-dlg-c"><input type="checkbox" data-x="contrast" ${base.autoContrast ? "checked" : ""} /> Automatic Contrast Protection</label>
    </details>
    <label class="rdpe-dlg-l">Export Size</label>
    <select class="rdpe-dlg-s" data-x="preset">${SIZES.map((s) => opt(s.id, s.label, s.id === "full")).join("")}</select>
    ${items.length > 1 ? `<label class="rdpe-dlg-c"><input type="checkbox" data-x="force" /> Use This Disclosure For Every File</label><div class="rdde-exc" data-x="exceptions"></div>` : ""}
    <p class="rdpe-hint rdde-note">${esc(COMPLIANCE_NOTE)}</p>`;

  const refresh = (root: HTMLElement) => {
    latest = readSettings(root, base);
    const warn = noDisclosureWarning(firstClass, latest.id);
    const w = root.querySelector('[data-x="warn"]') as HTMLElement | null;
    if (w) {
      w.textContent = warn || "";
      w.classList.toggle("rdde-warn", !!warn);
    }
    if (items.length > 1) {
      const force = (root.querySelector('[data-x="force"]') as HTMLInputElement | null)?.checked;
      const plan = planBatchExport({
        items,
        base: latest,
        purpose,
        workspaceDefault: saved.id,
        forceId: force ? latest.id : null,
      });
      const holder = root.querySelector('[data-x="exceptions"]') as HTMLElement | null;
      const exceptions = plan.filter((p) => p.exception);
      if (holder)
        holder.innerHTML = exceptions.length
          ? `<ul class="rdpe-review">${exceptions
              .map((p) => `<li class="rdpe-review-warn">${esc(p.exception)}</li>`)
              .join("")}</ul>`
          : `<p class="rdpe-hint">Each File Is Classified On Its Own. No Exceptions To Review.</p>`;
    }
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const img = root.querySelector('[data-x="preview"]') as HTMLImageElement | null;
      if (!img) return;
      bakeDisclosure(first.src, latest, { maxEdge: 720, quality: 0.8 })
        .then((r) => {
          img.src = r.dataUrl;
        })
        .catch(() => {
          img.src = first.src;
        });
    }, 140);
  };

  const root = await formDialog({
    title: opts.title || "Export With Disclosure",
    body,
    confirmLabel: items.length > 1 ? "Export Files" : "Export Photo",
    onInput: refresh,
  });
  if (!root) return false;

  const settings = readSettings(root, base);
  const presetId = (root.querySelector('[data-x="preset"]') as HTMLSelectElement)?.value || "full";
  const size = SIZES.find((s) => s.id === presetId) || (SIZES[3] as (typeof SIZES)[number]);
  const force = (root.querySelector('[data-x="force"]') as HTMLInputElement | null)?.checked;
  const plan = planBatchExport({
    items,
    base: settings,
    purpose,
    workspaceDefault: saved.id,
    forceId: force ? settings.id : null,
  });

  void saveDisclosureSettings(settings);

  try {
    const files: { name: string; dataUrl: string }[] = [];
    for (const p of plan) {
      const baked = await bakeDisclosure(p.item.src, p.settings, {
        maxEdge: size.maxEdge,
        quality: size.quality,
      });
      files.push({
        name: `${fileBase(p.item.name)}-${p.settings.id}-${size.id}.jpg`,
        dataUrl: baked.dataUrl,
      });
    }

    if (opts.onExported) opts.onExported(files);
    else if (files.length === 1) {
      const a = document.createElement("a");
      a.href = (files[0] as { dataUrl: string }).dataUrl;
      a.download = (files[0] as { name: string }).name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      const zip = buildZip(files.map((f) => ({ name: f.name, bytes: dataUrlToBytes(f.dataUrl) })));
      const url = URL.createObjectURL(zip);
      const a = document.createElement("a");
      a.href = url;
      a.download = `real-designs-export-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    /* Audit trail. Never blocks the download and never carries prompts. */
    void recordExportAudit({
      data: {
        rows: plan.map((p, i) => {
          const audit = buildExportAudit({
            classification: p.classification,
            settings: p.settings,
            preset: size.id,
            scope,
            assetId: p.item.assetId ?? p.item.id ?? null,
            versionId: p.item.versionId ?? null,
          });
          return {
            classification: audit.classification,
            disclosure_id: audit.disclosure_id,
            disclosure_text: audit.disclosure_text,
            export_preset: audit.export_preset,
            scope: audit.scope,
            asset_id: audit.asset_id,
            version_id: audit.version_id,
            file_name: files[i]?.name ?? null,
          };
        }),
      },
    }).catch(() => {
      /* exports never fail because logging did */
    });

    rdToast(
      files.length === 1
        ? captionFor(settings)
          ? `Exported With “${captionFor(settings)}”.`
          : "Exported Without A Disclosure."
        : `${files.length} Files Exported.`,
    );
    return true;
  } catch (err: any) {
    rdToast(err?.message || "That Export Could Not Be Prepared.", "error");
    return false;
  }
}
