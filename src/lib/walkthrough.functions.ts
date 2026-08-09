import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Walkthrough Video.
 *
 * Animates the finished render into a short dolly-in clip. Video generation is
 * an async job: start it, poll it, then store the MP4 in the user's private
 * bucket so the clip survives the gateway's short-lived download URL.
 *
 * Costs 40 credits, charged on start and refunded once if the job fails.
 */

const BUCKET = "room-photos";
const MODEL = "google/veo-3.1-lite";

const StartInput = z.object({
  image: z.string().min(16), // data URL of the render to animate
  room_type: z.string().max(60).default("living room"),
  direction: z.string().max(60).default("Warm Minimal"),
});

const PollInput = z.object({ id: z.string().min(3).max(120) });

function key(): string {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured.");
  return apiKey;
}

export const startWalkthrough = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = key();
    const { charge, refund, chargeErrorMessage } = await import("@/lib/credits.server");
    const charged = await charge(context.userId, "video", `Walkthrough video, ${data.room_type}`);
    if (!charged.ok) throw new Error(chargeErrorMessage(charged));

    const prompt = [
      `A slow, steady cinematic dolly-in through this ${data.room_type}, moving forward at eye level.`,
      "The room, its furniture, its finishes and its lighting stay exactly as shown in the reference image.",
      "No people, no text, no camera shake, no cuts. Calm real estate walkthrough feel.",
      `Interior direction: ${data.direction}.`,
    ].join(" ");

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/videos", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          prompt,
          seconds: "8",
          size: "1280x720",
          input_reference: data.image,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as any;
        if (res.status === 429)
          throw new Error(body?.message || "A video is already rendering. Wait for it to finish.");
        if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
        throw new Error(body?.message || `Video could not be started (${res.status}).`);
      }

      const job = (await res.json()) as any;
      if (!job?.id) throw new Error("Video could not be started.");
      return { id: String(job.id), status: String(job.status || "in_progress"), progress: Number(job.progress || 0) };
    } catch (err) {
      await refund(context.userId, charged.charged, "Walkthrough video failed to start");
      throw err;
    }
  });

export const pollWalkthrough = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PollInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = key();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${context.userId}/videos/${data.id}.mp4`;

    // Already stored from an earlier poll — hand back the signed URL.
    const existing = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (existing.data?.signedUrl) {
      return { status: "completed" as const, progress: 100, url: existing.data.signedUrl, path };
    }

    const res = await fetch(`https://ai.gateway.lovable.dev/v1/videos/${encodeURIComponent(data.id)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`Could not read the video job (${res.status}).`);
    const job = (await res.json()) as any;

    if (job.status === "failed") {
      const { refund, CREDIT_COSTS } = await import("@/lib/credits.server");
      const note = `Walkthrough video failed ${data.id}`;
      const { data: prior } = await supabaseAdmin
        .from("credit_ledger")
        .select("id")
        .eq("user_id", context.userId)
        .eq("note", note)
        .limit(1);
      if (!prior || prior.length === 0) await refund(context.userId, CREDIT_COSTS.video, note);
      throw new Error(job?.error?.message || "The video could not be generated.");
    }

    if (job.status !== "completed") {
      return { status: "in_progress" as const, progress: Number(job.progress || 0), url: null, path: null };
    }

    const content = await fetch(
      `https://ai.gateway.lovable.dev/v1/videos/${encodeURIComponent(data.id)}/content`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!content.ok) throw new Error("The finished video could not be downloaded.");
    const bytes = await content.arrayBuffer();

    const up = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (up.error) throw new Error(up.error.message);

    const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (!signed.data?.signedUrl) throw new Error("The video was saved but could not be opened.");

    return { status: "completed" as const, progress: 100, url: signed.data.signedUrl, path };
  });
