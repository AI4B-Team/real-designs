/* Social Caption Studio — AI captions and hashtags for any photo, design or video. */
import { createIcons, icons } from "lucide";
import { generateSocialCopy } from "@/lib/social-copy.functions";
import { rdToast } from "@/lib/rd-toast";

const PLATFORMS: [string, string][] = [
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["facebook", "Facebook"],
  ["linkedin", "LinkedIn"],
  ["youtube", "YouTube"],
];

const TONES: [string, string][] = [
  ["friendly", "Friendly"],
  ["professional", "Professional"],
  ["luxury", "Luxury"],
  ["punchy", "Punchy"],
];

function esc(s: unknown) {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}

export type SocialCopyInput = {
  title?: string | null;
  room?: string | null;
  style?: string | null;
  propertyLabel?: string | null;
  kind?: "image" | "video";
};

export function openSocialCopy(item: SocialCopyInput) {
  const host = document.querySelector(".rd-app") || document.body;
  const state = { platform: "instagram", tone: "friendly", busy: false, text: "" };

  const wrap = document.createElement("div");
  wrap.className = "rd-modal on";
  wrap.innerHTML = `
  <div class="rd-modal-card" role="dialog" aria-modal="true" aria-label="Write Social Caption" style="max-width:620px">
    <button class="rd-modal-x" data-x aria-label="Close"><i data-lucide="x"></i></button>
    <h3 style="margin:0 0 4px">Write Social Caption</h3>
    <p class="mono" style="margin:0 0 14px;color:var(--mute-2)">${esc(item.title || "Asset")} &middot; Free, No Credits</p>

    <div class="sc-f"><label>Platform</label><div class="sc-chips" data-g="platform">
      ${PLATFORMS.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === state.platform ? "on" : ""}">${l}</button>`).join("")}
    </div></div>

    <div class="sc-f"><label>Tone</label><div class="sc-chips" data-g="tone">
      ${TONES.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === state.tone ? "on" : ""}">${l}</button>`).join("")}
    </div></div>

    <div class="sc-f"><label for="scOut">Caption</label>
      <textarea id="scOut" rows="9" placeholder="Generate a caption, then edit it before you post."></textarea></div>

    <div class="sc-actions">
      <button class="btn btn-ghost btn-sm" data-copy><i data-lucide="copy"></i>Copy</button>
      <span style="flex:1"></span>
      <button class="btn btn-ghost btn-sm" data-x>Close</button>
      <button class="btn btn-primary btn-sm" data-go><i data-lucide="sparkles"></i>Generate</button>
    </div>
  </div>`;
  host.appendChild(wrap);
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

  wrap.querySelectorAll(".sc-chips").forEach((g) => {
    (g as HTMLElement).querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        const key = (g as HTMLElement).dataset["g"] as "platform" | "tone";
        (state as any)[key] = (b as HTMLElement).dataset["v"];
        (g as HTMLElement).querySelectorAll("button").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
      };
    });
  });

  const out = wrap.querySelector("#scOut") as HTMLTextAreaElement;
  const goBtn = wrap.querySelector("[data-go]") as HTMLButtonElement;

  (wrap.querySelector("[data-copy]") as HTMLButtonElement).onclick = async () => {
    const text = out.value.trim();
    if (!text) {
      rdToast("Generate A Caption First.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      rdToast("Caption Copied.");
    } catch (_) {
      out.select();
      rdToast("Press Cmd Or Ctrl + C To Copy.");
    }
  };

  goBtn.onclick = async () => {
    if (state.busy) return;
    state.busy = true;
    goBtn.disabled = true;
    const label = goBtn.innerHTML;
    goBtn.textContent = "Writing…";
    try {
      const res: any = await generateSocialCopy({
        data: {
          platform: state.platform as any,
          tone: state.tone as any,
          kind: item.kind || "image",
          title: item.title || null,
          room: item.room || null,
          style: item.style || null,
          property: item.propertyLabel || null,
        },
      });
      const tags = (res.hashtags || []).map((h: string) => `#${h}`).join(" ");
      out.value = [
        res.hook,
        "",
        res.caption,
        res.cta ? `\n${res.cta}` : "",
        tags ? `\n${tags}` : "",
      ]
        .filter((x) => x !== undefined)
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      rdToast("Caption Ready.");
    } catch (e: any) {
      rdToast(e?.message || "The Caption Could Not Be Written.", "error");
    } finally {
      state.busy = false;
      goBtn.disabled = false;
      goBtn.innerHTML = label;
      try {
        createIcons({ icons, root: goBtn } as any);
      } catch (_) {}
    }
  };
}

export default openSocialCopy;
