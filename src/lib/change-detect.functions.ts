import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * Phase 2 — change detection.
 *
 * The model decides WHAT changed between the before and after image and HOW MUCH
 * of it. It never produces a price: it may only emit labels that already exist in
 * the cost catalog, and everything downstream is priced by SQL + arithmetic.
 */

const DetectInput = z.object({
  before: z.string().min(16), // data URL or absolute https URL
  after: z.string().min(16),
  grade: z.enum(["rental", "retail", "premium"]).default("retail"),
});

const ItemSchema = z.object({
  action: z.enum(["keep", "replace", "remove", "add"]),
  label: z.string(),
  material: z.string().nullable().optional(),
  qty: z.number().positive().nullable().optional(),
  note: z.string().nullable().optional(),
});

export const detectChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DetectInput.parse(input))
  .handler(async ({ data, context }) => {
    // Metered: one design credit, charged before the model runs.
    const { charge, chargeErrorMessage } = await import("@/lib/credits.server");
    const billing = await charge(context.userId, "design", "change detection");
    if (!billing.ok) throw new Error(chargeErrorMessage(billing));

    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: mappings, error } = await supabase
      .from("cost_mappings")
      .select("label, material, grade, qty_formula");
    if (error) throw new Error(error.message);

    const catalog = (mappings ?? []).map((m) => ({
      label: m.label,
      material: m.material,
      grade: m.grade,
      qty: m.qty_formula,
    }));
    const allowed = new Set(catalog.map((c) => c.label));

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const catalogText = catalog
      .map((c) => `- ${c.label}${c.material ? ` (${c.material})` : ""} · grade ${c.grade} · qty from ${c.qty}`)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You compare a BEFORE and AFTER photo of the same room and list only the construction/finish work implied by the difference. " +
              "You must never state or imply a cost. Use ONLY labels from the provided catalog. " +
              "If a finish looks unchanged, use action \"keep\". Give qty only for countable items (fixtures, doors); leave qty null for area-driven work so the estimator derives it from room dimensions.\n\n" +
              "Use these exact label strings only: " + [...allowed].join(", ") + "\n\nCATALOG:\n" +
              catalogText,
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Finish grade: ${data.grade}. First image is BEFORE, second is AFTER.` },
              { type: "image_url", image_url: { url: data.before } },
              { type: "image_url", image_url: { url: data.after } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_changes",
              description: "Report the detected change items.",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        action: { type: "string", enum: ["keep", "replace", "remove", "add"] },
                        label: { type: "string" },
                        material: { type: ["string", "null"] },
                        qty: { type: ["number", "null"] },
                        note: { type: ["string", "null"] },
                      },
                      required: ["action", "label"],
                      additionalProperties: false,
                    },
                  },
                  summary: { type: "string" },
                },
                required: ["items", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_changes" } },
      }),
    });

    if (res.status === 429) throw new Error("Rate limit reached, try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    if (!res.ok) throw new Error(`Change detection failed (${res.status}).`);

    const payload = (await res.json()) as any;
    const call = payload?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!call) throw new Error("No change items were returned.");

    let parsed: { items: unknown[]; summary?: string };
    try {
      parsed = JSON.parse(call);
    } catch {
      throw new Error("Change detection returned an unreadable result.");
    }

    const SYNONYMS: Record<string, string> = {
      paint: "wall_paint",
      wall_painting: "wall_paint",
      walls: "wall_paint",
      floor: "flooring",
      floors: "flooring",
      floor_covering: "flooring",
      baseboards: "baseboard",
      trim: "baseboard",
      door: "interior_door",
      doors: "interior_door",
      lighting: "light_fixture",
      light: "light_fixture",
      ceiling_light: "light_fixture",
      can_light: "recessed_light",
      recessed_lighting: "recessed_light",
      demo: "demolition",
      cabinets: "base_cabinet",
      cabinetry: "base_cabinet",
      counter: "countertop",
      counters: "countertop",
      faucet: "sink_faucet",
      backsplash: "wall_tile",
      tile: "wall_tile",
    };
    const normalize = (l: string) => {
      const k = l.trim().toLowerCase().replace(/[\s-]+/g, "_");
      return allowed.has(k) ? k : (SYNONYMS[k] ?? k);
    };

    const items = (parsed.items ?? [])
      .map((i) => ItemSchema.safeParse(i))
      .flatMap((r) => (r.success ? [{ ...r.data, label: normalize(r.data.label) }] : []))
      .filter((i) => allowed.has(i.label));

    const priceable = items.filter((i) => i.action !== "keep");

    return {
      summary: parsed.summary ?? "",
      items,
      priceable: priceable.map((i) => ({
        label: i.label,
        material: i.material ?? null,
        qty: i.qty ?? null,
      })),
      dropped: (parsed.items ?? []).length - items.length,
    };
  });
