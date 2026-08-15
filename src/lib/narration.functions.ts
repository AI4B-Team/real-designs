import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Voiceover narration for video builders.
 *
 * The script is spoken by the AI gateway's text-to-speech model and returned as
 * an mp3 data URL, which the browser renderer mixes under the music bed.
 */

const Input = z.object({
  script: z.string().min(4).max(4000),
  voice: z.string().max(40).nullable().optional(),
});

const MODEL = "openai/gpt-4o-mini-tts";
const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"];

export const synthesizeNarration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const voice = data.voice && VOICES.includes(data.voice) ? data.voice : "alloy";
    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        voice,
        input: data.script,
        response_format: "mp3",
      }),
    });

    if (res.status === 429) throw new Error("Rate limit reached, try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    if (!res.ok) throw new Error(`Narration failed (${res.status}).`);

    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) {
      bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    }
    return { audio: `data:audio/mpeg;base64,${btoa(bin)}`, voice };
  });
