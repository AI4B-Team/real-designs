/**
 * Client-side property intelligence.
 *
 * Everything here is measured from the decoded pixels of the upload — no
 * fabricated scores. Where a signal is weak the result is deliberately
 * low-confidence and the photo lands in "Needs Review" rather than being
 * assigned a room we are not sure about.
 */

export const ROOM_GROUPS = [
  "Front Exterior",
  "Rear Exterior",
  "Side Exterior",
  "Aerial",
  "Entry",
  "Living Room",
  "Family Room",
  "Kitchen",
  "Dining Room",
  "Primary Bedroom",
  "Bedroom",
  "Primary Bathroom",
  "Bathroom",
  "Office",
  "Laundry",
  "Garage",
  "Basement",
  "Patio",
  "Pool",
  "Garden",
  "Community",
  "Other",
  "Needs Review",
] as const;

export type RoomGroup = (typeof ROOM_GROUPS)[number];

export const EXPECTED_SPACES: RoomGroup[] = [
  "Front Exterior",
  "Living Room",
  "Kitchen",
  "Primary Bedroom",
  "Primary Bathroom",
  "Rear Exterior",
];

export const FLAG_LABEL: Record<string, string> = {
  blurry: "Possible Blur",
  lowres: "Low Resolution",
  overexposed: "Overexposed",
  underexposed: "Underexposed",
  vertical: "Vertical Perspective",
  distortion: "Lens Distortion",
  warmcast: "Warm Color Cast",
  coolcast: "Cool Color Cast",
  reflection: "Possible Reflection",
  bracket: "HDR Bracket",
  duplicate: "Near Duplicate",
  privacy: "Privacy Review",
  windows: "Blown Windows",
};

const NAME_HINTS: [RegExp, RoomGroup][] = [
  [/\b(front|facade|street|curb)\b/i, "Front Exterior"],
  [/\b(rear|back ?yard|backyard)\b/i, "Rear Exterior"],
  [/\bside\b/i, "Side Exterior"],
  [/\b(aerial|drone|birds?[-_ ]?eye)\b/i, "Aerial"],
  [/\b(entry|foyer|hall)\b/i, "Entry"],
  [/\b(living|great ?room|lounge)\b/i, "Living Room"],
  [/\bfamily\b/i, "Family Room"],
  [/\b(kitchen|pantry)\b/i, "Kitchen"],
  [/\bdin(ing|e)\b/i, "Dining Room"],
  [/\b(primary|master)[-_ ]?(bed|br)\b/i, "Primary Bedroom"],
  [/\bbed(room)?\b/i, "Bedroom"],
  [/\b(primary|master)[-_ ]?bath\b/i, "Primary Bathroom"],
  [/\bbath|powder|ensuite\b/i, "Bathroom"],
  [/\b(office|study|den)\b/i, "Office"],
  [/\blaundry|utility\b/i, "Laundry"],
  [/\bgarage\b/i, "Garage"],
  [/\bbasement\b/i, "Basement"],
  [/\b(patio|deck|porch|lanai)\b/i, "Patio"],
  [/\bpool|spa\b/i, "Pool"],
  [/\b(yard|garden|landscap|lawn)\b/i, "Garden"],
  [/\b(community|amenity|clubhouse|gym)\b/i, "Community"],
];

export type Measured = {
  width: number;
  height: number;
  brightness: number;
  contrast: number;
  blur: number;
  warmth: number;
  skyTop: number;
  greenBottom: number;
  clipped: number;
  hash: string;
  thumb: string;
};

