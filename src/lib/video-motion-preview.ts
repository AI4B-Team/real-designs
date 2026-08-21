/**
 * Simulated motion preview.
 *
 * The preview is a CSS transform of the still image that mimics the chosen
 * camera move. It costs nothing, spends no credits and calls no model — it
 * exists so the user can judge a move before paying to generate it, and it
 * always says so out loud.
 */
import { motionPreset, strengthScale, type MotionStrength } from "@/lib/video-motion-presets";

export const PREVIEW_DISCLAIMER = "Simulated Preview · No Credits Used";

type Keyframe = { scale: number; x: number; y: number; rotate: number };

function frames(id: string, k: number): [Keyframe, Keyframe] {
  const z = (v: number) => 1 + (v - 1) * k;
  const p = (v: number) => v * k;
  const base: Keyframe = { scale: 1, x: 0, y: 0, rotate: 0 };
  switch (id) {
    case "pan_left":
      return [{ ...base, scale: z(1.12), x: p(5) }, { ...base, scale: z(1.12), x: p(-5) }];
    case "pan_right":
      return [{ ...base, scale: z(1.12), x: p(-5) }, { ...base, scale: z(1.12), x: p(5) }];
    case "tilt_up":
      return [{ ...base, scale: z(1.12), y: p(5) }, { ...base, scale: z(1.12), y: p(-5) }];
    case "tilt_down":
      return [{ ...base, scale: z(1.12), y: p(-5) }, { ...base, scale: z(1.12), y: p(5) }];
    case "zoom_in":
    case "dolly_in":
    case "walkthrough":
      return [{ ...base, scale: z(1.02) }, { ...base, scale: z(1.25) }];
    case "zoom_out":
    case "dolly_out":
      return [{ ...base, scale: z(1.25) }, { ...base, scale: z(1.02) }];
    case "orbit_left":
      return [
        { scale: z(1.16), x: p(4), y: 0, rotate: p(1.2) },
        { scale: z(1.16), x: p(-4), y: p(-1.5), rotate: p(-1.2) },
      ];
    case "orbit_right":
      return [
        { scale: z(1.16), x: p(-4), y: 0, rotate: p(-1.2) },
        { scale: z(1.16), x: p(4), y: p(-1.5), rotate: p(1.2) },
      ];
    case "reveal":
      return [{ ...base, scale: z(1.3), y: p(4) }, { ...base, scale: z(1.02), y: 0 }];
    case "drift":
      return [{ ...base, scale: z(1.05), x: p(1) }, { ...base, scale: z(1.06), x: p(-1) }];
    case "static":
    default:
      return [base, base];
  }
}

function css(f: Keyframe): string {
  return `translate(${f.x}%, ${f.y}%) scale(${f.scale}) rotate(${f.rotate}deg)`;
}

export type PreviewHandle = {
  play: () => void;
  pause: () => void;
  replay: () => void;
  update: (motionId: string, strength: MotionStrength, seconds: number) => void;
  destroy: () => void;
};

/**
 * Animate an <img> (or any element) to simulate the move. The element must
 * live inside an overflow:hidden container.
 */
export function attachMotionPreview(
  el: HTMLElement,
  motionId: string,
  strength: MotionStrength = "standard",
  seconds?: number,
): PreviewHandle {
  let anim: Animation | null = null;

  const build = (id: string, st: MotionStrength, secs: number) => {
    anim?.cancel();
    const [a, b] = frames(id, strengthScale(st));
    el.style.willChange = "transform";
    el.style.transformOrigin = "center center";
    try {
      anim = el.animate(
        [{ transform: css(a) }, { transform: css(b) }],
        {
          duration: Math.max(1, secs) * 1000,
          iterations: Infinity,
          direction: "alternate",
          easing: "ease-in-out",
        },
      );
    } catch (_) {
      /* browsers without WAAPI simply show the still image */
      anim = null;
      el.style.transform = css(a);
    }
  };

  build(motionId, strength, seconds || motionPreset(motionId).seconds);

  return {
    play: () => anim?.play(),
    pause: () => anim?.pause(),
    replay: () => {
      if (!anim) return;
      anim.currentTime = 0;
      anim.play();
    },
    update: (id, st, secs) => build(id, st, secs || motionPreset(id).seconds),
    destroy: () => {
      anim?.cancel();
      anim = null;
      el.style.transform = "";
      el.style.willChange = "";
    },
  };
}
