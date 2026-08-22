/**
 * REAL DESIGNS — Markup measurement and scale calibration.
 *
 * A photograph carries no scale. Until the user tells us what a known distance
 * in the frame really is, this module returns nothing: there is no guessed
 * "probably about 40 feet", and no measurement is ever produced from pixels
 * alone. Once calibrated, every value it returns is labelled Approximate,
 * because a photograph is not a survey instrument.
 *
 * Coordinates arrive normalized (0..1) exactly as the markup model stores them,
 * and are converted through the source pixel dimensions so the same calibration
 * holds at any preview or export size.
 */

import type { Point } from "@/lib/markup";

export type MeasureUnit = "ft" | "m";

export type ScaleSource = "manual" | "metadata" | "provider";

/** Where the photograph was taken from. Ground shots distort area badly. */
export type ImagePerspective = "aerial" | "elevated" | "ground" | "unknown";

export type ScaleCalibration = {
  /** Real-world units represented by one source pixel. */
  unitsPerPixel: number;
  unit: MeasureUnit;
  /** The reference line the user drew, kept so calibration stays editable. */
  reference: { a: Point; b: Point } | null;
  /** The real-world length the user entered for that line. */
  referenceLength: number;
  imageWidth: number;
  imageHeight: number;
  source: ScaleSource;
  /** Free text: "Provider tile bounds", "EXIF GPS altitude", the user's note. */
  note?: string | null;
  perspective: ImagePerspective;
  createdAt: number;
};

export const UNIT_LABEL: Record<MeasureUnit, string> = { ft: "ft", m: "m" };
export const AREA_UNIT_LABEL: Record<MeasureUnit, string> = { ft: "sq ft", m: "sq m" };

/** Every calculated value carries this word. It is not optional copy. */
export const APPROXIMATE = "Approximate";

export const NO_SCALE_MESSAGE =
  "Calibrate Scale Before Measuring. Draw A Line Over A Known Dimension And Enter Its Real Length.";

export const PERSPECTIVE_WARNING =
  "This Photograph Is Taken From Ground Level. Perspective Distorts Distances Away From The Camera, So Area And Perimeter Values Here Are Rough Estimates Only.";

/* --------------------------------------------------------------- geometry */

export function pixelDistance(a: Point, b: Point, w: number, h: number): number {
  const dx = (b.x - a.x) * w;
  const dy = (b.y - a.y) * h;
  return Math.hypot(dx, dy);
}

/** Shoelace area of a normalized polygon, in source pixels squared. */
export function pixelArea(points: Point[], w: number, h: number): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i] as Point;
    const q = points[(i + 1) % points.length] as Point;
    sum += p.x * w * (q.y * h) - q.x * w * (p.y * h);
  }
  return Math.abs(sum) / 2;
}

export function pixelPerimeter(points: Point[], w: number, h: number, closed: boolean): number {
  if (points.length < 2) return 0;
  let total = 0;
  const last = closed ? points.length : points.length - 1;
  for (let i = 0; i < last; i++) {
    total += pixelDistance(points[i] as Point, points[(i + 1) % points.length] as Point, w, h);
  }
  return total;
}

/* ------------------------------------------------------------ calibration */

export type CalibrationInput = {
  a: Point;
  b: Point;
  realLength: number;
  unit: MeasureUnit;
  imageWidth: number;
  imageHeight: number;
  source?: ScaleSource;
  note?: string | null;
  perspective?: ImagePerspective;
};

export type CalibrationResult =
  | { ok: true; calibration: ScaleCalibration }
  | { ok: false; error: string };

/**
 * Turn a drawn reference line plus a real measurement into a scale.
 * A very short reference line is refused: a 12px line carrying "80 feet" makes
 * every later number meaningless, and silently accepting it would be worse
 * than asking again.
 */
export function calibrateScale(input: CalibrationInput): CalibrationResult {
  const { a, b, realLength, unit, imageWidth, imageHeight } = input;
  if (!(imageWidth > 0 && imageHeight > 0)) {
    return { ok: false, error: "The Source Image Size Is Unknown." };
  }
  if (!Number.isFinite(realLength) || realLength <= 0) {
    return { ok: false, error: "Enter The Real Length Of The Reference Line." };
  }
  const px = pixelDistance(a, b, imageWidth, imageHeight);
  const minPx = Math.max(24, Math.min(imageWidth, imageHeight) * 0.05);
  if (px < minPx) {
    return {
      ok: false,
      error: "Draw The Reference Line Over A Longer Known Dimension For A Reliable Scale.",
    };
  }
  return {
    ok: true,
    calibration: {
      unitsPerPixel: realLength / px,
      unit,
      reference: { a: { ...a }, b: { ...b } },
      referenceLength: realLength,
      imageWidth,
      imageHeight,
      source: input.source || "manual",
      note: input.note ?? null,
      perspective: input.perspective || "unknown",
      createdAt: Date.now(),
    },
  };
}

/**
 * Adopt scale metadata supplied by a provider or by georeferencing, such as
 * aerial tile bounds. It is only accepted when the metadata actually states a
 * ground resolution — nothing here is inferred from the picture.
 */
