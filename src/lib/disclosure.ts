/**
 * REAL DESIGNS — canonical Disclosure & Watermark system (pure decisions).
 *
 * One place decides: what a version *is* (classification), which disclosure is
 * recommended, how the overlay is laid out, what a batch export should say per
 * photo, and what audit metadata an export carries.
 *
 * Nothing here touches a canvas or the DOM, so every rule is unit-tested.
 * The clean master is never modified: disclosure is an export-time overlay.
 */

/* ------------------------------------------------------- classification */

export type Classification =
  | "Original"
  | "Enhanced"
  | "Digitally Altered"
  | "Virtually Staged"
  | "Proposed Design"
  | "AI-Generated Concept"
  | "Renovation Visualization"
  | "Property Markup"
  | "Custom";

export const CLASSIFICATIONS: Classification[] = [
  "Original",
  "Enhanced",
  "Digitally Altered",
  "Virtually Staged",
  "Proposed Design",
  "AI-Generated Concept",
  "Renovation Visualization",
  "Property Markup",
  "Custom",
];

/** How material each classification is. Higher wins when operations combine. */
const RANK: Record<Classification, number> = {
  Original: 0,
  Enhanced: 1,
  "Property Markup": 2,
  "Digitally Altered": 3,
  "Virtually Staged": 4,
  "Proposed Design": 5,
  "Renovation Visualization": 6,
  "AI-Generated Concept": 7,
  Custom: 8,
};

/**
 * Operation → classification. Keys are the tool / enhancement identifiers used
 * across the Canvas so nothing depends on the user remembering what they did.
 */
export const OPERATION_CLASS: Record<string, Classification> = {
  /* light, colour, geometry */
  adjust: "Enhanced",
  crop: "Enhanced",
  rotate: "Enhanced",
  straighten: "Enhanced",
  perspective: "Enhanced",
  auto_enhance: "Enhanced",
  window_balance: "Enhanced",
  upscale: "Enhanced",
  /* pixels moved or invented */
  sky: "Digitally Altered",
  lawn: "Digitally Altered",
  dusk: "Digitally Altered",
  privacy_blur: "Digitally Altered",
  reflection: "Digitally Altered",
  tv_off: "Digitally Altered",
  fireplace: "Digitally Altered",
  object_edit: "Digitally Altered",
  declutter: "Digitally Altered",
  materials: "Digitally Altered",
  angles: "Digitally Altered",
  animate: "Digitally Altered",
  /* furniture added */
  stage: "Virtually Staged",
  virtual_stage: "Virtually Staged",
  /* design intent */
  redesign: "Proposed Design",
  variation: "Proposed Design",
  describe: "AI-Generated Concept",
  sketch: "AI-Generated Concept",
  floorplan: "AI-Generated Concept",
  concept: "AI-Generated Concept",
  /* renovation scope */
  renovation: "Renovation Visualization",
  remodel: "Renovation Visualization",
  structural: "Renovation Visualization",
  /* annotations drawn over a real photo */
  markup: "Property Markup",
  boundary: "Property Markup",
};

export type ClassifyInput = {
  /** Tool / enhancement ids applied to this version, in any order. */
  operations?: string[];
  /** Light, colour, detail, crop or geometry moved off zero. */
  hasAdjustments?: boolean;
  /** A user override always wins. */
  override?: Classification | null;
};

/** The strongest classification implied by the operations actually applied. */
export function classifyVersion(input: ClassifyInput): Classification {
  if (input.override) return input.override;
  let out: Classification = input.hasAdjustments ? "Enhanced" : "Original";
  for (const raw of input.operations || []) {
    const op = String(raw || "").toLowerCase();
    const c = OPERATION_CLASS[op] || "Digitally Altered";
    if (RANK[c] > RANK[out]) out = c;
  }
  return out;
}

/** True when the classification changes what a buyer would see in person. */
export function isMaterialAlteration(c: Classification): boolean {
  return RANK[c] >= RANK["Digitally Altered"];
}

/* ------------------------------------------------------------ disclosures */

export type DisclosureId =
  | "none"
  | "enhanced"
  | "altered"
  | "staged"
  | "concept"
  | "proposed"
  | "renovation"
  | "boundary"
  | "custom";

export type DisclosureOption = { id: DisclosureId; label: string; text: string };

