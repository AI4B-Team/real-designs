import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ADDRESS_SOURCES,
  buildAddress,
  cleanAddressText,
  findMatchingProperty,
  normalizeAddress,
} from "@/lib/property-address";

const AddressInput = z.object({
  text: z.string().max(400).optional(),
  address_line_1: z.string().max(200).nullish(),
  address_line_2: z.string().max(60).nullish(),
  city: z.string().max(80).nullish(),
  state: z.string().max(40).nullish(),
  postal_code: z.string().max(20).nullish(),
  country: z.string().max(60).nullish(),
  source: z.enum(ADDRESS_SOURCES as [string, ...string[]]).default("manual"),
});

/** Suggestions come from the workspace's own properties. No third-party
    autocomplete provider is configured, so manual entry stays fully usable and
    nothing is ever presented as verified that was not. */
export const suggestAddresses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ q: z.string().max(200).default("") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("properties")
      .select("id, address, city, state, postal_code, normalized_address")
      .limit(200);
    const key = normalizeAddress(data.q);
    const list = (rows ?? []).filter((p: any) => !key || normalizeAddress(p.address).includes(key));
    return { provider: "workspace" as const, suggestions: list.slice(0, 8) };
  });

/** Does this address already exist as a property? Read-only: matching never
    creates or merges anything. */
export const matchPropertyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ address: z.string().max(400) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("properties")
      .select("id, address, city, state, postal_code, normalized_address")
      .limit(500);
    const hit = findMatchingProperty(data.address, (rows ?? []) as any[]);
    return { match: hit ? { id: hit.id, address: hit.address ?? "" } : null };
  });

/** Create one canonical property from an address the user explicitly chose to
    save. Never called from keystroke, input or blur handlers. */
export const createPropertyFromAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AddressInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const addr = buildAddress(data as any, data.source as any);
    if (!addr.property_address) throw new Error("Enter an address first.");

    const { data: rows } = await supabase
      .from("properties")
      .select("id, address, normalized_address")
      .limit(500);
    const existing = findMatchingProperty(addr.property_address, (rows ?? []) as any[]);
    if (existing)
      return {
        id: existing.id,
        address: existing.address ?? addr.property_address,
        created: false,
      };

    const { data: row, error } = await supabase
      .from("properties")
      .insert({
        owner_id: userId,
        address: addr.property_address,
        city: addr.city,
        state: addr.state ? String(addr.state).slice(0, 2).toUpperCase() : null,
        postal_code: addr.postal_code,
        normalized_address: addr.normalized_address,
      } as any)
      .select("id, address")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, address: (row as any).address as string, created: true };
  });

/** Server-side guard: a client-supplied property_id is only honoured when the
    signed-in user can actually read that property under RLS. */
export const assertPropertyAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ property_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("properties")
      .select("id, address")
      .eq("id", data.property_id)
      .maybeSingle();
    if (!row) throw new Error("That property is not available on this account.");
    return { id: row.id as string, address: cleanAddressText((row as any).address) };
  });
