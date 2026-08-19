/**
 * Bulk restyle.
 *
 * Select many uploaded photos in the Media library, pick one style, and every
 * selected photo is redesigned in that style. One credit per photo. Results
 * are saved as design versions on each asset, so they show up in the library
 * next to the original.
 */
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { resolvePhotoUrl, uploadRenderDataUrl } from "@/lib/room-photos";
import { renderDesign } from "@/lib/design-render.functions";
import { addMediaVersion } from "@/lib/property-media.functions";
import { STYLES, STYLE_CATEGORIES, styleById } from "@/lib/style-catalog";
import { isPlanBlocked, openUpgrade } from "@/lib/rd-upgrade";

const esc = (s: any) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );

const INTENSITIES = ["Refresh", "Makeover", "Full Remodel"];
const GRADES = ["Builder Grade", "Retail Grade", "Designer Grade"];

/** Downscale any image URL into a data URL the render model accepts. */
async function toDataUrl(src: string, max = 1100): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Could not read that photo."));
    i.src = src;
  });
  const scale = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
  const c = document.createElement("canvas");
  c.width = Math.round((img.naturalWidth || max) * scale);
  c.height = Math.round((img.naturalHeight || max) * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9);
}

export type BulkRestyleItem = {
  id: string;
  assetId: string;
  title?: string | null;
  path?: string | null;
  room?: string | null;
};

export type BulkRestyleInput = {
  items: BulkRestyleItem[];
  toast?: (msg: string) => void;
  onDone?: () => void;
};