export const DISCLOSURE_OPTIONS: DisclosureOption[] = [
  { id: "none", label: "No Disclosure", text: "" },
  { id: "enhanced", label: "Digitally Enhanced", text: "Digitally Enhanced" },
  { id: "altered", label: "Digitally Altered", text: "Digitally Altered" },
  { id: "staged", label: "Virtually Staged", text: "Virtually Staged" },
  { id: "concept", label: "AI-Generated Concept", text: "AI-Generated Concept" },
  { id: "proposed", label: "Proposed Design", text: "Proposed Design — Not Current Condition" },
  {
    id: "renovation",
    label: "Renovation Visualization",
    text: "Renovation Visualization — Not Current Condition",
  },
  {
    id: "boundary",
    label: "Property Boundary Approximation",
    text: "Property Boundary Approximation",
  },
  { id: "custom", label: "Custom Disclosure", text: "" },
];

export const CUSTOM_DISCLOSURE_LIMIT = 120;

export function disclosureOption(id: DisclosureId): DisclosureOption {
  return DISCLOSURE_OPTIONS.find((d) => d.id === id) || (DISCLOSURE_OPTIONS[0] as DisclosureOption);
}

/** Trim custom wording to a sensible single-line caption. */
export function clampCustomDisclosure(text: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CUSTOM_DISCLOSURE_LIMIT);
}

/** Never claim compliance — listing services differ. */
export const COMPLIANCE_NOTE =
  "Disclosure requirements vary by listing service and jurisdiction. Confirm the applicable rules before publishing.";

const CLASS_DISCLOSURE: Record<Classification, DisclosureId> = {
  Original: "none",
  Enhanced: "enhanced",
  "Digitally Altered": "altered",
  "Virtually Staged": "staged",
  "Proposed Design": "proposed",
  "AI-Generated Concept": "concept",
  "Renovation Visualization": "renovation",
  "Property Markup": "boundary",
  Custom: "custom",
};

export type ExportPurpose = "listing" | "marketing" | "social" | "internal" | "presentation";

export type MlsRuleset = {
  id: string;
  label: string;
  /** Force a disclosure on every altered image, including mild enhancement. */
  requireOnEnhanced?: boolean;
  /** Wording this ruleset prefers, keyed by classification. */
  wording?: Partial<Record<Classification, string>>;
};

export type Recommendation = {
  id: DisclosureId;
  text: string;
  /** Why this was chosen, shown under the picker. */
  reason: string;
  note: string;
  required: boolean;
};

export function recommendDisclosure(input: {
  classification: Classification;
  purpose?: ExportPurpose;
  /** Workspace default disclosure id, used only when nothing stronger applies. */
  workspaceDefault?: DisclosureId | null;
  customText?: string | null;
  mls?: MlsRuleset | null;
}): Recommendation {
  const c = input.classification;
  const purpose = input.purpose || "listing";
  let id = CLASS_DISCLOSURE[c];
  let reason = `Derived From The Version Classification: ${c}.`;

  if (id === "none" && input.workspaceDefault && input.workspaceDefault !== "none") {
    id = input.workspaceDefault;
    reason = "Workspace Default Disclosure.";
  }
  if (c === "Enhanced" && purpose === "internal" && !input.mls?.requireOnEnhanced) {
    id = "none";
    reason = "Internal Export Of A Lightly Enhanced Photo.";
  }
  if (input.mls?.requireOnEnhanced && c === "Enhanced") {
    id = "enhanced";
    reason = `${input.mls.label} Requires A Disclosure On Enhanced Photos.`;
  }

  const custom = clampCustomDisclosure(input.customText || "");
  const mlsWording = input.mls?.wording?.[c];
  const text =
    id === "custom"
      ? custom
      : id === "none"
        ? ""
        : mlsWording || custom || disclosureOption(id).text;

  return {
    id,
    text,
    reason,
    note: COMPLIANCE_NOTE,
    required: isMaterialAlteration(c) || (id !== "none" && !!input.mls?.requireOnEnhanced),
  };
}

/** Warning shown when the user removes a disclosure from a material change. */
export function noDisclosureWarning(c: Classification, id: DisclosureId): string | null {
  if (id !== "none") return null;
  if (!isMaterialAlteration(c)) return null;
  return `This Version Is Classified As ${c}. Publishing It Without A Disclosure May Breach Listing Rules.`;
}

/* -------------------------------------------------------- visual settings */

export type DisclosurePosition =
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "top-left"
  | "top-center"
  | "top-right";

