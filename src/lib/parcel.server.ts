import type { LngLat, ParcelRecord } from "@/lib/parcel";
import { validateParcelResponse } from "@/lib/parcel";

/**
 * Parcel provider adapter.
 *
 * REAL DESIGNS does not own parcel data and does not guess it. This module
 * relays a configured provider's response and refuses to invent one: with no
 * provider configured the feature reports itself unavailable rather than
 * drawing an approximate lot line that a buyer might rely on.
 */

export function providerName(): string {
  return process.env["PARCEL_PROVIDER_NAME"] || "Parcel Provider";
}

export function providerConfigured(): boolean {
  return !!(process.env["PARCEL_PROVIDER_URL"] && process.env["PARCEL_PROVIDER_KEY"]);
}

export type ParcelFetchResult =
  | {
      ok: true;
      record: ParcelRecord;
      /** Image georeference, when the provider returns one. */
      georeference: { bounds: [LngLat, LngLat] } | null;
    }
  | { ok: false; error: string };

export const NOT_CONFIGURED =
  "Parcel Import Is Not Available — no parcel data provider is connected, so no boundary can be retrieved. Draw the boundary manually instead; it will be labelled approximate.";

export async function fetchParcel(input: {
  address: string;
  parcelId?: string | null;
}): Promise<ParcelFetchResult> {
  if (!providerConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const base = process.env["PARCEL_PROVIDER_URL"]!;
  const key = process.env["PARCEL_PROVIDER_KEY"]!;
  const url = new URL(base);
  url.searchParams.set("address", input.address);
  if (input.parcelId) url.searchParams.set("parcel_id", input.parcelId);

  let payload: unknown;
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `The parcel provider could not return a boundary for this address (${res.status}). Draw the boundary manually instead.`,
      };
    }
    payload = await res.json();
  } catch {
    return {
      ok: false,
      error: "The parcel provider could not be reached. Draw the boundary manually instead.",
    };
  }

  const parsed = validateParcelResponse(payload, providerName());
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, record: parsed.record, georeference: parsed.georeference };
}