export function openBulkRestyle(input: BulkRestyleInput) {
  const note = input.toast || ((m: string) => console.log(m));
  const items = (input.items || []).filter((x) => x && x.assetId && x.path);
  if (!items.length) {
    note("Select At Least One Uploaded Photo To Redesign.");
    return;
  }

  const host = document.querySelector(".rd-app") || document.body;
  const featured = STYLES.filter((s) => s.isActive !== false);
  const state = {
    styleId: (featured.find((s) => s.isFeatured) || featured[0]).id,
    category: "Most Popular",
    q: "",
    intensity: "Makeover",
    grade: "Retail Grade",
    busy: false,
  };

  const inCat = () => {
    const q = state.q.trim().toLowerCase();
    let list = featured;
    if (q)
      list = list.filter((s) =>
        (s.displayName + " " + s.category + " " + s.aliases.join(" ")).toLowerCase().includes(q),
      );
    else if (state.category === "Most Popular")
      list = list.filter((s) => s.isFeatured).sort((a, b) => a.featuredRank - b.featuredRank);
    else list = list.filter((s) => s.category === state.category);
    return list.slice(0, 60);
  };

  const wrap = document.createElement("div");
  wrap.className = "rd-modal on";
  wrap.innerHTML = `
  <div class="rd-modal-card" role="dialog" aria-modal="true" aria-label="Redesign Selected Photos" style="max-width:640px">
    <button class="rd-modal-x" data-x aria-label="Close"><i data-lucide="x"></i></button>
    <h3 style="margin:0 0 4px">Redesign Selected Photos</h3>
    <p class="mono" style="margin:0 0 14px;color:var(--mute-2)">${items.length} Photo${items.length === 1 ? "" : "s"} &middot; ${items.length} Credit${items.length === 1 ? "" : "s"}</p>

    <div class="mc-f"><label for="brQ">Style</label>
      <input id="brQ" type="text" placeholder="Search Styles" value=""></div>
    <div class="mc-chips" data-g="category" style="margin:-6px 0 10px">
      ${STYLE_CATEGORIES.map((c) => `<button type="button" data-v="${esc(c)}" class="${c === state.category ? "on" : ""}">${esc(c)}</button>`).join("")}
    </div>
    <div class="mc-chips" id="brStyles" style="margin-bottom:14px"></div>

    <div class="mc-f"><label>Intensity</label><div class="mc-chips" data-g="intensity">
      ${INTENSITIES.map((v) => `<button type="button" data-v="${v}" class="${v === state.intensity ? "on" : ""}">${v}</button>`).join("")}
    </div></div>

    <div class="mc-f"><label>Finish Grade</label><div class="mc-chips" data-g="grade">
      ${GRADES.map((v) => `<button type="button" data-v="${v}" class="${v === state.grade ? "on" : ""}">${v}</button>`).join("")}
    </div></div>

    <p class="mono" id="brStat" style="margin:12px 0 0;color:var(--mute-2)"></p>
    <div class="mc-prog" hidden><i></i></div>
    <div class="mc-actions">
      <button class="btn btn-ghost btn-sm" data-x>Cancel</button>
      <button class="btn btn-primary btn-sm" data-go><i data-lucide="wand-2"></i>Redesign ${items.length} Photo${items.length === 1 ? "" : "s"}</button>
    </div>
  </div>`;
  host.appendChild(wrap);

  const stat = wrap.querySelector("#brStat") as HTMLElement;
  const bar = wrap.querySelector(".mc-prog") as HTMLElement;
  const fill = bar.querySelector("i") as HTMLElement;
  const goBtn = wrap.querySelector("[data-go]") as HTMLButtonElement;

  function paintStyles() {
    const box = wrap.querySelector("#brStyles") as HTMLElement;
    const list = inCat();
    if (!list.some((s) => s.id === state.styleId) && list.length) state.styleId = list[0].id;
    box.innerHTML = list.length
      ? list
          .map(
            (s) =>
              `<button type="button" data-s="${esc(s.id)}" class="${s.id === state.styleId ? "on" : ""}">${esc(s.displayName)}</button>`,
          )
          .join("")
      : `<span class="mono" style="color:var(--mute-2)">No Styles Match That Search.</span>`;
    box.querySelectorAll("[data-s]").forEach((b) => {
      (b as HTMLElement).onclick = () => {
        state.styleId = (b as HTMLElement).dataset["s"] as string;
        paintStyles();
      };
    });
  }
  paintStyles();
  try {
    createIcons({ icons, root: wrap } as any);
  } catch (_) {}

  const close = () => {
    if (state.busy) return;
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
  (wrap.querySelector("#brQ") as HTMLInputElement).oninput = (e: any) => {
    state.q = e.target.value || "";
    paintStyles();
  };
  wrap.querySelectorAll(".mc-chips[data-g]").forEach((g) => {
    (g as HTMLElement).querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        const key = (g as HTMLElement).dataset["g"] as string;
        (state as any)[key] = (b as HTMLElement).dataset["v"];
        (g as HTMLElement).querySelectorAll("button").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        if (key === "category") {
          state.q = "";
          (wrap.querySelector("#brQ") as HTMLInputElement).value = "";
          paintStyles();
        }
      };
    });
  });

  goBtn.onclick = async () => {
    if (state.busy) return;
    const style = styleById(state.styleId);
    if (!style) return;
    state.busy = true;
    goBtn.disabled = true;
    bar.hidden = false;
    let done = 0;
    let failed = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      stat.textContent = `Redesigning Photo ${i + 1} Of ${items.length} In ${style.displayName}`;
      fill.style.width = Math.round((i / items.length) * 100) + "%";
      try {
        const src = await resolvePhotoUrl(it.path);
        if (!src) throw new Error("Could not open that photo.");
        const image = await toDataUrl(src, 1100);
        const r = await renderDesign({
          data: {
            image,
            room_type: it.room && it.room !== "Needs Review" ? it.room : "living room",
            direction: style.displayName,
            style_id: style.id,
            project_type: "interior",
            intensity: state.intensity,
            grade: state.grade,
            notes: null,
            keep: [],
            replace: [],
            remove: [],
          },
        });
        const path = await uploadRenderDataUrl(r.image);
        await addMediaVersion({
          data: {
            asset_id: it.assetId,
            label: style.displayName,
            kind: "design",
            modification_class: "Proposed Design",
            storage_path: path,
            ops: {
              bulk_restyle: true,
              style: style.id,
              intensity: state.intensity,
              grade: state.grade,
            },
            approve: false,
          },
        });
        done++;
        try {
          window.dispatchEvent(new Event("rd:credits-changed"));
        } catch (_) {}
      } catch (e: any) {
        failed++;
        if (isPlanBlocked(e?.message || "")) {
          state.busy = false;
          wrap.remove();
          document.removeEventListener("keydown", onKey);
          openUpgrade(e?.message, "Add Credits To Redesign These Photos");
          if (done && input.onDone) input.onDone();
          return;
        }
      }
    }
    fill.style.width = "100%";
    state.busy = false;
    wrap.remove();
    document.removeEventListener("keydown", onKey);
    note(
      done
        ? `${done} Photo${done === 1 ? "" : "s"} Redesigned In ${style.displayName}${failed ? `, ${failed} Skipped` : ""}.`
        : "None Of The Photos Could Be Redesigned.",
    );
    if (input.onDone) input.onDone();
  };
}