export const POSITIONS: { id: DisclosurePosition; label: string }[] = [
  { id: "bottom-left", label: "Bottom Left" },
  { id: "bottom-center", label: "Bottom Center" },
  { id: "bottom-right", label: "Bottom Right" },
  { id: "top-left", label: "Top Left" },
  { id: "top-center", label: "Top Center" },
  { id: "top-right", label: "Top Right" },
];

export type DisclosureStyle = "text" | "solid" | "translucent" | "logo" | "mark";

export const STYLES: { id: DisclosureStyle; label: string }[] = [
  { id: "text", label: "Text Only" },
  { id: "solid", label: "Text With Solid Background" },
  { id: "translucent", label: "Text With Translucent Background" },
  { id: "logo", label: "Company Logo And Text" },
  { id: "mark", label: "REAL DESIGNS Disclosure Mark" },
];

export type DisclosureSettings = {
  id: DisclosureId;
  customText: string;
  position: DisclosurePosition;
  style: DisclosureStyle;
  /** Cap height as a share of the image's long edge. */
  fontScale: number;
  textColor: string;
  bgColor: string;
  bgOpacity: number;
  /** Padding inside the badge, as a share of the font size. */
  padding: number;
  /** Distance from the image edge, as a share of the long edge. */
  margin: number;
  /** Logo height as a share of the font size. */
  logoScale: number;
  logoPosition: "left" | "right";
  radius: number;
  autoContrast: boolean;
  /** Company logo data URL / https URL. Empty means "no logo". */
  logoUrl: string;
  companyName: string;
};

export const DEFAULT_DISCLOSURE_SETTINGS: DisclosureSettings = {
  id: "altered",
  customText: "",
  position: "bottom-left",
  style: "translucent",
  fontScale: 0.026,
  textColor: "#FFFFFF",
  bgColor: "#000000",
  bgOpacity: 0.62,
  padding: 0.55,
  margin: 0.02,
  logoScale: 1.6,
  logoPosition: "left",
  radius: 0.35,
  autoContrast: true,
  logoUrl: "",
  companyName: "",
};

export type BrandKit = {
  company?: string;
  logoUrl?: string;
  color?: string;
  position?: DisclosurePosition;
  style?: DisclosureStyle;
  disclosureId?: DisclosureId;
  customText?: string;
};

/**
 * Fold the workspace Brand Kit into export settings. A missing logo never
 * leaves a placeholder in an export: the style falls back to a text badge.
 */
export function applyBrandKit(
  settings: DisclosureSettings,
  brand: BrandKit | null | undefined,
): DisclosureSettings {
  const out: DisclosureSettings = { ...settings };
  if (!brand) return normalizeSettings(out);
  if (brand.company) out.companyName = brand.company;
  if (brand.logoUrl) out.logoUrl = brand.logoUrl;
  if (brand.color) out.bgColor = brand.color;
  if (brand.position) out.position = brand.position;
  if (brand.style) out.style = brand.style;
  if (brand.disclosureId) out.id = brand.disclosureId;
  if (brand.customText) out.customText = clampCustomDisclosure(brand.customText);
  return normalizeSettings(out);
}

/** Guard the numbers and drop styles that need assets we do not have. */
export function normalizeSettings(s: DisclosureSettings): DisclosureSettings {
  const clamp = (v: number, lo: number, hi: number, dflt: number) =>
    Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
  const out: DisclosureSettings = {
    ...s,
    customText: clampCustomDisclosure(s.customText || ""),
    fontScale: clamp(s.fontScale, 0.012, 0.08, DEFAULT_DISCLOSURE_SETTINGS.fontScale),
    bgOpacity: clamp(s.bgOpacity, 0, 1, DEFAULT_DISCLOSURE_SETTINGS.bgOpacity),
    padding: clamp(s.padding, 0, 2, DEFAULT_DISCLOSURE_SETTINGS.padding),
    margin: clamp(s.margin, 0, 0.15, DEFAULT_DISCLOSURE_SETTINGS.margin),
    logoScale: clamp(s.logoScale, 0.5, 4, DEFAULT_DISCLOSURE_SETTINGS.logoScale),
    radius: clamp(s.radius, 0, 2, DEFAULT_DISCLOSURE_SETTINGS.radius),
  };
  if (out.style === "logo" && !out.logoUrl) out.style = "translucent";
  if (out.style === "text") out.bgOpacity = 0;
  if (out.style === "solid") out.bgOpacity = 1;
  return out;
}

