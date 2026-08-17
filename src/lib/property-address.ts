/* Shared property-address model.
   One canonical structure is used by image-design drafts, property videos and
   the Media library. An address is always optional: nothing here ever blocks a
   draft from being saved, and no placeholder property is ever invented. */

export type AddressSource =
  | "manual"
  | "autocomplete"
  | "existing_property"
  | "listing_import"
  | "inherited"
  | "unknown";

export const ADDRESS_SOURCES: AddressSource[] = [
  "manual",
  "autocomplete",
  "existing_property",
  "listing_import",
  "inherited",
  "unknown",
];

export const MAX_ADDRESS_LEN = 200;

export type ProjectAddress = {
  property_address: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  normalized_address: string | null;
  address_source: AddressSource;
  address_verified_at: string | null;
};

export function emptyAddress(): ProjectAddress {
  return {
    property_address: null,
    address_line_1: null,
    address_line_2: null,
    city: null,
    state: null,
    postal_code: null,
    country: null,
    latitude: null,
    longitude: null,
    normalized_address: null,
    address_source: "unknown",
    address_verified_at: null,
  };
}

/** Strip markup and clamp length. Addresses are user text, never HTML. */
export function cleanAddressText(value: unknown, max = MAX_ADDRESS_LEN): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const STREET_WORDS: Record<string, string> = {
  street: "st", str: "st", st: "st",
  avenue: "ave", ave: "ave", av: "ave",
  road: "rd", rd: "rd",
  drive: "dr", dr: "dr",
  lane: "ln", ln: "ln",
  boulevard: "blvd", blvd: "blvd",
  court: "ct", ct: "ct",
  place: "pl", pl: "pl",
  terrace: "ter", ter: "ter",
  circle: "cir", cir: "cir",
  highway: "hwy", hwy: "hwy",
  parkway: "pkwy", pkwy: "pkwy",
  trail: "trl", trl: "trl",
  north: "n", south: "s", east: "e", west: "w",
  northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw",
  apartment: "apt", apt: "apt", unit: "unit", suite: "ste", ste: "ste",
};

/** Lower-cased, punctuation-free, abbreviation-folded key used only for
    duplicate matching. It is never shown to the user. */
export function normalizeAddress(value: unknown): string {
  const base = cleanAddressText(value, 400).toLowerCase();
  if (!base) return "";
  return base
    .replace(/[.,#]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => STREET_WORDS[w] ?? w)
    .join(" ")
    .trim();
}

/** Format the structured parts into the single line shown everywhere. */
export function formatAddress(parts: Partial<ProjectAddress>): string {
  const line1 = cleanAddressText(parts.address_line_1);
  const line2 = cleanAddressText(parts.address_line_2, 60);
  const city = cleanAddressText(parts.city, 80);
  const state = cleanAddressText(parts.state, 40);
  const zip = cleanAddressText(parts.postal_code, 20);
  const street = [line1, line2].filter(Boolean).join(" ");
  const region = [state, zip].filter(Boolean).join(" ");
  const out = [street, city, region].filter(Boolean).join(", ");
  return out.slice(0, MAX_ADDRESS_LEN);
}

/** Best-effort split of a typed line into structured parts. Anything we cannot
    confidently read stays in line 1 — we never fabricate a city or ZIP. */
export function parseAddress(raw: unknown): Partial<ProjectAddress> {
  const text = cleanAddressText(raw);
  if (!text) return {};
  const bits = text.split(",").map((b) => b.trim()).filter(Boolean);
  const out: Partial<ProjectAddress> = { address_line_1: bits[0] || text };
  if (bits.length >= 2) out.city = bits[1] ?? null;
  const tail = (bits.length >= 3 ? bits[bits.length - 1] : "") || "";
  const m = tail.match(/^([A-Za-z .]{2,20})?\s*([0-9]{5}(?:-[0-9]{4})?)?$/);
  if (m) {
    if (m[1]) out.state = m[1].trim();
    if (m[2]) out.postal_code = m[2];
  }
  if (bits.length > 3) out.city = bits[bits.length - 2] ?? null;
  const unit = text.match(/\b(?:apt|unit|ste|suite|#)\s*([\w-]+)/i);
  if (unit) out.address_line_2 = unit[0];
  return out;
}

/** Build a stored address from either a typed line or structured parts. */
export function buildAddress(
  input: Partial<ProjectAddress> & { text?: string | null },
  source: AddressSource = "manual",
): ProjectAddress {
  const parsed = input.text ? parseAddress(input.text) : {};
  const merged: Partial<ProjectAddress> = { ...parsed, ...stripEmpty(input) };
  const formatted = cleanAddressText(input.property_address || formatAddress(merged) || input.text || "");
  if (!formatted) return emptyAddress();
  return {
    ...emptyAddress(),
    ...merged,
    property_address: formatted,
    address_line_1: cleanAddressText(merged.address_line_1 || formatted),
    normalized_address: normalizeAddress(formatted),
    address_source: ADDRESS_SOURCES.includes(source) ? source : "unknown",
    address_verified_at:
      source === "autocomplete" || source === "existing_property" ? new Date().toISOString() : null,
  };
}

function stripEmpty(obj: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (k === "text") continue;
    if (v === null || v === undefined || v === "") continue;
    out[k] = v;
  }
  return out;
}

/** True when two addresses point at the same place for matching purposes. */
export function addressesMatch(a: unknown, b: unknown): boolean {
  const x = normalizeAddress(a);
  const y = normalizeAddress(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // A shorter typed line that is fully contained in the stored one (e.g. the
  // user omitted the ZIP) still points at the same property.
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 8 && long.startsWith(short);
}

/** Find the closest existing property for a typed address, if any. */
export function findMatchingProperty<T extends { id: string; address?: string | null; normalized_address?: string | null }>(
  address: unknown,
  properties: T[],
): T | null {
  const key = normalizeAddress(address);
  if (!key) return null;
  for (const p of properties || []) {
    if (addressesMatch(key, p.normalized_address || p.address)) return p;
  }
  return null;
}

/** Street portion, used for the generated video title. */
export function streetOf(address: unknown): string {
  const text = cleanAddressText(address);
  if (!text) return "";
  return (text.split(",")[0] || "").trim();
}

/** Title default that never overwrites what the user typed. */
export function defaultVideoTitle(address: unknown, titleTouched?: boolean, current?: string | null): string {
  const cur = String(current ?? "").trim();
  if (titleTouched && cur) return cur;
  const street = streetOf(address);
  if (street) return `${street} Property Video`;
  return cur || "Untitled Video";
}

/** What a card shows under the title. */
export function addressDisplay(record: { property_address?: string | null; property_label?: string | null; property_id?: string | null }): {
  text: string;
  unassigned: boolean;
  notLinked: boolean;
} {
  const addr = cleanAddressText(record?.property_address || "");
  const label = cleanAddressText(record?.property_label || "");
  const text = addr || (label && !/^untitled property$/i.test(label) ? label : "");
  if (!text) return { text: "Unassigned", unassigned: true, notLinked: false };
  return { text, unassigned: false, notLinked: !record?.property_id };
}
