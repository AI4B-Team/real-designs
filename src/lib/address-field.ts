/* Shared, compact Property Address control.
   Used by the video builder (Add Photos and Scenes) and by Studio project
   details. Suggestions come from the workspace's own properties; there is no
   third-party autocomplete provider configured, so manual typing always works
   and nothing is ever marked verified that was not. */
import {
  addressesMatch,
  buildAddress,
  cleanAddressText,
  defaultVideoTitle,
  normalizeAddress,
} from "@/lib/property-address";

export type AddressState = {
  address: string;
  addressSource: string;
  propertyId: string | null;
  addressStructured: Record<string, any> | null;
  addressMatch: { id: string; address: string } | null;
  addressMatchDismissed?: boolean;
  addressSaveState?: "" | "saving" | "saved" | "error";
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export function addressListHtml(id: string, properties: Array<{ address?: string | null }>) {
  const seen = new Set<string>();
  const opts = (properties || [])
    .map((p) => cleanAddressText(p.address))
    .filter((a) => a && !seen.has(a) && seen.add(a))
    .slice(0, 40)
    .map((a) => `<option value="${esc(a)}"></option>`)
    .join("");
  return `<datalist id="${esc(id)}">${opts}</datalist>`;
}

export function saveStatusHtml(state: string | undefined) {
  if (state === "saving") return `<span class="rv-save mono">Saving…</span>`;
  if (state === "saved") return `<span class="rv-save mono ok">Saved</span>`;
  if (state === "error") return `<span class="rv-save mono bad">Couldn’t Save — <button class="fb-link" data-addr-retry="1">Retry</button></span>`;
  return "";
}

/** Full-width labelled field (Add Photos, Studio). */
export function addressFieldHtml(s: AddressState, properties: Array<{ address?: string | null }>, opts: { id?: string; compact?: boolean } = {}) {
  const id = opts.id || "rdAddr";
  return `<label class="rv-f rd-addrf">Property Address
    <span class="rd-addr-in"><i data-lucide="map-pin"></i>
      <input id="${esc(id)}" list="${esc(id)}List" placeholder="Enter the property address" maxlength="200" value="${esc(s.address || "")}" autocomplete="off">
    </span>
    ${addressListHtml(id + "List", properties)}
  </label>
  ${saveStatusHtml(s.addressSaveState)}
  ${matchHtml(s)}`;
}

/** Compact inline control for the Scenes information bar. */
export function addressBarHtml(s: AddressState, properties: Array<{ address?: string | null }>, id = "rdAddrBar") {
  return `<div class="rd-addr-bar">
    <span class="rd-addr-in"><i data-lucide="map-pin"></i>
      <input id="${esc(id)}" list="${esc(id)}List" placeholder="Enter the property address" maxlength="200" value="${esc(s.address || "")}" aria-label="Property Address" autocomplete="off">
    </span>
    ${addressListHtml(id + "List", properties)}
    ${saveStatusHtml(s.addressSaveState)}
  </div>${matchHtml(s)}`;
}

function matchHtml(s: AddressState) {
  if (!s.addressMatch || s.addressMatchDismissed || s.propertyId === s.addressMatch.id) return "";
  return `<div class="rd-addr-match">
    <i data-lucide="info"></i><span>This address matches an existing property.</span>
    <button class="btn btn-primary btn-xs" data-addr-use="${esc(s.addressMatch.id)}">Use Existing Property</button>
    <button class="btn btn-ghost btn-xs" data-addr-sep="1">Keep Separate</button>
  </div>`;
}

/** Apply a typed address to the state object, without touching property_id. */
export function applyAddress(s: AddressState, text: string, source = "manual") {
  const clean = cleanAddressText(text);
  s.address = clean;
  if (!clean) {
    s.addressStructured = null;
    s.addressSource = "unknown";
    s.addressMatch = null;
    return s;
  }
  const built = buildAddress({ text: clean }, source as any);
  s.addressStructured = built;
  s.addressSource = built.address_source;
  return s;
}

/** Columns persisted with the project record. */
export function addressColumns(s: AddressState) {
  const clean = cleanAddressText(s.address);
  if (!clean) {
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
  const built = (s.addressStructured as any) || buildAddress({ text: clean }, (s.addressSource as any) || "manual");
  return { ...built, property_address: clean, normalized_address: normalizeAddress(clean) };
}

export { addressesMatch, defaultVideoTitle, cleanAddressText };