/** The caption an export will actually carry, or null when nothing is drawn. */
export function captionFor(s: DisclosureSettings): string | null {
  if (s.id === "none") return null;
  const text = s.id === "custom" ? clampCustomDisclosure(s.customText) : disclosureOption(s.id).text;
  const body = text || (s.id === "custom" ? "" : disclosureOption(s.id).label);
  if (!body) return null;
  if (s.style === "mark") return `${body} · REAL DESIGNS`;
  if (s.style === "logo" && s.companyName) return `${body} · ${s.companyName}`;
  return body;
}

/* -------------------------------------------------------------- geometry */

export type OverlayBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  radius: number;
  /** Baseline-centred text anchor. */
  textX: number;
  textY: number;
  logo: { x: number; y: number; size: number } | null;
};

/**
 * Where the badge sits on an image of a given pixel size. Identical maths runs
 * for the preview and the export, so what you see is what is baked.
 */
export function overlayLayout(input: {
  imageW: number;
  imageH: number;
  textWidthRatio: number;
  settings: DisclosureSettings;
}): OverlayBox {
  const { imageW: W, imageH: H, settings: s } = input;
  const long = Math.max(W, H) || 1;
  const fontSize = Math.max(11, Math.round(long * s.fontScale));
  const pad = Math.round(fontSize * s.padding);
  const margin = Math.round(long * s.margin);
  const hasLogo = s.style === "logo" && !!s.logoUrl;
  const logoSize = hasLogo ? Math.round(fontSize * s.logoScale) : 0;
  const gap = hasLogo ? Math.round(fontSize * 0.5) : 0;
  const textW = Math.max(1, Math.round(fontSize * input.textWidthRatio));
  const w = Math.min(W - margin * 2, textW + pad * 2 + logoSize + gap);
  const h = Math.max(fontSize + pad * 2, logoSize + pad * 2);

  const left = margin;
  const center = Math.round((W - w) / 2);
  const right = W - w - margin;
  const top = margin;
  const bottom = H - h - margin;
  const x = s.position.endsWith("left") ? left : s.position.endsWith("right") ? right : center;
  const y = s.position.startsWith("top") ? top : bottom;

  const logoLeft = hasLogo && s.logoPosition === "left";
  const logo = hasLogo
    ? {
        x: logoLeft ? x + pad : x + w - pad - logoSize,
        y: y + Math.round((h - logoSize) / 2),
        size: logoSize,
      }
    : null;
  const textX = logoLeft ? x + pad + logoSize + gap : x + pad;

  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
    fontSize,
    radius: Math.round(fontSize * s.radius),
    textX: Math.round(textX),
    textY: Math.round(y + h / 2),
    logo,
  };
}

/**
 * Contrast protection: pick legible colours for the patch of image the badge
 * covers. `luma` is 0..1 average brightness behind the badge.
 */
export function contrastColors(
  s: DisclosureSettings,
  luma: number,
): { textColor: string; bgColor: string; bgOpacity: number } {
  if (!s.autoContrast) return { textColor: s.textColor, bgColor: s.bgColor, bgOpacity: s.bgOpacity };
  const bright = luma > 0.55;
  if (s.style === "text") {
    /* No plate, so the text itself must flip and gets a shadow at render time. */
    return {
      textColor: bright ? "#111111" : "#FFFFFF",
      bgColor: s.bgColor,
      bgOpacity: 0,
    };
  }
  const minOpacity = s.style === "solid" ? 1 : 0.55;
  return {
    textColor: "#FFFFFF",
    bgColor: bright ? "#000000" : s.bgColor,
    bgOpacity: Math.max(minOpacity, s.bgOpacity),
  };
}

/* ------------------------------------------------------------- batch plan */

export type ExportItem = {
  id: string;
  name: string;
  src: string;
  operations?: string[];
  hasAdjustments?: boolean;
  classificationOverride?: Classification | null;
  versionId?: string | null;
  assetId?: string | null;
};

export type PlannedExport = {
  item: ExportItem;
  classification: Classification;
  settings: DisclosureSettings;
  caption: string | null;
  /** Something the user should look at before publishing. */
  exception: string | null;
};

/**
 * Classify every photo independently, so an untouched original never inherits
 * "Virtually Staged" from the staged version sitting next to it.
 */