export function calibrationFromMetadata(meta: {
  metersPerPixel?: number | null;
  imageWidth: number;
  imageHeight: number;
  unit?: MeasureUnit;
  source?: ScaleSource;
  note?: string | null;
  perspective?: ImagePerspective;
}): CalibrationResult {
  const mpp = Number(meta.metersPerPixel);
  if (!Number.isFinite(mpp) || mpp <= 0) {
    return { ok: false, error: "This Image Carries No Reliable Scale Metadata." };
  }
  const unit = meta.unit || "ft";
  const unitsPerPixel = unit === "m" ? mpp : mpp * 3.280839895;
  return {
    ok: true,
    calibration: {
      unitsPerPixel,
      unit,
      reference: null,
      referenceLength: 0,
      imageWidth: meta.imageWidth,
      imageHeight: meta.imageHeight,
      source: meta.source || "metadata",
      note: meta.note ?? "Scale Read From Image Metadata",
      perspective: meta.perspective || "aerial",
      createdAt: Date.now(),
    },
  };
}

export function isCalibrated(cal: ScaleCalibration | null | undefined): cal is ScaleCalibration {
  return !!cal && Number.isFinite(cal.unitsPerPixel) && cal.unitsPerPixel > 0;
}

/* ------------------------------------------------------------ measurement */

export type Measurement = {
  kind: "distance" | "area" | "perimeter";
  value: number;
  unit: string;
  /** Always carries the word Approximate. */
  text: string;
  approximate: true;
  /** Present when the photograph cannot support a trustworthy value. */
  warning: string | null;
};

function round(v: number): number {
  if (v >= 1000) return Math.round(v);
  if (v >= 100) return Math.round(v * 10) / 10;
  return Math.round(v * 100) / 100;
}

function withApprox(value: number, unit: string): string {
  return `≈ ${round(value).toLocaleString()} ${unit} (${APPROXIMATE})`;
}

function perspectiveNote(cal: ScaleCalibration, kind: Measurement["kind"]): string | null {
  if (cal.perspective !== "ground") return null;
  return kind === "distance" ? PERSPECTIVE_WARNING : PERSPECTIVE_WARNING;
}

/** Linear distance along a drawn line. Null until the frame is calibrated. */
export function measureDistance(
  points: Point[],
  cal: ScaleCalibration | null | undefined,
): Measurement | null {
  if (!isCalibrated(cal) || points.length < 2) return null;
  const px = pixelPerimeter(points, cal.imageWidth, cal.imageHeight, false);
  const value = px * cal.unitsPerPixel;
  return {
    kind: "distance",
    value,
    unit: UNIT_LABEL[cal.unit],
    text: withApprox(value, UNIT_LABEL[cal.unit]),
    approximate: true,
    warning: perspectiveNote(cal, "distance"),
  };
}

/** Approximate area of a closed shape. Never offered without calibration. */
export function measureArea(
  points: Point[],
  cal: ScaleCalibration | null | undefined,
): Measurement | null {
  if (!isCalibrated(cal) || points.length < 3) return null;
  const px2 = pixelArea(points, cal.imageWidth, cal.imageHeight);
  const value = px2 * cal.unitsPerPixel * cal.unitsPerPixel;
  return {
    kind: "area",
    value,
    unit: AREA_UNIT_LABEL[cal.unit],
    text: withApprox(value, AREA_UNIT_LABEL[cal.unit]),
    approximate: true,
    warning: perspectiveNote(cal, "area"),
  };
}

export function measurePerimeter(
  points: Point[],
  cal: ScaleCalibration | null | undefined,
): Measurement | null {
  if (!isCalibrated(cal) || points.length < 3) return null;
  const px = pixelPerimeter(points, cal.imageWidth, cal.imageHeight, true);
  const value = px * cal.unitsPerPixel;
  return {
    kind: "perimeter",
    value,
    unit: UNIT_LABEL[cal.unit],
    text: withApprox(value, UNIT_LABEL[cal.unit]),
    approximate: true,
    warning: perspectiveNote(cal, "perimeter"),
  };
}

/** What the panel shows for one shape: everything measurable about it. */
export function measureShape(
  points: Point[],
  closed: boolean,
  cal: ScaleCalibration | null | undefined,
): { measurements: Measurement[]; message: string | null } {
  if (!isCalibrated(cal)) return { measurements: [], message: NO_SCALE_MESSAGE };
  const out: Measurement[] = [];
  if (closed && points.length >= 3) {
    const area = measureArea(points, cal);
    const per = measurePerimeter(points, cal);
    if (area) out.push(area);
    if (per) out.push(per);
  } else {
    const d = measureDistance(points, cal);
    if (d) out.push(d);
  }
  return { measurements: out, message: out.length ? null : NO_SCALE_MESSAGE };
}

/** Metadata written next to an export, so a value never travels bare. */
export function scaleMetadata(cal: ScaleCalibration | null | undefined) {
  if (!isCalibrated(cal)) return { calibrated: false as const, measurements_allowed: false as const };
  return {
    calibrated: true as const,
    measurements_allowed: true as const,
    units: cal.unit,
    units_per_pixel: cal.unitsPerPixel,
    scale_source: cal.source,
    reference_length: cal.referenceLength || null,
    perspective: cal.perspective,
    qualifier: APPROXIMATE,
    perspective_warning: cal.perspective === "ground" ? PERSPECTIVE_WARNING : null,
  };
}
