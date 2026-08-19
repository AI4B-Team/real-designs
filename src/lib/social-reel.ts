/* Client-side 9x16 social reel: before -> cross fade -> after, with branding.
   Renders on a canvas and records it with MediaRecorder. No credits, no server. */

export type ReelMeta = {
  title?: string | null;
  address?: string | null;
  room?: string | null;
  style?: string | null;
  range?: string | null;
};

const W = 1080;
const H = 1920;
const DURATION = 12000; // ms

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load one of the photos for the reel."));
    img.src = url;
  });
}

function pickMime(): string {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

/** Draw an image cover-cropped into the frame, with a slow zoom. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  zoom: number,
  panY: number,
) {
  const scale = Math.max(W / img.width, H / img.height) * zoom;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2 + panY, w, h);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function label(ctx: CanvasRenderingContext2D, text: string, alpha: number) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = "700 44px Inter, system-ui, sans-serif";
  const padX = 34;
  const w = ctx.measureText(text).width + padX * 2;
  const x = (W - w) / 2;
  const y = 210;
  ctx.fillStyle = "rgba(10,10,10,.82)";
  roundRect(ctx, x, y, w, 92, 46);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text, W / 2, y + 48);
  ctx.restore();
}

function footer(ctx: CanvasRenderingContext2D, meta: ReelMeta, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const grad = ctx.createLinearGradient(0, H - 640, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,.88)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - 640, W, 640);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const lines: Array<[string, string, string]> = [];
  if (meta.room) lines.push(["700 62px Inter, system-ui, sans-serif", "#ffffff", meta.room]);
  if (meta.address)
    lines.push(["500 36px Inter, system-ui, sans-serif", "rgba(255,255,255,.78)", meta.address]);
  if (meta.style)
    lines.push(["500 34px Inter, system-ui, sans-serif", "rgba(255,255,255,.66)", meta.style]);

  let y = H - 300;
  for (const [font, color, text] of lines) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(text.length > 42 ? text.slice(0, 41) + "…" : text, 78, y);
    y += 62;
  }

  if (meta.range) {
    ctx.font = "600 30px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,.6)";
    ctx.fillText("ESTIMATED PLANNING RANGE", 78, H - 168);
    ctx.font = "700 52px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(meta.range, 78, H - 110);
  }

  // wordmark
  ctx.font = "800 30px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,.85)";
  const mark = "REAL DESIGNS";
  ctx.fillText(mark, W - 78, H - 110);
  const markW = ctx.measureText(mark).width;
  ctx.fillStyle = "#CC0000";
  ctx.fillRect(W - 78 - markW, H - 92, markW, 6);

  ctx.restore();
}

/**
 * Build a 12 second 9x16 reel from a before and an after photo.
 * Resolves with a video Blob (mp4 when the browser supports it, otherwise webm).
 */
export async function buildSocialReel(
  beforeUrl: string,
  afterUrl: string,
  meta: ReelMeta = {},
  onProgress?: (pct: number) => void,
): Promise<{ blob: Blob; ext: string }> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser cannot record video. Try Chrome or Edge.");
  }
  const [before, after] = await Promise.all([loadImage(beforeUrl), loadImage(afterUrl)]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");

  const mime = pickMime();
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(
    stream,
    mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined,
  );
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime || "video/webm" }));
  });

  // timeline (ms): hold before, cross fade, hold after
  const FADE_IN = 500;
  const HOLD_BEFORE = 4000;
  const CROSS = 1600;
  const start = performance.now();
  rec.start();

  await new Promise<void>((resolve) => {
    const frame = () => {
      const t = performance.now() - start;
      const p = Math.min(t / DURATION, 1);
      onProgress?.(p);

      const zoomBefore = 1.0 + 0.05 * (t / DURATION);
      const zoomAfter = 1.06 - 0.05 * (t / DURATION);

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, W, H);

      drawCover(ctx, before, zoomBefore, 0);

      let mix = 0;
      if (t > HOLD_BEFORE) mix = Math.min((t - HOLD_BEFORE) / CROSS, 1);
      if (mix > 0) {
        ctx.save();
        ctx.globalAlpha = mix;
        drawCover(ctx, after, zoomAfter, 0);
        ctx.restore();
      }

      // wipe line during the cross fade
      if (mix > 0 && mix < 1) {
        ctx.save();
        ctx.globalAlpha = Math.sin(mix * Math.PI);
        ctx.fillStyle = "#CC0000";
        ctx.fillRect(0, H * 0.5 - 3, W, 6);
        ctx.restore();
      }

      label(ctx, "BEFORE", 1 - mix);
      label(ctx, "AFTER", mix);
      footer(ctx, meta, Math.min(1, Math.max(0, (t - 600) / 900)));

      // fade in / out
      const fade =
        t < FADE_IN
          ? 1 - t / FADE_IN
          : t > DURATION - 600
            ? Math.min(1, (t - (DURATION - 600)) / 600)
            : 0;
      if (fade > 0) {
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      if (p >= 1) {
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  rec.stop();
  stream.getTracks().forEach((t) => t.stop());
  const blob = await done;
  const ext = (mime || "video/webm").includes("mp4") ? "mp4" : "webm";
  return { blob, ext };
}
