/**
 * REAL REVEAL renderer.
 *
 * Renders a scene list to a real video file in the browser: canvas motion +
 * transitions + captions + disclosure labels + a closing branded scene,
 * recorded with MediaRecorder. No AI video call, so a re-render of an edited
 * storyboard is fast and predictable.
 */

export type SceneLabel = {
  text: string;
  style?: "clean" | "architectural" | "callout";
  position?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
};

export type RevealScene = {
  url: string;
  compareUrl?: string | null;
  room_name?: string | null;
  scene_type?: string;
  duration?: number;
  motion?: string;
  transition?: string;
  caption?: string | null;
  disclosure_type?: string | null;
  /** "standard" = camera motion only. "immersive" = AI-animated movement. */
  motion_level?: "standard" | "immersive";
  immersive_effect?: string | null;
  exterior_effect?: string | null;
  labels?: SceneLabel[];
};

/** Standard camera moves. */
export const STANDARD_MOTIONS: Array<[string, string]> = [
  ["auto", "Auto"],
  ["push", "Push In"],
  ["pull", "Pull Out"],
  ["pan_left", "Pan Left"],
  ["pan_right", "Pan Right"],
  ["tilt_up", "Tilt Up"],
  ["tilt_down", "Tilt Down"],
  ["dolly_left", "Dolly Left"],
  ["dolly_right", "Dolly Right"],
  ["orbit_left", "Orbit Left"],
  ["orbit_right", "Orbit Right"],
  ["crane_up", "Crane Up"],
  ["crane_down", "Crane Down"],
  ["diag_in", "Diagonal In"],
  ["diag_out", "Diagonal Out"],
  ["drift_in", "Slow Drift In"],
  ["drift_out", "Slow Drift Out"],
  ["static", "Static"],
];

/** Immersive movement inside the frame. Architecture is never redrawn. */
export const IMMERSIVE_EFFECTS: Array<[string, string]> = [
  ["curtains", "Curtains Drifting"],
  ["fire", "Fireplace Flicker"],
  ["water", "Water Movement"],
  ["light", "Daylight Shift"],
  ["foliage", "Foliage Sway"],
];

/** Cinematic exterior moves. Simulated camera work, never drone footage. */
export const EXTERIOR_EFFECTS: Array<[string, string]> = [
  ["approach", "Approach"],
  ["rise", "Rise"],
  ["aerial_reveal", "Aerial Reveal"],
];

export const EXTERIOR_DISCLOSURE =
  "Cinematic camera movement is simulated from still photography. This is not actual drone footage.";

export const IMMERSIVE_CREDITS_PER_SCENE = 6;

export type RevealBrand = {
  company_name?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  default_cta?: string | null;
  accent?: string | null;
  logoUrl?: string | null;
};

import { createMusicTrack } from "@/lib/rd-music";

export type RevealOptions = {
  aspect: "9:16" | "16:9" | "1:1" | "4:5";
  versionType: "branded" | "clean" | "disclosure";
  brand?: RevealBrand | null;
  title?: string | null;
  subtitle?: string | null;
  transition?: string;
  captionsEnabled?: boolean;
  music?: string | null;
  musicVolume?: number;
  narrationUrl?: string | null;
  avatar?: {
    url: string;
    name?: string | null;
    title?: string | null;
    mode: "intro_bubble" | "full" | "bubble";
    corner?: "bottom_left" | "bottom_right" | "top_left" | "top_right";
    greeting?: string | null;
  } | null;
  onProgress?: (pct: number) => void;
};


export const DISCLOSURE_LABEL: Record<string, string> = {
  staged: "Virtually Staged",
  proposed: "Proposed Design",
  concept: "Conceptual Rendering",
  altered: "Digitally Altered",
  ai: "AI-Generated Concept",
};

const SIZES: Record<RevealOptions["aspect"], [number, number]> = {
  "9:16": [1080, 1920],
  "16:9": [1920, 1080],
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
};

const ACCENT = "#CC0000";
const FADE = 420; // ms per transition

/** Every transition style the builders can offer. */
export const TRANSITIONS: Array<[string, string]> = [
  ["clean", "Clean"],
  ["smooth", "Smooth"],
  ["cinematic", "Cinematic"],
  ["whip", "Whip Pan"],
  ["punch", "Zoom Punch"],
  ["flash", "Flash Cut"],
  ["glitch", "Glitch"],
  ["leak", "Light Leak"],
  ["slide", "Slide"],
  ["none", "None"],
];

