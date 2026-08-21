/**
 * Photo-to-video motion clips.
 *
 * Turns a single ready image into a short cinematic clip (Ken Burns style
 * camera work) without opening the full video builder. Rendering happens in
 * the browser with the shared REAL REVEAL renderer, and the result lands in
 * the media library like any other video.
 */
import { createIcons, icons } from "lucide";
import { supabase } from "@/integrations/supabase/client";
import { resolvePhotoUrl } from "@/lib/room-photos";
import { saveVideo, startRender, finishVariant, setVideoStatus } from "@/lib/reveal.functions";
import { renderReveal } from "@/lib/reveal-render";
import { isPlanBlocked, openUpgrade } from "@/lib/rd-upgrade";
import {
  MOTION_STRENGTHS,
  defaultMotionFor,
  motionPreset,
  motionsForSpace,
  type MotionStrength,
} from "@/lib/video-motion-presets";
import { PREVIEW_DISCLAIMER, attachMotionPreview } from "@/lib/video-motion-preview";

const BUCKET = "reveal-videos";

/** The browser renderer speaks a smaller camera vocabulary than the presets. */
const RENDER_MOTION: Record<string, string> = {
  zoom_in: "push",
  dolly_in: "push",
  walkthrough: "push",
  reveal: "push",
  zoom_out: "pull",
  dolly_out: "pull",
  tilt_up: "push",
  tilt_down: "pull",
  drift: "push",
  static: "push",
};
const renderMotion = (id: string) => RENDER_MOTION[id] || id;

const FORMATS: Array<[string, string]> = [
  ["9:16", "Vertical 9:16"],
  ["1:1", "Square 1:1"],
  ["4:5", "Portrait 4:5"],
  ["16:9", "Wide 16:9"],
];
const LENGTHS: Array<[number, string]> = [
  [3, "3s"],
  [5, "5s"],
  [8, "8s"],
];


function esc(s: any) {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}

export type MotionClipInput = {
  title?: string | null;
  path?: string | null;
  propertyLabel?: string | null;
  room?: string | null;
  space?: string | null;
  onDone?: () => void;
  toast?: (msg: string) => void;
};

