// Viral VFX Photo Pack — one-click cinematic looks for the photo editor.
// Every look is a pure client-side recipe: a set of adjustment deltas plus
// overlay layers that can render both as CSS (live preview) and as canvas
// draws (baked version). No credits, no server round trip.
/* eslint-disable */
// @ts-nocheck

/** Layer = { css, blend, alpha, draw(ctx,w,h,alpha) } */
function grad(css, drawStops, blend, alpha, angle) {
  return {
    css,
    blend,
    alpha,
    draw(ctx, w, h, a) {
      const rad = ((angle || 160) * Math.PI) / 180;
      const x = Math.cos(rad) * w * 0.5;
      const y = Math.sin(rad) * h * 0.5;
      const g = ctx.createLinearGradient(w / 2 - x, h / 2 - y, w / 2 + x, h / 2 + y);
      drawStops.forEach(([p, c]) => g.addColorStop(p, c));
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = blend;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  };
}

function radial(css, drawStops, blend, alpha, cx, cy, r) {
  return {
    css,
    blend,
    alpha,
    draw(ctx, w, h, a) {
      const g = ctx.createRadialGradient(
        w * (cx ?? 0.5),
        h * (cy ?? 0.5),
        0,
        w * (cx ?? 0.5),
        h * (cy ?? 0.5),
        Math.max(w, h) * (r ?? 0.75),
      );
      drawStops.forEach(([p, c]) => g.addColorStop(p, c));
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = blend;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  };
}

const VIGNETTE = (strength) =>
  radial(
    `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${strength}) 100%)`,
    [
      [0.45, "rgba(0,0,0,0)"],
      [1, `rgba(0,0,0,${strength})`],
    ],
    "multiply",
    1,
    0.5,
    0.5,
    0.72,
  );

/** Film grain drawn as procedural noise; CSS side uses a tiny repeating SVG. */
const GRAIN = (amount) => ({
  css: `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3"/></filter><rect width="160" height="160" filter="url(%23n)" opacity="1"/></svg>`.replace(
      "%23n",
      "#n",
    ),
  )}")`,
  cssSize: "160px 160px",
  blend: "overlay",
  alpha: amount,
  draw(ctx, w, h, a) {
    const tile = 220;
    const c = document.createElement("canvas");
    c.width = tile;
    c.height = tile;
    const t = c.getContext("2d");
    const img = t.createImageData(tile, tile);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + Math.random() * 90;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    t.putImageData(img, 0, 0);
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = "overlay";
    const pat = ctx.createPattern(c, "repeat");
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
  },
});