export function planBatchExport(input: {
  items: ExportItem[];
  base: DisclosureSettings;
  purpose?: ExportPurpose;
  workspaceDefault?: DisclosureId | null;
  mls?: MlsRuleset | null;
  /** User forced one disclosure across the batch. */
  forceId?: DisclosureId | null;
}): PlannedExport[] {
  return (input.items || []).map((item) => {
    const classification = classifyVersion({
      operations: item.operations || [],
      hasAdjustments: !!item.hasAdjustments,
      override: item.classificationOverride ?? null,
    });
    const rec = recommendDisclosure({
      classification,
      ...(input.purpose ? { purpose: input.purpose } : {}),
      workspaceDefault: input.workspaceDefault ?? null,
      customText: input.base.customText,
      mls: input.mls ?? null,
    });
    const id = input.forceId ?? rec.id;
    const settings = normalizeSettings({ ...input.base, id });
    const caption = captionFor(settings);
    let exception: string | null = noDisclosureWarning(classification, id);
    if (!exception && input.forceId && input.forceId !== rec.id) {
      exception =
        classification === "Original"
          ? `${item.name} Is An Original Photograph And Would Receive A “${disclosureOption(id).label}” Disclosure.`
          : `${item.name} Is Classified As ${classification} But Would Receive “${disclosureOption(id).label}”.`;
    }
    return { item, classification, settings, caption, exception };
  });
}

/* ----------------------------------------------------------------- video */

export type VideoPlacement = "persistent" | "bookend";

export const MIN_VIDEO_DISCLOSURE_SECONDS = 3;

export type VideoDisclosureSegment = { start: number; end: number };

/** When the caption is on screen for a clip of `duration` seconds. */
export function videoDisclosurePlan(input: {
  duration: number;
  placement: VideoPlacement;
  holdSeconds?: number;
}): VideoDisclosureSegment[] {
  const duration = Math.max(0.1, input.duration || 0);
  if (input.placement === "persistent") return [{ start: 0, end: duration }];
  const hold = Math.min(
    duration,
    Math.max(MIN_VIDEO_DISCLOSURE_SECONDS, input.holdSeconds || MIN_VIDEO_DISCLOSURE_SECONDS),
  );
  if (hold * 2 >= duration) return [{ start: 0, end: duration }];
  return [
    { start: 0, end: hold },
    { start: duration - hold, end: duration },
  ];
}

/* -------------------------------------------------------------- metadata */

export type ExportAudit = {
  classification: Classification;
  disclosure_id: DisclosureId;
  disclosure_text: string | null;
  exported_at: string;
  exported_by: string | null;
  export_preset: string;
  asset_id: string | null;
  version_id: string | null;
  scope: ExportScope;
  compliance_note: string;
};

export type ExportScope =
  | "current-photo"
  | "selected-photos"
  | "room"
  | "property"
  | "selected-versions";

export const EXPORT_SCOPES: { id: ExportScope; label: string }[] = [
  { id: "current-photo", label: "Current Photo" },
  { id: "selected-photos", label: "Selected Photos" },
  { id: "room", label: "Entire Room" },
  { id: "property", label: "Entire Property" },
  { id: "selected-versions", label: "Selected Versions Only" },
];

/** Audit row for one exported file. Generation prompts are never included. */
export function buildExportAudit(input: {
  classification: Classification;
  settings: DisclosureSettings;
  preset: string;
  scope: ExportScope;
  userId?: string | null;
  assetId?: string | null;
  versionId?: string | null;
  at?: Date;
}): ExportAudit {
  return {
    classification: input.classification,
    disclosure_id: input.settings.id,
    disclosure_text: captionFor(input.settings),
    exported_at: (input.at || new Date()).toISOString(),
    exported_by: input.userId ?? null,
    export_preset: input.preset,
    asset_id: input.assetId ?? null,
    version_id: input.versionId ?? null,
    scope: input.scope,
    compliance_note: COMPLIANCE_NOTE,
  };
}

const PROMPT_KEYS = /^(prompt|negative_prompt|system_prompt|brief|instructions|model_prompt)$/i;

/** Strip anything that would leak how an image was generated. */
export function publicExportMetadata(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record || {})) {
    if (PROMPT_KEYS.test(k)) continue;
    out[k] = v;
  }
  return out;
}

/** Re-applying a disclosure is a local pixel operation: it is always free. */
export function disclosureCreditCost(): number {
  return 0;
}