/** Decode the file once and take every measurement from the same bitmap. */
export async function measureImage(file: File): Promise<Measured> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const W = 96;
    const H = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * W)) || 96;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;

    let sum = 0;
    let sumSq = 0;
    let r = 0;
    let b = 0;
    let clipped = 0;
    const lum: number[] = new Array(W * H);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const R = d[i]!;
      const G = d[i + 1]!;
      const B = d[i + 2]!;
      const l = 0.299 * R + 0.587 * G + 0.114 * B;
      lum[p] = l;
      sum += l;
      sumSq += l * l;
      r += R;
      b += B;
      if (l > 250 || l < 4) clipped++;
    }
    const n = W * H;
    const mean = sum / n;
    const variance = Math.max(0, sumSq / n - mean * mean);

    // Laplacian variance on the downsampled luma — a standard blur proxy.
    let lapSum = 0;
    let lapSq = 0;
    let count = 0;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const v = 4 * lum[i]! - lum[i - 1]! - lum[i + 1]! - lum[i - W]! - lum[i + W]!;
        lapSum += v;
        lapSq += v * v;
        count++;
      }
    }
    const lapMean = count ? lapSum / count : 0;
    const blur = count ? Math.max(0, lapSq / count - lapMean * lapMean) : 0;

    // Sky-ish top band and green-ish bottom band steer interior vs exterior.
    let skyTop = 0;
    let greenBottom = 0;
    const band = Math.max(1, Math.floor(H * 0.22));
    for (let y = 0; y < band; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (d[i + 2]! > d[i]! + 12 && d[i + 2]! > 110) skyTop++;
      }
    }
    for (let y = H - band; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (d[i + 1]! > d[i]! + 10 && d[i + 1]! > d[i + 2]! + 10) greenBottom++;
      }
    }

    // 8x8 average hash for duplicate and bracket grouping.
    const hc = document.createElement("canvas");
    hc.width = 8;
    hc.height = 8;
    const hctx = hc.getContext("2d", { willReadFrequently: true })!;
    hctx.drawImage(img, 0, 0, 8, 8);
    const hd = hctx.getImageData(0, 0, 8, 8).data;
    const hl: number[] = [];
    for (let i = 0; i < hd.length; i += 4)
      hl.push(0.299 * hd[i]! + 0.587 * hd[i + 1]! + 0.114 * hd[i + 2]!);
    const hmean = hl.reduce((a, v) => a + v, 0) / hl.length;
    const hash = hl.map((v) => (v > hmean ? "1" : "0")).join("");

    const tc = document.createElement("canvas");
    const tw = 320;
    tc.width = tw;
    tc.height = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * tw));
    tc.getContext("2d")!.drawImage(img, 0, 0, tc.width, tc.height);

    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      brightness: Math.round(mean),
      contrast: Math.round(Math.sqrt(variance)),
      blur: Math.round(blur),
      warmth: Math.round((r - b) / n),
      skyTop: skyTop / (band * W),
      greenBottom: greenBottom / (band * W),
      clipped: clipped / n,
      hash,
      thumb: tc.toDataURL("image/jpeg", 0.72),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("That image could not be read."));
    img.src = src;
  });
}