export const VFX_LOOKS = [
  {
    id: "cinematic",
    label: "Cinematic Teal",
    blurb: "Teal shadows, warm highlights, gentle contrast.",
    adjust: { contrast: 16, saturation: 8, shadows: 10, blacks: -6 },
    layers: [
      grad(
        "linear-gradient(150deg, rgba(255,170,90,.55), rgba(0,0,0,0) 55%, rgba(20,90,120,.6))",
        [
          [0, "rgba(255,170,90,.55)"],
          [0.55, "rgba(0,0,0,0)"],
          [1, "rgba(20,90,120,.6)"],
        ],
        "soft-light",
        0.9,
        150,
      ),
      VIGNETTE(0.32),
    ],
  },
  {
    id: "goldenhour",
    label: "Golden Hour",
    blurb: "Warm sun wash with a soft glow across the frame.",
    adjust: { exposure: 6, temperature: 22, saturation: 10, highlights: 8 },
    layers: [
      radial(
        "radial-gradient(circle at 78% 18%, rgba(255,196,110,.6), rgba(255,150,60,.12) 45%, rgba(0,0,0,0) 70%)",
        [
          [0, "rgba(255,196,110,.6)"],
          [0.45, "rgba(255,150,60,.12)"],
          [0.72, "rgba(0,0,0,0)"],
        ],
        "screen",
        0.9,
        0.78,
        0.18,
        0.8,
      ),
      VIGNETTE(0.22),
    ],
  },
  {
    id: "leak",
    label: "Light Leak",
    blurb: "Analog film leak burning in from the edge.",
    adjust: { exposure: 4, contrast: -6, saturation: 6 },
    layers: [
      grad(
        "linear-gradient(115deg, rgba(255,60,60,.55), rgba(255,190,80,.35) 28%, rgba(0,0,0,0) 58%)",
        [
          [0, "rgba(255,60,60,.55)"],
          [0.28, "rgba(255,190,80,.35)"],
          [0.58, "rgba(0,0,0,0)"],
        ],
        "screen",
        0.95,
        115,
      ),
    ],
  },
  {
    id: "film35",
    label: "Film 35",
    blurb: "Faded blacks, fine grain, printed-photo body.",
    adjust: { contrast: 8, saturation: -8, blacks: 14, temperature: 6 },
    layers: [
      grad(
        "linear-gradient(0deg, rgba(60,50,80,.25), rgba(0,0,0,0))",
        [
          [0, "rgba(60,50,80,.25)"],
          [1, "rgba(0,0,0,0)"],
        ],
        "screen",
        0.8,
        90,
      ),
      GRAIN(0.5),
      VIGNETTE(0.26),
    ],
  },
  {
    id: "editorial",
    label: "Editorial Mono",
    blurb: "High-contrast black and white with a printed bite.",
    adjust: { saturation: -100, contrast: 22, blacks: -6, whites: 8 },
    layers: [GRAIN(0.35), VIGNETTE(0.3)],
  },
  {
    id: "bloom",
    label: "Dreamy Bloom",
    blurb: "Soft halation lift for bright, airy interiors.",
    adjust: { exposure: 8, contrast: -8, blacks: 12, saturation: -4 },
    layers: [
      radial(
        "radial-gradient(circle at 50% 40%, rgba(255,255,255,.42), rgba(255,255,255,0) 65%)",
        [
          [0, "rgba(255,255,255,.42)"],
          [0.65, "rgba(255,255,255,0)"],
        ],
        "screen",
        0.85,
        0.5,
        0.4,
        0.8,
      ),
    ],
  },
  {
    id: "twilight",
    label: "Twilight Cool",
    blurb: "Blue hour cast for exteriors and dusk reveals.",
    adjust: { exposure: -6, temperature: -26, contrast: 14, shadows: -8 },
    layers: [
      grad(
        "linear-gradient(180deg, rgba(40,80,160,.55), rgba(0,0,0,0) 60%, rgba(255,150,80,.22))",
        [
          [0, "rgba(40,80,160,.55)"],
          [0.6, "rgba(0,0,0,0)"],
          [1, "rgba(255,150,80,.22)"],
        ],
        "soft-light",
        0.95,
        90,
      ),
      VIGNETTE(0.34),
    ],
  },
  {
    id: "punch",
    label: "Scroll Stopper",
    blurb: "Punchy saturation and contrast built for social feeds.",
    adjust: { contrast: 26, saturation: 24, whites: 10, blacks: -10, sharpen: 30 },
    layers: [VIGNETTE(0.28)],
  },
];

export const lookById = (id) => VFX_LOOKS.find((l) => l.id === id) || null;

/** Merge a look's adjustment deltas into a copy of the manual adjust store. */
export function applyLookAdjust(base, look, amount) {
  const out = { ...base };
  if (!look) return out;
  const k = (amount ?? 100) / 100;
  Object.entries(look.adjust || {}).forEach(([key, v]) => {
    if (typeof out[key] !== "number") return;
    const next = out[key] + v * k;
    out[key] = Math.round(Math.max(-100, Math.min(100, next)));
  });
  return out;
}

/** Overlay markup for the live preview stage. */
export function lookOverlayHTML(look, amount) {
  if (!look) return "";
  const k = (amount ?? 100) / 100;
  const layers = (look.layers || [])
    .map((l) => {
      const a = (l.alpha ?? 1) * k;
      const size = l.cssSize ? `background-size:${l.cssSize};` : "background-size:cover;";
      return `<span style="position:absolute;inset:0;pointer-events:none;background-image:${l.css};${size}mix-blend-mode:${l.blend};opacity:${a.toFixed(3)}"></span>`;
    })
    .join("");
  return `<span class="pme-vfx" aria-hidden="true" style="position:absolute;inset:0;overflow:hidden;pointer-events:none">${layers}</span>`;
}

/** Bake the look's overlays onto an already-drawn canvas context. */
export function bakeLook(ctx, w, h, look, amount) {
  if (!look) return;
  const k = (amount ?? 100) / 100;
  (look.layers || []).forEach((l) => {
    ctx.save();
    l.draw(ctx, w, h, (l.alpha ?? 1) * k);
    ctx.restore();
  });
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}