export function openMotionClip(item: MotionClipInput) {
  const host = document.querySelector(".rd-app") || document.body;
  const note = item.toast || ((m: string) => console.log(m));
  const path = item.path || "";
  if (!path) {
    note("This Image Is Not Ready For A Motion Clip Yet.");
    return;
  }

  const space = String((item as any).space || "interior");
  const presets = motionsForSpace(space);
  const state = {
    motion: defaultMotionFor(space),
    strength: "standard" as MotionStrength,
    aspect: "9:16",
    seconds: 5,
    caption: item.room || "",
    busy: false,
  };

  const wrap = document.createElement("div");
  wrap.className = "rd-modal on";
  wrap.innerHTML = `
  <div class="rd-modal-card" role="dialog" aria-modal="true" aria-label="Create Motion Clip" style="max-width:560px">
    <button class="rd-modal-x" data-x aria-label="Close"><i data-lucide="x"></i></button>
    <h3 style="margin:0 0 4px">Create Motion Clip</h3>
    <p class="mono" style="margin:0 0 14px;color:var(--mute-2)">${esc(item.title || "Photo")} &middot; 40 Credits</p>

    <div class="mc-prev"><div class="mc-prev-vp"><img id="mcPrevImg" alt="Motion preview"></div>
      <div class="mc-prev-bar"><span class="mono">${PREVIEW_DISCLAIMER}</span>
        <button type="button" class="fb-link" data-prev-replay>Replay</button></div></div>

    <div class="mc-f"><label>Camera Move</label><div class="mc-chips" data-g="motion">
      ${presets.map((m) => `<button type="button" data-v="${m.id}" title="${esc(m.blurb)}" class="${m.id === state.motion ? "on" : ""}">${esc(m.label)}</button>`).join("")}
    </div></div>

    <div class="mc-f"><label>Motion Strength</label><div class="mc-chips" data-g="strength">
      ${MOTION_STRENGTHS.map((s) => `<button type="button" data-v="${s.id}" class="${s.id === state.strength ? "on" : ""}">${s.label}</button>`).join("")}
    </div></div>

    <div class="mc-f"><label>Format</label><div class="mc-chips" data-g="aspect">
      ${FORMATS.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === state.aspect ? "on" : ""}">${l}</button>`).join("")}
    </div></div>

    <div class="mc-f"><label>Length</label><div class="mc-chips" data-g="seconds">
      ${LENGTHS.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === state.seconds ? "on" : ""}">${l}</button>`).join("")}
    </div></div>

    <div class="mc-f"><label for="mcCap">Caption <span class="mono" style="color:var(--mute-2)">Optional</span></label>
      <input id="mcCap" type="text" maxlength="60" placeholder="Living Room" value="${esc(state.caption)}"></div>


    <div class="mc-prog" hidden><i></i></div>
    <div class="mc-actions">
      <button class="btn btn-ghost btn-sm" data-x>Cancel</button>
      <button class="btn btn-primary btn-sm" data-go><i data-lucide="clapperboard"></i>Create Clip</button>
    </div>
  </div>`;
  host.appendChild(wrap);
  try {
    createIcons({ icons, root: wrap } as any);
  } catch (_) {}

  let preview: ReturnType<typeof attachMotionPreview> | null = null;
  const close = () => {
    if (state.busy) return;
    preview?.destroy();
    wrap.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) close();
  });
  wrap.querySelectorAll("[data-x]").forEach((b) => ((b as HTMLElement).onclick = close));

  /* Simulated preview: transforms the still, spends nothing. */
  const prevImg = wrap.querySelector("#mcPrevImg") as HTMLImageElement | null;
  const syncPreview = () => {
    if (!prevImg) return;
    if (!preview) preview = attachMotionPreview(prevImg, state.motion, state.strength, state.seconds);
    else preview.update(state.motion, state.strength, state.seconds);
  };
  void resolvePhotoUrl(path).then((u) => {
    if (!prevImg || !u) return;
    prevImg.src = u;
    syncPreview();
  });
  (wrap.querySelector("[data-prev-replay]") as HTMLElement | null)?.addEventListener("click", () =>
    preview?.replay(),
  );

  wrap.querySelectorAll(".mc-chips").forEach((g) => {
    (g as HTMLElement).querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        const key = (g as HTMLElement).dataset["g"] as
          | "motion"
          | "aspect"
          | "seconds"
          | "strength";
        const raw = (b as HTMLElement).dataset["v"] as string;
        (state as any)[key] = key === "seconds" ? Number(raw) : raw;
        if (key === "motion") state.seconds = motionPreset(raw).seconds;
        (g as HTMLElement).querySelectorAll("button").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        if (key === "motion") {
          wrap
            .querySelectorAll<HTMLElement>('.mc-chips[data-g="seconds"] button')
            .forEach((x) => x.classList.toggle("on", Number(x.dataset["v"]) === state.seconds));
        }
        syncPreview();
      };
    });
  });

  const capEl = wrap.querySelector("#mcCap") as HTMLInputElement;
  const bar = wrap.querySelector(".mc-prog") as HTMLElement;
  const fill = wrap.querySelector(".mc-prog i") as HTMLElement;
  const goBtn = wrap.querySelector("[data-go]") as HTMLButtonElement;

  goBtn.onclick = async () => {
    if (state.busy) return;
    state.busy = true;
    goBtn.disabled = true;
    goBtn.textContent = "Rendering…";
    bar.hidden = false;
    let projectId: string | null = null;
    try {
      const url = await resolvePhotoUrl(path);
      if (!url) throw new Error("That image could not be loaded.");
      const caption = capEl.value.trim();
      const title = `${item.title || "Motion Clip"} — Motion Clip`;

      const saved: any = await saveVideo({
        data: {
          project: {
            title: title.slice(0, 160),
            video_type: "motion_clip",
            source_type: "media",
            status: "draft",
            formats: [state.aspect],
            length_preset: "quick",
            transition: "clean",
            motion: renderMotion(state.motion),
            property_label: item.propertyLabel || null,
            branding: {},
            disclosure: {},
            settings: { builder: "motion_clip", seconds: state.seconds },
          },
          scenes: [
            {
              source_path: path,
              room_name: item.room || null,
              sequence: 0,
              scene_type: "design",
              duration: state.seconds,
              motion: renderMotion(state.motion),
              transition: "clean",
              caption: caption || null,
              crop_data: {},
              motion_level: "standard",
              labels: [],
            },
          ],
        },
      });
      projectId = saved.id;

      const started: any = await startRender({
        data: {
          id: projectId!,
          variants: [{ aspect_ratio: state.aspect as any, version_type: "clean" }],
        },
      });
      const variant = started.variants[0];

      const out = await renderReveal(
        [
          {
            url,
            room_name: item.room || null,
            scene_type: "design",
            duration: state.seconds,
            motion: renderMotion(state.motion),
            transition: "clean",
            caption: caption || null,
            motion_level: "standard",
            labels: [],
          } as any,
        ],
        {
          aspect: state.aspect as any,
          versionType: "clean",
          brand: null,
          title: title,
          transition: "clean",
          captionsEnabled: !!caption,
          onProgress: (p: number) => {
            fill.style.width = Math.round(p * 100) + "%";
          },
        } as any,
      );

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      const base = `${uid}/${projectId}/${variant.id}`;
      const videoPath = `${base}.${out.ext}`;
      const up = await supabase.storage.from(BUCKET).upload(videoPath, out.blob, {
        contentType: out.blob.type || "video/webm",
        upsert: true,
      });
      if (up.error) throw new Error(up.error.message);
      let thumbPath: string | null = null;
      try {
        const posterBlob = await (await fetch(out.poster)).blob();
        thumbPath = `${base}.jpg`;
        await supabase.storage
          .from(BUCKET)
          .upload(thumbPath, posterBlob, { contentType: "image/jpeg", upsert: true });
      } catch (_) {
        thumbPath = null;
      }

      await finishVariant({
        data: {
          variant_id: variant.id,
          render_status: "ready",
          output_path: videoPath,
          thumbnail_path: thumbPath,
          duration: out.duration,
          resolution:
            state.aspect === "16:9"
              ? "1920x1080"
              : state.aspect === "1:1"
                ? "1080x1080"
                : "1080x1920",
        },
      });
      await setVideoStatus({ data: { id: projectId!, status: "ready" } });

      state.busy = false;
      wrap.remove();
      document.removeEventListener("keydown", onKey);
      note("Your Motion Clip Is Ready.");
      item.onDone?.();
    } catch (e: any) {
      if (projectId) {
        try {
          await setVideoStatus({
            data: {
              id: projectId,
              status: "failed",
              error_message: String(e?.message || e).slice(0, 300),
            },
          });
        } catch (_) {}
      }
      state.busy = false;
      goBtn.disabled = false;
      goBtn.textContent = "Create Clip";
      bar.hidden = true;
      const msg = String(e?.message || "");
      if (isPlanBlocked(msg)) {
        wrap.remove();
        document.removeEventListener("keydown", onKey);
        openUpgrade(msg);
        return;
      }
      note(msg || "The Motion Clip Could Not Be Created.");
    }
  };
}