export function hamming(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

export type Classified = {
  room: RoomGroup;
  confidence: number;
  flags: string[];
  outdoor: boolean;
};

/** Filename hints first, then pixel evidence. Anything weak stays Needs Review. */
export function classify(filename: string, m: Measured): Classified {
  const flags: string[] = [];
  if (m.blur < 60) flags.push("blurry");
  if (Math.min(m.width, m.height) < 900) flags.push("lowres");
  if (m.brightness > 205 || m.clipped > 0.09) flags.push("overexposed");
  if (m.brightness < 58) flags.push("underexposed");
  if (m.warmth > 26) flags.push("warmcast");
  if (m.warmth < -22) flags.push("coolcast");

  const outdoor = m.skyTop > 0.28 || m.greenBottom > 0.3;
  if (!outdoor && m.clipped > 0.05 && m.brightness < 150) flags.push("windows");

  for (const [re, room] of NAME_HINTS) {
    if (re.test(filename)) {
      return { room, confidence: 0.9, flags, outdoor };
    }
  }

  if (m.skyTop > 0.45 && m.greenBottom > 0.25)
    return { room: "Front Exterior", confidence: 0.58, flags, outdoor: true };
  if (m.greenBottom > 0.45) return { room: "Garden", confidence: 0.52, flags, outdoor: true };
  if (outdoor) return { room: "Needs Review", confidence: 0.3, flags, outdoor: true };
  return { room: "Needs Review", confidence: 0.25, flags, outdoor: false };
}

export type GroupInput = {
  id: string;
  hash: string;
  brightness: number;
  room: string;
  outdoor: boolean;
};

/** Near-duplicate and exposure-bracket grouping from the perceptual hashes. */
export function groupSets(
  items: GroupInput[],
): Record<string, { dup?: string; hdr?: string; angle?: string }> {
  const out: Record<string, { dup?: string; hdr?: string; angle?: string }> = {};
  const seen: { key: string; item: GroupInput }[] = [];
  for (const it of items) {
    let match: { key: string; item: GroupInput } | undefined;
    for (const s of seen) {
      if (hamming(s.item.hash, it.hash) <= 8) {
        match = s;
        break;
      }
    }
    const key = match ? match.key : "g" + seen.length;
    if (!match) seen.push({ key, item: it });
    out[it.id] = {};
    const partner = match?.item;
    if (partner) {
      const dBright = Math.abs(partner.brightness - it.brightness);
      // Same framing, clearly different exposure → bracket, otherwise duplicate.
      if (dBright >= 22) out[it.id]!.hdr = key;
      else out[it.id]!.dup = key;
      out[partner.id] = out[partner.id] ?? {};
      if (dBright >= 22) out[partner.id]!.hdr = key;
      else out[partner.id]!.dup = key;
    }
    out[it.id]!.angle = key;
  }
  return out;
}

export type Asset = {
  id: string;
  room_group: string;
  room_confidence: number;
  flags: string[];
  hdr_group: string | null;
  dup_group: string | null;
  quality: Record<string, any>;
  hidden: boolean;
};

export type Recommendation = {
  key: string;
  label: string;
  family: "property" | "design";
  op: string | null;
  ids: string[];
  note: string;
};

/** Recommendations are derived from the flags actually measured on the set. */
export function recommendations(assets: Asset[]): Recommendation[] {
  const has = (a: Asset, f: string) => (a.flags || []).includes(f);
  const live = assets.filter((a) => !a.hidden);
  const rec: Recommendation[] = [];
  const push = (
    key: string,
    label: string,
    op: string | null,
    ids: string[],
    note: string,
    family: "property" | "design" = "property",
  ) => {
    if (ids.length) rec.push({ key, label, family, op, ids, note });
  };

  push(
    "enhance",
    "Auto Enhance",
    "auto_enhance",
    live
      .filter(
        (a) =>
          has(a, "underexposed") || has(a, "overexposed") || (a.quality?.["contrast"] ?? 60) < 34,
      )
      .map((a) => a.id),
    "Exposure and contrast look off in these photos.",
  );
  push(
    "windows",
    "Window Balance",
    "window_balance",
    live.filter((a) => has(a, "windows")).map((a) => a.id),
    "Interiors with blown-out window light.",
  );
  push(
    "hdr",
    "HDR Merge",
    "hdr_merge",
    live.filter((a) => a.hdr_group).map((a) => a.id),
    "Exposure brackets detected for the same framing.",
  );
  push(
    "wb",
    "White-Balance Correction",
    "white_balance",
    live.filter((a) => has(a, "warmcast") || has(a, "coolcast")).map((a) => a.id),
    "Color casts vary across the set.",
  );
  push(
    "sharpen",
    "Sharpening",
    "sharpen",
    live.filter((a) => has(a, "blurry")).map((a) => a.id),
    "Fine detail reads soft — review before applying.",
  );
  push(
    "dupes",
    "Duplicate Review",
    null,
    live.filter((a) => a.dup_group).map((a) => a.id),
    "Near-identical frames — keep the strongest of each group.",
  );
  push(
    "privacy",
    "Privacy Review",
    "privacy_blur",
    live.filter((a) => has(a, "privacy")).map((a) => a.id),
    "Check these frames for faces, plates or personal items.",
  );
  return rec;
}

/**
 * "Similar Photos" is deliberately narrow: same room, same indoor/outdoor
 * classification, and comparable exposure. It never means the whole property.
 */
export function similarTo(target: Asset, all: Asset[]): string[] {
  const b = Number(target.quality?.["brightness"] ?? 0);
  const w = Number(target.quality?.["warmth"] ?? 0);
  return all
    .filter(
      (a) =>
        !a.hidden &&
        a.room_group === target.room_group &&
        Boolean(a.quality?.["outdoor"]) === Boolean(target.quality?.["outdoor"]) &&
        Math.abs(Number(a.quality?.["brightness"] ?? 0) - b) <= 26 &&
        Math.abs(Number(a.quality?.["warmth"] ?? 0) - w) <= 20,
    )
    .map((a) => a.id);
}

export function missingSpaces(assets: Asset[]): string[] {
  const present = new Set(assets.filter((a) => !a.hidden).map((a) => a.room_group));
  return EXPECTED_SPACES.filter((s) => !present.has(s));
}

/** Best frame per angle group: sharpest, best exposed, highest resolution. */
export function pickRecommended(assets: (Asset & { quality: any })[]): Set<string> {
  const byGroup = new Map<string, (Asset & { quality: any })[]>();
  for (const a of assets) {
    if (a.hidden) continue;
    const k = (a.quality?.angle as string) || a.dup_group || a.hdr_group || a.id;
    byGroup.set(k, [...(byGroup.get(k) ?? []), a]);
  }
  const out = new Set<string>();
  for (const list of byGroup.values()) {
    const best = list.slice().sort((x, y) => score(y) - score(x))[0];
    if (best) out.add(best.id);
  }
  return out;
}

function score(a: Asset & { quality: any }): number {
  const q = a.quality || {};
  const exposure = 100 - Math.abs(128 - Number(q.brightness ?? 128));
  const sharp = Math.min(400, Number(q.blur ?? 0)) / 4;
  const res = Math.min(100, Number(q.width ?? 0) / 40);
  return exposure + sharp + res;
}
