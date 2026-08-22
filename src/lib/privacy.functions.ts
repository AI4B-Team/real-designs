import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ScanInput = z.object({ image: z.string().min(16) });

/**
 * Privacy scan. Free by design and never generative: it only reports where
 * sensitive content sits so the user can select it. The blur itself is baked
 * locally in the browser, so no credit is ever charged for Privacy Blur, and
 * a failed scan still leaves manual masking fully usable.
 */
export const scanPrivacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScanInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { detections: [], error: "Automatic detection is not configured. Use Manual Blur." };
    const { detectPrivacyRegions } = await import("@/lib/privacy.server");
    try {
      return { detections: await detectPrivacyRegions(data.image, apiKey), error: null as string | null };
    } catch (err: any) {
      return { detections: [], error: String(err?.message || "The scan failed. Use Manual Blur.") };
    }
  });
