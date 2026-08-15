import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Voice matching for narration.
 *
 * The user records or uploads a short sample of their own voice. A speech model
 * listens to it and returns the closest synthesis voice plus a spoken-style
 * brief (pace, warmth, accent, energy). Narration then uses that pair, so every
 * video is narrated in a voice built from the user's own sample.
 */

const Input = z.object({
  audio: z.string().min(64).max(12_000_000), // base64, no data: prefix
  format: z.enum(["wav", "mp3", "webm", "m4a", "ogg", "aac", "flac"]),
  label: z.string().max(48).nullable().optional(),
});

const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"];

export const analyzeVoiceSample = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              `You profile a speaker for text-to-speech matching. Available synthesis voices: ${VOICES.join(", ")}. ` +
              `Return JSON only: {"voice":"<one of the list>","instructions":"<80-320 character spoken delivery brief covering pitch, pace, warmth, accent and energy>","summary":"<one short sentence describing the voice>","pitch":"low|medium|high","pace":"slow|measured|brisk"}. ` +
              `Pick the listed voice whose timbre and gender presentation is closest to the speaker. Never invent a voice name.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Profile this speaker so synthesized narration sounds like them." },
              { type: "input_audio", input_audio: { data: data.audio, format: data.format } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("Rate limit reached, try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    if (!res.ok) throw new Error(`Could not read that voice sample (${res.status}).`);

    const payload = (await res.json()) as any;
    let parsed: any = {};
    try {
      parsed = JSON.parse(payload?.choices?.[0]?.message?.content ?? "{}");
    } catch {
      parsed = {};
    }

    const voice = VOICES.includes(parsed?.voice) ? parsed.voice : "alloy";
    const instructions =
      typeof parsed?.instructions === "string" && parsed.instructions.trim().length > 12
        ? parsed.instructions.trim().slice(0, 400)
        : "Speak in a natural, warm real estate presenter tone at a measured pace.";

    return {
      voice,
      instructions,
      summary: typeof parsed?.summary === "string" ? parsed.summary.slice(0, 160) : "",
      pitch: typeof parsed?.pitch === "string" ? parsed.pitch.slice(0, 12) : "",
      pace: typeof parsed?.pace === "string" ? parsed.pace.slice(0, 12) : "",
      label: (data.label || "My Voice").slice(0, 48),
    };
  });
