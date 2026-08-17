/**
 * Room classification for the property-video builder.
 *
 * The old missing-photo warning read the room *label* on each grid asset.
 * Freshly uploaded files carry no label, so a set that plainly contained a
 * front exterior and a living room still reported both as missing. Nothing
 * here guesses from a label alone: a category counts as present only when a
 * confident classification (or a manual correction) says so, and the warning
 * stays hidden until the analysis has actually finished.
 */

export const PHOTO_CATEGORIES = [
  "Front Exterior",
  "Rear Exterior",
  "Living Room",
  "Kitchen",
  "Dining Room",
  "Bedroom",
  "Bathroom",
  "Office",
  "Garage",
  "Pool",
  "Yard",
  "Entry",
  "Other Interior",
  "Other Exterior",
  "Uncertain",
] as const;

export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

/** Anything not confidently classified keeps this label in the grid. */
export const UNSORTED_LABEL = "Unsorted";
export const REVIEW_LABEL = "Needs Review";

/** Confidence bands. Below REVIEW the photo stays Unsorted. */
export const ACCEPT_CONFIDENCE = 0.7;
export const REVIEW_CONFIDENCE = 0.45;

export type AnalysisStatus = "pending" | "running" | "completed" | "partial" | "failed";

/* Synonyms are normalized before any presence check, so "Facade", "Curb View"
   and "Front Elevation" all satisfy the front-exterior recommendation. */
const SYNONYMS: [RegExp, PhotoCategory][] = [
  [/^(front|exterior front|front exterior|front elevation|facade|fa[cç]ade|front view|curb (view|appeal)|street view|house exterior|exterior)$/i, "Front Exterior"],
  [/^(rear exterior|exterior rear|back exterior|rear view|back of house|rear elevation)$/i, "Rear Exterior"],
  [/^(living room|livingroom|family room|great room|lounge|main living area|open living area|living area|living|den)$/i, "Living Room"],
  [/^(kitchen|kitchenette|pantry|breakfast nook)$/i, "Kitchen"],
  [/^(dining room|dining area|dining|formal dining)$/i, "Dining Room"],
  [/^(bedroom|primary bedroom|master bedroom|guest bedroom|bed room|bedrooms)$/i, "Bedroom"],
  [/^(bathroom|primary bathroom|master bathroom|powder room|ensuite|half bath|bath)$/i, "Bathroom"],
  [/^(office|study|home office|library)$/i, "Office"],
  [/^(garage|carport)$/i, "Garage"],
  [/^(pool|spa|hot tub|pool area)$/i, "Pool"],
  [/^(yard|backyard|back yard|front yard|garden|lawn|landscaping)$/i, "Yard"],
  [/^(entry|entryway|foyer|hallway|hall|mudroom|staircase|stairs)$/i, "Entry"],
  [/^(other interior|interior|laundry|basement|closet|utility|bonus room|gym)$/i, "Other Interior"],
  [/^(other exterior|patio|deck|porch|lanai|balcony|aerial|drone|side exterior|community|view)$/i, "Other Exterior"],
];

/** Map any label — AI, filename hint or hand typed — onto a known category. */
export function normalizeCategory(label: unknown): PhotoCategory | null {
  const raw = String(label ?? "").trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!raw) return null;
  if (/^(unsorted|uncertain|unknown|needs review|other|untitled)$/i.test(raw)) return null;
  const exact = PHOTO_CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase());
  if (exact) return exact === "Uncertain" ? null : exact;
  for (const [re, cat] of SYNONYMS) if (re.test(raw)) return cat;
  /* Loose containment last, so "Sunny Living Room 2" still resolves. */
  const loose = raw.toLowerCase();
  if (/\b(front|facade|curb|street)\b/.test(loose) && /\b(exterior|elevation|view|house|home)\b/.test(loose)) return "Front Exterior";
  if (/\bliving|family room|great room|lounge\b/.test(loose)) return "Living Room";
  if (/\bkitchen\b/.test(loose)) return "Kitchen";
  if (/\bdining\b/.test(loose)) return "Dining Room";
  if (/\bbed\b|\bbedroom\b/.test(loose)) return "Bedroom";
  if (/\bbath\b|\bbathroom\b/.test(loose)) return "Bathroom";
  return null;
}

export type ClassifiedPhoto = {
  /** Grid key. */
  id: string;
  /** Label shown in the grid. */
  label: string;
  category: PhotoCategory | null;
  confidence: number;
  /** manual always wins over ai, ai over an untouched upload. */
  source: "manual" | "ai" | "none";
  state: "confirmed" | "review" | "unsorted";
};

