/* Shared AI Presenter (avatar) UI for the design-video and listing-video builders. */

import {
  AVATAR_MODES,
  PRESET_AVATARS,
  addCustomAvatar,
  allAvatars,
  avatarGreeting,
  findAvatar,
  getCustomAvatars,
  loadCustomAvatars,
  type AvatarConfig,
} from "@/lib/rd-avatars";
import { playAvatarVoice, speakingAvatar, stopAvatarVoice } from "@/lib/rd-avatar-voice";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export { blankAvatarConfig } from "@/lib/rd-avatars";

/** Markup for the presenter block. Drop it inside any wizard step. */
export function avatarSection(cfg: AvatarConfig, title?: string | null): string {
  const list = allAvatars();
  const sel = findAvatar(cfg.avatarId);
  return `<div class="rv-sub">AI Presenter</div>
  <div class="rv-note sm">Add an on-camera host who opens, closes or rides along with your video.</div>
  <label class="rv-check"><input type="checkbox" id="avOn" ${cfg.enabled ? "checked" : ""}> Use An AI Presenter</label>
  ${
    !cfg.enabled
      ? ""
      : `<div class="av-wrap">
    <div class="av-grid">${list
      .map(
        (a) => `<button type="button" class="av-card${a.id === cfg.avatarId ? " on" : ""}" data-av="${esc(a.id)}" title="${esc(a.name)}">
        <span class="av-img" style="background-image:url('${esc(a.url)}')"></span>
        <b>${esc(a.name)}</b><em>${esc(a.blurb)}</em>
        <span class="av-play" role="button" tabindex="0" data-avplay="${esc(a.id)}" title="Hear ${esc(a.name)}'s Voice" aria-label="Hear ${esc(a.name)}'s Voice"><i data-lucide="volume-2"></i>Hear Voice</span>
      </button>`,
      )
      .join("")}
      <label class="av-card av-up" title="Upload Your Headshot">
        <span class="av-img av-plus"><i data-lucide="upload"></i></span>
        <b>Upload Headshot</b><em>Use Your Own Photo</em>
        <input type="file" id="avFile" accept="image/*" hidden>
      </label>
    </div>
    <div class="rv-sub sm">Presenter Placement</div>
    <div class="rv-seg av-seg">${AVATAR_MODES.map(
      (m) => `<button type="button" class="${cfg.mode === m.id ? "on" : ""}" data-avmode="${m.id}">${m.label}</button>`,
    ).join("")}</div>
    <div class="rv-note sm">${esc(AVATAR_MODES.find((m) => m.id === cfg.mode)?.blurb || "")}</div>
    ${
      cfg.mode !== "full"
        ? `<label class="rv-f">Bubble Corner<select id="avCorner">${[
            ["bottom_right", "Bottom Right"],
            ["bottom_left", "Bottom Left"],
            ["top_right", "Top Right"],
            ["top_left", "Top Left"],
          ]
            .map(([id, n]) => `<option value="${id}" ${cfg.corner === id ? "selected" : ""}>${n}</option>`)
            .join("")}</select></label>`
        : ""
    }
    <label class="rv-f">Presenter Name<input id="avName" placeholder="${esc(sel.name)}" value="${esc(cfg.name)}"></label>
    <label class="rv-f">Title Or Brokerage<input id="avTitle" placeholder="Listing Agent, Real Designs Realty" value="${esc(cfg.title)}"></label>
    <label class="rv-f">Opening Line<textarea id="avGreet" rows="2" placeholder="${esc(avatarGreeting({ ...cfg, greeting: "" }, title))}">${esc(cfg.greeting)}</textarea></label>
    <div class="rv-note sm">Leave the opening line blank and we write it for you, then read it in your chosen voice when narration is on.</div>
  </div>`
  }`;
}