/** High-energy social styles handled by the VFX pipeline. */
export const VIRAL_TRANSITIONS = new Set(["whip", "punch", "flash", "glitch", "leak", "slide"]);

const VFX_MS = 360;

/** 0..1 ramps at the head and tail of a scene. */
function edgeRamp(local: number, dur: number, ms = VFX_MS) {
  const tIn = local < ms ? 1 - local / ms : 0;
  const tOut = dur - local < ms ? 1 - (dur - local) / ms : 0;
  return { tIn, tOut, k: Math.max(tIn, tOut) };
}

/** Camera-level distortion applied before the scene is drawn. Returns a restore flag. */
function vfxEnter(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  style: string,
  local: number,
  dur: number,
): boolean {
  if (!VIRAL_TRANSITIONS.has(style)) return false;
  const { tIn, tOut, k } = edgeRamp(local, dur);
  if (k <= 0) return false;
  ctx.save();
  if (style === "whip" || style === "slide") {
    const dx = tOut * W * 0.85 * -1 + tIn * W * 0.85;
    ctx.translate(dx, 0);
    if (style === "whip") ctx.filter = `blur(${Math.round(k * 16)}px)`;
  } else if (style === "punch") {
    const s = 1 + k * 0.28;
    ctx.translate(W / 2, H / 2);
    ctx.scale(s, s);
    ctx.translate(-W / 2, -H / 2);
  } else if (style === "glitch") {
    ctx.translate(Math.sin(local * 0.09) * k * W * 0.012, 0);
  }
  return true;
}

/** Overlays drawn after the scene: flashes, leaks, glitch slices. */
function vfxOverlay(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  style: string,
  local: number,
  dur: number,
) {
  if (!VIRAL_TRANSITIONS.has(style)) return;
  const { k } = edgeRamp(local, dur);
  if (k <= 0) return;
  ctx.save();
  if (style === "flash") {
    ctx.globalAlpha = Math.min(0.92, k * k * 1.1);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
  } else if (style === "leak") {
    const g = ctx.createLinearGradient(0, H, W, 0);
    g.addColorStop(0, "rgba(255,180,90,0)");
    g.addColorStop(0.5, "rgba(255,150,70,.85)");
    g.addColorStop(1, "rgba(204,0,0,0)");
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = k * 0.85;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (style === "glitch") {
    const slices = 7;
    for (let i = 0; i < slices; i++) {
      const sh = H / slices;
      const sy = i * sh;
      const off = (i % 2 === 0 ? 1 : -1) * k * W * (0.02 + (i % 3) * 0.012);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(ctx.canvas, 0, sy, W, sh, off, sy, W, sh);
    }
    ctx.globalAlpha = k * 0.35;
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = ACCENT;
    ctx.fillRect(0, 0, W, H);
  } else if (style === "punch" || style === "whip") {
    ctx.globalAlpha = k * 0.35;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}


function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("One of the scene images could not be loaded."));
    img.src = url;
  });
}