/** Decide the label and the trust band for one photo. */
export function resolvePhoto(input: {
  id: string;
  manual?: string | null;
  label?: string | null;
  confidence?: number | null;
  source?: "manual" | "ai" | "none";
}): ClassifiedPhoto {
  const manual = normalizeCategory(input.manual) ?? (String(input.manual || "").trim() || null);
  if (manual) {
    const cat = normalizeCategory(manual);
    return { id: input.id, label: String(manual), category: cat, confidence: 1, source: "manual", state: cat ? "confirmed" : "unsorted" };
  }
  const conf = Number(input.confidence ?? 0);
  const cat = normalizeCategory(input.label);
  if (cat && conf >= ACCEPT_CONFIDENCE) {
    return { id: input.id, label: cat, category: cat, confidence: conf, source: "ai", state: "confirmed" };
  }
  if (cat && conf >= REVIEW_CONFIDENCE) {
    return { id: input.id, label: cat, category: cat, confidence: conf, source: "ai", state: "review" };
  }
  return { id: input.id, label: UNSORTED_LABEL, category: null, confidence: conf, source: input.source || "none", state: "unsorted" };
}

/** Categories we recommend every listing tour contains. */
export const RECOMMENDED_CATEGORIES: PhotoCategory[] = ["Front Exterior", "Living Room"];

export type NoticeResult = {
  show: boolean;
  missing: PhotoCategory[];
  message: string;
  reason: "ok" | "analyzing" | "unresolved" | "unreliable" | "complete";
};

/**
 * Missing-photo recommendation.
 *
 * Silent while analysis is pending, running or failed, and silent whenever an
 * unresolved photo could still turn out to be the category in question — a low
 * confidence result is never treated as proof of absence.
 */
export function missingRecommendation(
  photos: ClassifiedPhoto[],
  status: AnalysisStatus,
): NoticeResult {
  const none = (reason: NoticeResult["reason"]): NoticeResult => ({ show: false, missing: [], message: "", reason });
  if (!photos.length) return none("ok");
  if (status === "pending" || status === "running") return none("analyzing");
  if (status === "failed") return none("unreliable");

  const present = new Set(photos.filter((p) => p.state === "confirmed" && p.category).map((p) => p.category as PhotoCategory));
  const missing = RECOMMENDED_CATEGORIES.filter((c) => !present.has(c));
  if (!missing.length) return none("complete");

  /* Anything still unsorted or awaiting review could be the missing space. */
  const unresolved = photos.some((p) => p.state !== "confirmed");
  if (unresolved) return none("unresolved");

  return { show: true, missing, message: recommendationCopy(missing), reason: "ok" };
}

export function recommendationCopy(missing: PhotoCategory[]): string {
  const words = missing.map((m) => (m === "Front Exterior" ? "front exterior" : m.toLowerCase().replace("living room", "living-room")));
  if (!words.length) return "";
  if (words.length === 1) return `Consider adding a ${words[0]} photo for a more complete tour.`;
  return `Consider adding ${words.slice(0, -1).join(", ")} and ${words[words.length - 1]} photos for a more complete tour.`;
}

/** A fingerprint of the photo set + labels; a dismissal only holds while it matches. */
export function noticeSignature(photos: ClassifiedPhoto[]): string {
  return photos
    .map((p) => `${p.id}:${p.category || "?"}:${p.state}`)
    .sort()
    .join("|");
}

/* ---------------- Auto Arrange ---------------- */

export const ARRANGE_ORDER: PhotoCategory[] = [
  "Front Exterior",
  "Entry",
  "Living Room",
  "Kitchen",
  "Dining Room",
  "Bedroom",
  "Bathroom",
  "Other Interior",
  "Office",
  "Garage",
  "Pool",
  "Yard",
  "Other Exterior",
  "Rear Exterior",
];

/** Sort rank for a room label; anything unknown sorts after the known rooms. */
export function arrangeRank(label: unknown): number {
  const cat = normalizeCategory(label);
  const i = cat ? ARRANGE_ORDER.indexOf(cat) : -1;
  return i < 0 ? ARRANGE_ORDER.length + 1 : i;
}

/* ---------------- Browser helper ---------------- */

/** Small JPEG data URL of a file, cheap enough to send several per request. */
export async function thumbDataUrl(file: File, max = 512): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img: HTMLImageElement = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("unreadable"));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round((img.naturalWidth || max) * scale));
    c.height = Math.max(1, Math.round((img.naturalHeight || max) * scale));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}