/** Wire the presenter block. `rerender` redraws the step; `toast` is optional. */
export function bindAvatar(
  el: ParentNode,
  cfg: AvatarConfig,
  rerender: () => void,
  toast?: (m: string) => void,
) {
  const on = (sel: string, ev: string, fn: (e: Event) => void) =>
    el.querySelectorAll(sel).forEach((n) => n.addEventListener(ev, fn));

  const label = (id: string, state: "idle" | "loading" | "playing") => {
    const node = el.querySelector(`[data-avplay="${CSS.escape(id)}"]`) as HTMLElement | null;
    if (!node) return;
    node.classList.toggle("busy", state === "loading");
    node.classList.toggle("on", state === "playing");
    const icon = state === "playing" ? "square" : state === "loading" ? "loader" : "volume-2";
    const text = state === "playing" ? "Stop" : state === "loading" ? "Loading" : "Hear Voice";
    node.innerHTML = `<i data-lucide="${icon}"></i>${text}`;
    try {
      (window as unknown as { lucide?: { createIcons: (o?: unknown) => void } }).lucide?.createIcons();
    } catch (_) { /* icons refresh on next paint */ }
  };

  const preview = async (id: string) => {
    const stopping = speakingAvatar() === id;
    allAvatars().forEach((a) => label(a.id, "idle"));
    if (stopping) return stopAvatarVoice();
    label(id, "loading");
    try {
      const res = await playAvatarVoice(id);
      label(id, res === "played" ? "playing" : "idle");
    } catch (err) {
      label(id, "idle");
      toast?.(err instanceof Error ? err.message : "Voice Preview Failed.");
    }
  };

  on("[data-avplay]", "click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    void preview((e.currentTarget as HTMLElement).dataset['avplay']!);
  });
  on("[data-avplay]", "keydown", (e) => {
    const k = (e as KeyboardEvent).key;
    if (k !== "Enter" && k !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    void preview((e.currentTarget as HTMLElement).dataset['avplay']!);
  });
  const onVoiceEvt = () => {
    const id = speakingAvatar();
    allAvatars().forEach((a) => label(a.id, a.id === id ? "playing" : "idle"));
  };
  window.addEventListener("rd:avatar-voice", onVoiceEvt);

  const chk = el.querySelector("#avOn") as HTMLInputElement | null;
  if (chk)
    chk.addEventListener("change", () => {
      cfg.enabled = chk.checked;
      if (cfg.enabled && !getCustomAvatars().length) void loadCustomAvatars().then(() => rerender());
      rerender();
    });

  on("[data-av]", "click", (e) => {
    cfg.avatarId = (e.currentTarget as HTMLElement).dataset['av']!;
    rerender();
  });
  on("[data-avmode]", "click", (e) => {
    cfg.mode = (e.currentTarget as HTMLElement).dataset['avmode'] as AvatarConfig["mode"];
    rerender();
  });

  const corner = el.querySelector("#avCorner") as HTMLSelectElement | null;
  if (corner) corner.addEventListener("change", () => { cfg.corner = corner.value as AvatarConfig["corner"]; });
  const name = el.querySelector("#avName") as HTMLInputElement | null;
  if (name) name.addEventListener("input", () => { cfg.name = name.value; });
  const title = el.querySelector("#avTitle") as HTMLInputElement | null;
  if (title) title.addEventListener("input", () => { cfg.title = title.value; });
  const greet = el.querySelector("#avGreet") as HTMLTextAreaElement | null;
  if (greet) greet.addEventListener("input", () => { cfg.greeting = greet.value; });

  const file = el.querySelector("#avFile") as HTMLInputElement | null;
  if (file)
    file.addEventListener("change", () => {
      const f = file.files?.[0];
      if (!f) return;
      if (f.size > 8 * 1024 * 1024) return toast?.("Headshot Must Be Under 8 MB.");
      const a = addCustomAvatar(f);
      cfg.avatarId = a.id;
      toast?.("Presenter Photo Added.");
      rerender();
    });
}

/** Renderer options for the selected presenter, or null when it is off. */
export function avatarRenderOption(cfg: AvatarConfig | null | undefined, title?: string | null) {
  if (!cfg?.enabled) return null;
  const a = findAvatar(cfg.avatarId);
  return {
    url: a.url,
    name: cfg.name.trim() || a.name,
    title: cfg.title.trim() || null,
    mode: cfg.mode,
    corner: cfg.corner,
    greeting: avatarGreeting(cfg, title),
  };
}

/** Prefix the narration script with the presenter's opening line. */
export function avatarScript(cfg: AvatarConfig | null | undefined, script: string, title?: string | null) {
  if (!cfg?.enabled) return script;
  const g = avatarGreeting(cfg, title);
  return script.trim().startsWith(g) ? script : `${g} ${script}`.trim();
}

export { PRESET_AVATARS };