function pickMime(withAudio = false): string {
  const candidates = withAudio
    ? [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ]
    : [
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Cover-crop with a motion offset. Important room content stays centred. */
function drawMotion(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number,
  H: number,
  motion: string,
  t: number,
) {
  let zoom = 1.04;
  let dx = 0;
  let dy = 0;
  switch (motion) {
    case "push":
      zoom = 1.0 + 0.09 * t;
      break;
    case "pull":
      zoom = 1.09 - 0.09 * t;
      break;
    case "pan_left":
      zoom = 1.1;
      dx = (0.5 - t) * W * 0.08;
      break;
    case "pan_right":
      zoom = 1.1;
      dx = (t - 0.5) * W * 0.08;
      break;
    case "orbit_left":
      zoom = 1.1;
      dx = (0.5 - t) * W * 0.06;
      dy = Math.sin(t * Math.PI) * H * 0.01;
      break;
    case "orbit_right":
      zoom = 1.1;
      dx = (t - 0.5) * W * 0.06;
      dy = -Math.sin(t * Math.PI) * H * 0.01;
      break;
    case "tilt_up":
      zoom = 1.12;
      dy = (0.5 - t) * H * 0.09;
      break;
    case "tilt_down":
      zoom = 1.12;
      dy = (t - 0.5) * H * 0.09;
      break;
    case "dolly_left":
      zoom = 1.06 + 0.04 * t;
      dx = (0.5 - t) * W * 0.1;
      break;
    case "dolly_right":
      zoom = 1.06 + 0.04 * t;
      dx = (t - 0.5) * W * 0.1;
      break;
    case "crane_up":
      zoom = 1.14 - 0.06 * t;
      dy = (0.5 - t) * H * 0.11;
      break;
    case "crane_down":
      zoom = 1.08 + 0.06 * t;
      dy = (t - 0.5) * H * 0.11;
      break;
    case "diag_in":
      zoom = 1.0 + 0.11 * t;
      dx = (0.5 - t) * W * 0.05;
      dy = (0.5 - t) * H * 0.05;
      break;
    case "diag_out":
      zoom = 1.13 - 0.11 * t;
      dx = (t - 0.5) * W * 0.05;
      dy = (t - 0.5) * H * 0.05;
      break;
    case "drift_in":
      zoom = 1.0 + 0.04 * t;
      break;
    case "drift_out":
      zoom = 1.04 - 0.04 * t;
      break;
    case "static":
      zoom = 1.02;
      break;
    // Cinematic exterior moves — simulated camera work on a still frame.
    case "approach":
      zoom = 1.0 + 0.2 * t;
      dy = (0.5 - t) * H * 0.02;
      break;
    case "rise":
      zoom = 1.14;
      dy = (t - 0.5) * H * 0.1;
      break;
    case "aerial_reveal":
      zoom = 1.26 - 0.24 * t;
      dy = (0.5 - t) * H * 0.05;
      break;
    default:
      zoom = 1.0 + 0.06 * t; // automatic
  }
  const scale = Math.max(W / img.width, H / img.height) * zoom;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (W - w) / 2 + dx, (H - h) / 2 + dy, w, h);
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, bg: string, fg: string) {
  ctx.font = `700 ${size}px Inter, system-ui, sans-serif`;
  const padX = size * 0.72;
  const w = ctx.measureText(text).width + padX * 2;
  const h = size * 2;
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + h / 2 + 1);
  return w;
}

