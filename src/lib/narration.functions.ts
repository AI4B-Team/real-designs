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

/** Split at sentence boundaries so no single request exceeds the model's input cap. */
function chunkScript(text: string, maxWords = 300): string[] {
  const words = (s: string) => (s.match(/\S+/g) ?? []).length;
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let cur = "";
  const flush = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = "";
  };
  for (const s of sentences) {
    if (words(s) > maxWords) {
      flush();
      const w = s.match(/\S+/g) ?? [];
      for (let i = 0; i < w.length; i += maxWords) chunks.push(w.slice(i, i + maxWords).join(" "));
      continue;
    }
    if (cur && words(cur) + words(s) > maxWords) flush();
    cur += s;
  }
  flush();
  return chunks.length ? chunks : [text];
}

export const synthesizeNarration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const voice = data.voice && VOICES.includes(data.voice) ? data.voice : "alloy";

    const speak = async (text: string): Promise<Uint8Array> => {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, voice, input: text, response_format: "mp3" }),
      });
      if (res.status === 429) throw new Error("Rate limit reached, try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      if (!res.ok) throw new Error(`Narration failed (${res.status}).`);
      return new Uint8Array(await res.arrayBuffer());
    };

    const parts: Uint8Array[] = [];
    for (const chunk of chunkScript(data.script)) parts.push(await speak(chunk));

    const total = parts.reduce((n, p) => n + p.length, 0);
    const buf = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
      buf.set(p, off);
      off += p.length;
    }

    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) {
      bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    }
    return { audio: `data:audio/mpeg;base64,${btoa(bin)}`, voice };
  });