function caption(ctx: CanvasRenderingContext2D, W: number, H: number, text: string, alpha: number) {
  if (!text || alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createLinearGradient(0, H - H * 0.28, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,.72)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - H * 0.28, W, H * 0.28);
  const size = Math.round(W * 0.042);
  ctx.font = `700 ${size}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const max = 34;
  ctx.fillText(text.length > max ? text.slice(0, max - 1) + "…" : text, W * 0.07, H - H * 0.09);
  ctx.restore();
}

function brandOutro(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  brand: RevealBrand,
  title: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#0b0b0b";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  let y = H * 0.42;
  const name = brand.company_name || brand.contact_name || "REAL DESIGNS";
  ctx.font = `800 ${Math.round(W * 0.062)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.fillText(name, W / 2, y);
  ctx.fillStyle = brand.accent || ACCENT;
  ctx.fillRect(W / 2 - W * 0.08, y + W * 0.022, W * 0.16, Math.max(4, W * 0.006));

  y += H * 0.075;
  if (title) {
    ctx.font = `600 ${Math.round(W * 0.034)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.fillText(title, W / 2, y);
    y += H * 0.05;
  }
  const contact = [brand.phone, brand.email, brand.website].filter(Boolean).join("  •  ");
  if (contact) {
    ctx.font = `500 ${Math.round(W * 0.028)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,.62)";
    ctx.fillText(contact, W / 2, y);
    y += H * 0.05;
  }
  if (brand.default_cta) {
    ctx.font = `700 ${Math.round(W * 0.03)}px Inter, system-ui, sans-serif`;
    const t = brand.default_cta;
    const w = ctx.measureText(t).width + W * 0.08;
    ctx.fillStyle = brand.accent || ACCENT;
    roundRect(ctx, (W - w) / 2, y - W * 0.03, w, W * 0.085, W * 0.045);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.fillText(t, W / 2, y + W * 0.012);
  }
  ctx.restore();
}

/** Full-frame AI presenter card used to open and close the video. */
function presenterCard(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  img: HTMLImageElement,
  name: string,
  title: string,
  line: string,
  accent: string,
  p: number,
) {
  const a = Math.min(1, p * 5) * Math.min(1, (1 - p) * 5 + 0.2);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.fillStyle = "#0b0b0b";
  ctx.fillRect(0, 0, W, H);

  // portrait, gently pushed in over the card
  const r = Math.min(W, H) * 0.19 * (1 + p * 0.03);
  const cx = W / 2;
  const cy = H * 0.36;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const scale = Math.max((r * 2) / img.width, (r * 2) / img.height) * 1.06;
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2 - r * 0.06, dw, dh);
  ctx.restore();
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(3, W * 0.006);
  ctx.beginPath();
  ctx.arc(cx, cy, r + ctx.lineWidth, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let y = cy + r + H * 0.075;
  if (name) {
    ctx.font = `800 ${Math.round(W * 0.052)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.fillText(name, cx, y);
    y += H * 0.042;
  }
  if (title) {
    ctx.font = `600 ${Math.round(W * 0.026)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,.66)";
    ctx.fillText(title, cx, y);
    y += H * 0.05;
  }
  if (line) {
    ctx.font = `500 ${Math.round(W * 0.03)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,.86)";
    wrapCenter(ctx, line, cx, y, W * 0.78, W * 0.042);
  }
  ctx.restore();
}

function wrapCenter(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxW: number,
  lh: number,
) {
  const words = text.split(/\s+/);
  let line = "";
  const lines: string[] = [];
  for (const w of words) {
    const next = line ? line + " " + w : w;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, cx, y + i * lh));
}

/** Small circular presenter bubble kept over the property scenes. */
function presenterBubble(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  img: HTMLImageElement,
  corner: string,
  accent: string,
  t: number,
  alpha: number,
) {
  const r = Math.min(W, H) * 0.075;
  const m = W * 0.055;
  const cx = corner.endsWith("left") ? m + r : W - m - r;
  const cy = corner.startsWith("top") ? H * 0.14 + r : H - m - r;
  const pulse = 1 + Math.sin(t / 320) * 0.012;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = "rgba(0,0,0,.45)";
  ctx.shadowBlur = r * 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r * pulse, 0, Math.PI * 2);
  ctx.fillStyle = "#0b0b0b";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r * pulse, 0, Math.PI * 2);
  ctx.clip();
  const scale = Math.max((r * 2 * pulse) / img.width, (r * 2 * pulse) / img.height) * 1.08;
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2 - r * 0.08, dw, dh);
  ctx.restore();
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(2, W * 0.0045);
  ctx.beginPath();
  ctx.arc(cx, cy, r * pulse + ctx.lineWidth, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}



function disclosureNote(ctx: CanvasRenderingContext2D, W: number, H: number, label: string, alpha: number) {
  if (!label) return;
  ctx.save();
  ctx.globalAlpha = alpha * 0.94;
  pill(ctx, label, W * 0.06, H * 0.055, Math.round(W * 0.026), "rgba(10,10,10,.78)", "#fff");
  ctx.restore();
}

/**
 * Immersive motion. The photograph itself is never redrawn — movement is
 * layered on top of the frame so walls, windows and furniture stay exactly
 * where the render put them.
 */
function immersiveLayer(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  effect: string,
  t: number,
) {
  const wave = Math.sin(t * Math.PI * 2);
  ctx.save();
  if (effect === "fire") {
    const flick = 0.06 + 0.05 * Math.abs(Math.sin(t * Math.PI * 6));
    const g = ctx.createRadialGradient(W * 0.5, H * 0.72, W * 0.02, W * 0.5, H * 0.72, W * 0.6);
    g.addColorStop(0, `rgba(255,150,60,${flick})`);
    g.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (effect === "water") {
    ctx.globalAlpha = 0.1 + 0.04 * wave;
    const g = ctx.createLinearGradient(0, H * 0.6, W, H);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5 + 0.12 * wave, "rgba(255,255,255,.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
  } else if (effect === "curtains") {
    ctx.globalAlpha = 0.13 + 0.05 * wave;
    const x = W * (0.06 + 0.01 * wave);
    const g = ctx.createLinearGradient(x, 0, x + W * 0.22, 0);
    g.addColorStop(0, "rgba(255,255,255,.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W * 0.42, H);
  } else if (effect === "foliage") {
    ctx.globalAlpha = 0.1 + 0.05 * Math.abs(wave);
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.5);
    g.addColorStop(0, "rgba(20,40,20,.45)");
    g.addColorStop(1, "rgba(20,40,20,0)");
    ctx.fillStyle = g;
    ctx.fillRect(W * (0.02 * wave), 0, W, H * 0.5);
  } else {
    // daylight shift
    ctx.globalAlpha = 0.09 + 0.05 * t;
    const g = ctx.createLinearGradient(W, 0, 0, H);
    g.addColorStop(0, "rgba(255,220,170,.7)");
    g.addColorStop(1, "rgba(255,220,170,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

/** Restrained scene labels: a room name, a material note or one callout. */
function sceneLabels(ctx: CanvasRenderingContext2D, W: number, H: number, labels: SceneLabel[], alpha: number) {
  if (!labels?.length || alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const size = Math.round(W * 0.028);
  const margin = W * 0.06;
  const byPos: Record<string, number> = {};
  for (const l of labels.slice(0, 3)) {
    const text = (l.text || "").trim();
    if (!text) continue;
    const pos = l.position || "bottom_left";
    const row = byPos[pos] ?? 0;
    byPos[pos] = row + 1;
    const offset = row * size * 2.5;
    const style = l.style || "clean";
    ctx.font = `${style === "architectural" ? 600 : 700} ${size}px Inter, system-ui, sans-serif`;
    const label = style === "architectural" ? text.toUpperCase() : text;
    const padX = size * 0.7;
    const wBox = ctx.measureText(label).width + padX * 2;
    const hBox = size * 2;
    const x = pos.endsWith("right") ? W - margin - wBox : margin;
    const y = pos.startsWith("top") ? H * 0.16 + offset : H * 0.74 - offset;

    if (style === "callout") {
      ctx.fillStyle = ACCENT;
      roundRect(ctx, x, y, wBox, hBox, hBox / 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
    } else if (style === "architectural") {
      ctx.strokeStyle = "rgba(255,255,255,.75)";
      ctx.lineWidth = Math.max(1, W * 0.0015);
      ctx.strokeRect(x, y, wBox, hBox);
      ctx.fillStyle = "rgba(10,10,10,.42)";
      ctx.fillRect(x, y, wBox, hBox);
      ctx.fillStyle = "#fff";
    } else {
      ctx.fillStyle = "rgba(10,10,10,.62)";
      roundRect(ctx, x, y, wBox, hBox, size * 0.4);
      ctx.fill();
      ctx.fillStyle = "#fff";
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    if (style === "architectural") ctx.letterSpacing = "0.08em" as unknown as string;
    ctx.fillText(label, x + padX, y + hBox / 2 + 1);
    ctx.letterSpacing = "0px" as unknown as string;
  }
  ctx.restore();
}

/** Suggest scene labels from the room name and any caption already written. */
export function suggestLabels(roomName?: string | null, caption?: string | null): SceneLabel[] {
  const out: SceneLabel[] = [];
  const room = (roomName || "").trim();
  if (room) out.push({ text: room, style: "clean", position: "bottom_left" });
  const cap = (caption || "").trim();
  if (cap && cap.toLowerCase() !== room.toLowerCase()) {
    out.push({ text: cap.slice(0, 40), style: "architectural", position: "bottom_right" });
  }
  return out;
}



export function estimateDuration(scenes: RevealScene[], lengthPreset: string): number {
  const target = lengthPreset === "quick" ? 15 : lengthPreset === "full" ? 60 : 30;
  if (!scenes.length) return 0;
  return target;
}

/** Per-scene seconds for a target length. */
export function sceneDurations(count: number, lengthPreset: string): number {
  const target = lengthPreset === "quick" ? 15 : lengthPreset === "full" ? 60 : 30;
  return Math.max(1.6, Math.min(6, target / Math.max(count, 1)));
}

export async function renderReveal(
  scenes: RevealScene[],
  opts: RevealOptions,
): Promise<{ blob: Blob; ext: string; duration: number; poster: string }> {
  if (typeof MediaRecorder === "undefined") throw new Error("This browser cannot record video. Try Chrome or Edge.");
  if (!scenes.length) throw new Error("Add at least one scene first.");

  const [W, H] = SIZES[opts.aspect];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");

  const imgs = await Promise.all(scenes.map((s) => loadImage(s.url)));
  const compares = await Promise.all(
    scenes.map((s) => (s.compareUrl ? loadImage(s.compareUrl).catch(() => null) : Promise.resolve(null))),
  );

  const brand = opts.brand ?? null;
  const showBrand = opts.versionType === "branded" && !!brand;
  const showDisclosure = opts.versionType !== "clean";

  const av = opts.avatar ?? null;
  const avImg = av?.url ? await loadImage(av.url).catch(() => null) : null;
  const avFull = !!avImg && (av!.mode === "full" || av!.mode === "intro_bubble");
  const avBubble = !!avImg && (av!.mode === "bubble" || av!.mode === "intro_bubble");
  const avAccent = brand?.accent || ACCENT;


  const stream = canvas.captureStream(30);
  const music = await createMusicTrack(opts.music, opts.musicVolume ?? 0.55, opts.narrationUrl ?? null);
  if (music) stream.addTrack(music.track);
  const mime = pickMime(!!music);
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 9_000_000 } : undefined);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime || "video/webm" }));
  });

  const durations = scenes.map((s) => Math.max(1.2, s.duration ?? 3) * 1000);
  const avIntro = avFull ? 3000 : 0;
  const avOutro = avFull ? 2600 : 0;
  const outro = showBrand ? 2600 : 0;
  const total = avIntro + durations.reduce((a, b) => a + b, 0) + avOutro + outro;


  rec.start();
  const start = performance.now();

  await new Promise<void>((resolve) => {
    const frame = () => {
      const t = performance.now() - start;
      opts.onProgress?.(Math.min(t / total, 1));

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, W, H);

      // AI presenter opening card
      if (avFull && avImg && t < avIntro) {
        presenterCard(
          ctx,
          W,
          H,
          avImg,
          av?.name || "",
          av?.title || "",
          av?.greeting || "",
          avAccent,
          Math.min(t / Math.max(avIntro, 1), 1),
        );
        if (t >= total) {
          resolve();
          return;
        }
        requestAnimationFrame(frame);
        return;
      }

      const ts = t - avIntro;
      const sceneEnd = durations.reduce((a, b) => a + b, 0);

      // find the active scene
      let acc = 0;
      let idx = -1;
      let local = 0;
      for (let i = 0; i < durations.length; i++) {
        if (ts < acc + durations[i]!) {
          idx = i;
          local = ts - acc;
          break;
        }
        acc += durations[i]!;
      }

      if (idx === -1 && avFull && avImg && ts < sceneEnd + avOutro) {
        // AI presenter closing card
        presenterCard(
          ctx,
          W,
          H,
          avImg,
          av?.name || "",
          av?.title || "",
          brand?.default_cta || "Reach Out For A Private Tour.",
          avAccent,
          Math.min((ts - sceneEnd) / Math.max(avOutro, 1), 1),
        );
        if (t >= total) {
          resolve();
          return;
        }
        requestAnimationFrame(frame);
        return;
      }

      if (idx === -1) {
        // branded closing scene
        const p = Math.min((t - (total - outro)) / Math.max(outro, 1), 1);
        if (brand) brandOutro(ctx, W, H, brand, opts.title ?? "", Math.min(1, p * 3));

      } else {
        const scene = scenes[idx]!;
        const img = imgs[idx]!;
        const cmp = compares[idx];
        const p = local / durations[idx]!;
        const motion = scene.exterior_effect
          ? scene.exterior_effect
          : scene.motion && scene.motion !== "auto"
            ? scene.motion
            : "auto";
        const transition = scene.transition || opts.transition || "clean";
        const vfxOn = vfxEnter(ctx, W, H, transition, local, durations[idx]!);


        if (cmp && scene.scene_type === "before_after") {
          // Match Frame: same camera, original holds then the design takes over.
          const mix = Math.min(Math.max((p - 0.42) / 0.22, 0), 1);
          drawMotion(ctx, cmp, W, H, motion, p);
          if (mix > 0) {
            if (transition === "slider" || transition === "wipe") {
              ctx.save();
              ctx.beginPath();
              ctx.rect(0, 0, W * mix, H);
              ctx.clip();
              drawMotion(ctx, img, W, H, motion, p);
              ctx.restore();
              if (mix < 1) {
                ctx.fillStyle = ACCENT;
                ctx.fillRect(W * mix - 3, 0, 6, H);
              }
            } else {
              ctx.save();
              ctx.globalAlpha = mix;
              drawMotion(ctx, img, W, H, motion, p);
              ctx.restore();
            }
          }
          if (opts.captionsEnabled !== false) {
            const lab = mix > 0.5 ? "After" : "Before";
            ctx.save();
            pill(ctx, lab, W * 0.06, H * 0.14, Math.round(W * 0.03), "rgba(10,10,10,.8)", "#fff");
            ctx.restore();
          }
        } else {
          drawMotion(ctx, img, W, H, motion, p);
        }

        if (scene.motion_level === "immersive") {
          immersiveLayer(ctx, W, H, scene.immersive_effect || "light", p);
        }
        if (vfxOn) ctx.restore();
        vfxOverlay(ctx, W, H, transition, local, durations[idx]!);


        if (opts.captionsEnabled !== false) {
          const text = scene.caption || scene.room_name || "";
          const a = Math.min(1, local / 350) * Math.min(1, (durations[idx]! - local) / 350);
          caption(ctx, W, H, text, a);
        }
        {
          const a = Math.min(1, local / 350) * Math.min(1, (durations[idx]! - local) / 350);
          sceneLabels(ctx, W, H, scene.labels ?? [], a);
        }
        if (showDisclosure && scene.disclosure_type) {
          disclosureNote(ctx, W, H, DISCLOSURE_LABEL[scene.disclosure_type] ?? "Digitally Altered", 1);
        }
        if (showDisclosure && scene.motion_level === "immersive") {
          ctx.save();
          ctx.globalAlpha = 0.9;
          pill(ctx, "AI-Animated", W * 0.06, H * 0.105, Math.round(W * 0.022), "rgba(10,10,10,.72)", "#fff");
          ctx.restore();
        }
        if (showDisclosure && scene.exterior_effect) {
          ctx.save();
          ctx.globalAlpha = 0.72;
          ctx.font = `600 ${Math.round(W * 0.018)}px Inter, system-ui, sans-serif`;
          ctx.fillStyle = "rgba(255,255,255,.9)";
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          ctx.fillText("Simulated camera movement — not drone footage", W * 0.06, H * 0.955);
          ctx.restore();
        }
        if (showBrand && brand?.company_name) {
          ctx.save();
          ctx.globalAlpha = 0.8;
          ctx.font = `800 ${Math.round(W * 0.024)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = "right";
          ctx.textBaseline = "alphabetic";
          ctx.fillStyle = "rgba(255,255,255,.9)";
          ctx.fillText(brand.company_name, W - W * 0.06, H * 0.075);
          ctx.restore();
        }

        if (avBubble && avImg) {
          const fade = Math.min(1, ts / 500) * Math.min(1, (sceneEnd - ts) / 500);
          presenterBubble(ctx, W, H, avImg, av?.corner || "bottom_right", avAccent, t, Math.max(0, fade));
        }

        // transition fades between scenes

        if (transition !== "none" && !VIRAL_TRANSITIONS.has(transition)) {
          const fadeIn = local < FADE ? 1 - local / FADE : 0;
          const fadeOut = durations[idx]! - local < FADE ? 1 - (durations[idx]! - local) / FADE : 0;
          const f = Math.max(fadeIn, fadeOut) * (transition === "cinematic" ? 1 : transition === "smooth" ? 0.8 : 0.6);
          if (f > 0) {
            ctx.save();
            ctx.globalAlpha = f;
            ctx.fillStyle = "#0a0a0a";
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
          }
        }
      }

      if (t >= total) {
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  rec.stop();
  music?.stop();
  stream.getTracks().forEach((tr) => tr.stop());
  const blob = await done;

  // poster from the first scene
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, W, H);
  drawMotion(ctx, imgs[0]!, W, H, "static", 0.2);
  const poster = canvas.toDataURL("image/jpeg", 0.75);

  return { blob, ext: (mime || "video/webm").includes("mp4") ? "mp4" : "webm", duration: total / 1000, poster };
}
